"""
Automatic, unsupervised landmark detection from a single 3D mesh.

No training data, no manual annotation, works from the very first upload.
This deliberately does NOT try to learn landmark coordinates from data —
see /ml-service/README.md for why that's not a learnable problem (one PAR
score can't determine 150+ coordinate values). Instead it detects
landmarks the same way a human would describe them geometrically:

  - Cusp tips / incisal edges  -> local curvature maxima on the surface
  - Contact points between adjacent teeth -> nearest-point pairs between
    neighbouring tooth regions
  - Buccal occlusal relationship -> nearest-point distances between the
    upper and lower arch meshes

This trades some accuracy on unusual anatomy (missing teeth, severe
crowding) for zero cold-start requirement — every prediction is written
back as UNCONFIRMED, so a clinician always reviews before it affects a
real PAR score.
"""
import numpy as np
import trimesh
from scipy.spatial import cKDTree

# Landmark names this detector knows how to produce. Matches
# LandmarkPanel.LANDMARK_DEFS on the frontend for UPPER note the full
# clinical set is large; this detector produces the geometrically
# reliable subset (cusps/tips + contacts) and leaves gaps for the
# clinician to fill in manually if needed.
CUSP_POINT_SUFFIXES = ("MB", "MP", "DB", "DP", "BT", "PT", "GB")
CONTACT_POINT_SUFFIXES = ("M", "D", "Mid")

# Dental STL scans commonly have tens/hundreds of thousands of vertices.
# We only need a representative CANDIDATE sample to find the sharpest
# points and densest regions — checking every single vertex is what was
# causing multi-minute requests. This cap keeps requests to a few seconds
# regardless of mesh resolution, with no meaningful accuracy loss (the
# detected landmarks are geometric features large enough that a few
# thousand candidate points reliably includes ones near every real
# cusp/contact).
MAX_CANDIDATE_VERTICES = 4000


def load_mesh(mesh_path: str) -> trimesh.Trimesh:
    return trimesh.load(mesh_path, force="mesh")


def _candidate_indices(n_vertices: int) -> np.ndarray:
    if n_vertices <= MAX_CANDIDATE_VERTICES:
        return np.arange(n_vertices)
    rng = np.random.default_rng(seed=42)  # deterministic across calls for the same mesh
    return rng.choice(n_vertices, size=MAX_CANDIDATE_VERTICES, replace=False)


def _curvature_proxy(mesh: trimesh.Trimesh, indices: np.ndarray = None) -> dict:
    """
    Cheap, dependency-light curvature proxy: angle between each vertex
    normal and the mean normal of its immediate neighbours. High values
    indicate sharp local features (cusp tips, incisal edges).

    Only computed for `indices` (default: all) — see MAX_CANDIDATE_VERTICES.
    Returns {vertex_index: curvature_value}, not a full-length array, so
    the caller never pays for vertices it didn't ask about.
    """
    vertex_normals = mesh.vertex_normals
    adjacency = mesh.vertex_neighbors

    if indices is None:
        indices = np.arange(len(mesh.vertices))

    curvature = {}
    for i in indices:
        neighbours = adjacency[i]
        if not neighbours:
            curvature[i] = 0.0
            continue
        mean_normal = vertex_normals[neighbours].mean(axis=0)
        norm = np.linalg.norm(mean_normal)
        if norm < 1e-8:
            curvature[i] = 0.0
            continue
        mean_normal /= norm
        cos_angle = np.clip(np.dot(vertex_normals[i], mean_normal), -1.0, 1.0)
        curvature[i] = float(np.arccos(cos_angle))
    return curvature


def detect_cusp_points(mesh: trimesh.Trimesh, n_points: int, min_separation: float) -> tuple:
    """
    Returns (points, curvature_values) for the top-N candidate vertices by
    curvature, each at least min_separation apart.
    """
    indices = _candidate_indices(len(mesh.vertices))
    curvature_map = _curvature_proxy(mesh, indices)

    order = sorted(curvature_map.keys(), key=lambda i: -curvature_map[i])

    selected = []
    for idx in order:
        pt = mesh.vertices[idx]
        if all(np.linalg.norm(pt - mesh.vertices[s]) >= min_separation for s in selected):
            selected.append(idx)
        if len(selected) >= n_points:
            break

    max_curv = max(curvature_map.values()) if curvature_map else 1.0
    return mesh.vertices[selected], [curvature_map[i] / max(max_curv, 1e-8) for i in selected]


def detect_contact_points(mesh: trimesh.Trimesh, n_pairs: int) -> np.ndarray:
    """
    Approximates inter-tooth contact points via local point density
    (narrow gaps between teeth pack points closer together than the open
    occlusal surface). Only checks a candidate subsample — see
    MAX_CANDIDATE_VERTICES — using a KD-tree query so each check is fast
    regardless of full mesh size.
    """
    indices = _candidate_indices(len(mesh.vertices))
    tree = cKDTree(mesh.vertices)

    density = np.array([len(tree.query_ball_point(mesh.vertices[i], r=0.8)) for i in indices])
    order = indices[np.argsort(-density)]

    selected = []
    for idx in order:
        pt = mesh.vertices[idx]
        if all(np.linalg.norm(pt - mesh.vertices[s]) >= 1.5 for s in selected):
            selected.append(idx)
        if len(selected) >= n_pairs:
            break

    return mesh.vertices[selected]


def detect_landmarks_for_slot(mesh_path: str, slot: str) -> dict:
    """
    Returns { clinical_point_name: {x,y,z,confidence} } for one slot,
    using the EXACT names GeometricPARService and the frontend expect
    (R3M, L6MB, LCover, ...) — not generic labels.

    UPPER/LOWER: candidate points are found by curvature (cusp/tip
    detection, same as before), then assigned to specific tooth
    positions/roles via arch_geometry + teeth_naming — see those modules
    for the full explanation and calibration caveats.

    BUCCAL: your clinical scheme only needs ONE point here (LCover) —
    the single highest-curvature candidate is used directly, no arch
    binning needed for a single point.
    """
    import arch_geometry
    import teeth_naming

    mesh = load_mesh(mesh_path)

    if slot == "BUCCAL":
        indices = _candidate_indices(len(mesh.vertices))
        curvature_map = _curvature_proxy(mesh, indices)
        if not curvature_map:
            return {}
        best_idx = max(curvature_map.keys(), key=lambda i: curvature_map[i])
        pt = mesh.vertices[best_idx]
        return {"LCover": {"x": float(pt[0]), "y": float(pt[1]), "z": float(pt[2]), "confidence": 0.5}}

    roles = teeth_naming.UPPER_ROLES if slot == "UPPER" else teeth_naming.LOWER_ROLES

    # Candidate points: same curvature-based cusp detection as before,
    # but now we keep the FULL candidate pool (not just the top-14) so
    # the tooth-position binner has enough points per tooth to choose
    # buccal/palatal/mesial/distal from.
    indices = _candidate_indices(len(mesh.vertices))
    curvature_map = _curvature_proxy(mesh, indices)
    if not curvature_map:
        return {}

    cand_indices = np.array(list(curvature_map.keys()))
    curvature_vals = np.array([curvature_map[i] for i in cand_indices])
    points_xyz = mesh.vertices[cand_indices]

    theta, radius, height = arch_geometry.arch_position(mesh.vertices, cand_indices)

    return teeth_naming.assign_names(theta, radius, height, curvature_vals, points_xyz, roles)


def opposing_arch_contact_distance(upper_mesh_path: str, lower_mesh_path: str) -> float:
    """
    Minimum distance between the upper and lower arch meshes — a direct
    geometric proxy for occlusal contact, used both as a landmark aid and
    as a feature for the PAR regressor.
    """
    upper = load_mesh(upper_mesh_path)
    lower = load_mesh(lower_mesh_path)
    tree = cKDTree(lower.vertices)
    distances, _ = tree.query(upper.vertices)
    return float(distances.min())
