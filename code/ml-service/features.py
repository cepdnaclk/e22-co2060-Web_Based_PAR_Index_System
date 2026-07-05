"""
Automatic feature extraction from an (UPPER, LOWER, BUCCAL) mesh trio.

These features require zero manual work — they're computed identically
for every case the moment its 3D models exist, whether during ML
calibration (on approved training cases) or at prediction time (on a new
patient). This is the input side of the PAR-score regressor in
train_regressor.py / app.py's /predict-par endpoint.

Every feature here is a simple geometric summary statistic, chosen to
correlate with actual PAR components (contact irregularity roughly tracks
curvature spread; occlusal fit roughly tracks upper/lower gap distance;
asymmetry roughly tracks a left/right centroid comparison) — without
requiring the per-tooth segmentation a full clinical measurement would
need.
"""
import numpy as np
import trimesh
from scipy.spatial import cKDTree

from geometry import _curvature_proxy, _candidate_indices, opposing_arch_contact_distance

FEATURE_NAMES = [
    "upper_curvature_mean", "upper_curvature_std",
    "lower_curvature_mean", "lower_curvature_std",
    "upper_lower_min_gap", "upper_lower_mean_gap",
    "upper_bbox_width", "lower_bbox_width",
    "upper_left_right_asymmetry", "lower_left_right_asymmetry",
    "upper_vertex_count", "lower_vertex_count",
]


def _left_right_asymmetry(mesh: trimesh.Trimesh) -> float:
    """Rough proxy for centreline deviation: difference in vertex spread either side of the mesh's own x-midline."""
    centre_x = (mesh.bounds[0][0] + mesh.bounds[1][0]) / 2
    left = mesh.vertices[mesh.vertices[:, 0] < centre_x]
    right = mesh.vertices[mesh.vertices[:, 0] >= centre_x]
    if len(left) == 0 or len(right) == 0:
        return 0.0
    return float(abs(len(left) - len(right)) / max(len(left) + len(right), 1))


def _curvature_stats(mesh: trimesh.Trimesh) -> tuple:
    """Mean/std of the curvature proxy over a candidate subsample (see geometry.MAX_CANDIDATE_VERTICES) — fast regardless of mesh resolution."""
    indices = _candidate_indices(len(mesh.vertices))
    curvature_map = _curvature_proxy(mesh, indices)
    values = np.array(list(curvature_map.values()))
    return float(values.mean()), float(values.std())


def extract_features(upper_path: str, lower_path: str) -> dict:
    upper = trimesh.load(upper_path, force="mesh")
    lower = trimesh.load(lower_path, force="mesh")

    upper_curv_mean, upper_curv_std = _curvature_stats(upper)
    lower_curv_mean, lower_curv_std = _curvature_stats(lower)

    tree = cKDTree(lower.vertices)
    gaps, _ = tree.query(upper.vertices)

    upper_bbox = upper.bounds[1] - upper.bounds[0]
    lower_bbox = lower.bounds[1] - lower.bounds[0]

    return {
        "upper_curvature_mean": upper_curv_mean,
        "upper_curvature_std": upper_curv_std,
        "lower_curvature_mean": lower_curv_mean,
        "lower_curvature_std": lower_curv_std,
        "upper_lower_min_gap": float(gaps.min()),
        "upper_lower_mean_gap": float(gaps.mean()),
        "upper_bbox_width": float(upper_bbox[0]),
        "lower_bbox_width": float(lower_bbox[0]),
        "upper_left_right_asymmetry": _left_right_asymmetry(upper),
        "lower_left_right_asymmetry": _left_right_asymmetry(lower),
        "upper_vertex_count": float(len(upper.vertices)),
        "lower_vertex_count": float(len(lower.vertices)),
    }


def features_to_vector(feat: dict) -> np.ndarray:
    return np.array([feat[name] for name in FEATURE_NAMES], dtype=np.float64)
