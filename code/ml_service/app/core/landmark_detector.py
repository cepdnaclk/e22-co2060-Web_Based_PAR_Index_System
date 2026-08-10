"""
Geometric landmark detector -- v3.

v2 fixed axis semantics (x=transverse, y=AP, z=vertical) to match both
GeometricPARService.java and the senior project's ParScoreService.java,
and fixed a coordinate-space mismatch with the frontend's display
transform, and outlier robustness. All of that held for the LOWER arch
but not the UPPER arch (see screenshots showing correct lower / wrong
upper placement) -- the shapes render at visibly different orientations,
which points to a real, common scanner/export quirk: upper and lower
arch STL files are frequently NOT exported in the same orientation
relative to each other (you scan looking down into the lower arch and up
into the upper arch). v2 hard-assumed raw x/y/z meant the same thing for
both slots; that assumption breaks when the files don't share one
orientation.

v3 detects each mesh's own axis roles instead of assuming them: for a
typical full-arch scan, the horseshoe's ear-to-ear transverse span is the
largest dimension, front-to-back (AP) is the next largest, and
occlusal-gingival (vertical) tooth height is the smallest. Axes are
picked per mesh by range, not hardcoded to column 0/1/2. This keeps
output in the mesh's own native coordinates (so the coordinate-space fix
from the previous round -- matching the frontend's display transform --
still holds), it just no longer assumes column 0 is always "x=transverse"
for every file.

REMAINING ASSUMPTION THAT STILL NEEDS VERIFICATION ON A REAL SCAN:
which direction along the detected transverse axis is the patient's
right side. This can flip independently per slot if upper/lower really
are mirrored relative to each other -- see RIGHT_IS_NEGATIVE_TRANSVERSE
below, now keyed per slot instead of one global constant.
"""

import logging
from typing import Dict, List, Tuple

import numpy as np
import trimesh

logger = logging.getLogger("landmark_detector")

# Per-slot right-side sign. If predicted R/L points come out mirrored for
# a given slot on a real scan, flip that slot's entry here. Kept per-slot
# (not one global flag) because upper/lower exports can be mirrored
# relative to each other.
RIGHT_IS_NEGATIVE_TRANSVERSE = {
    "UPPER": True,
    "LOWER": True,
    "BUCCAL": True,
}

ANTERIOR_SEQUENCE_UPPER = ["R3M", "R3D", "R2M", "R2D", "R1M", "R1D", "R1Mid",
                           "L1M", "L1D", "L2M", "L2D", "L3M", "L3D"]
ANTERIOR_SEQUENCE_LOWER = ["R3M", "R3D", "R2M", "R2D", "R1M", "R1D", "R1Mid", "R1Low",
                           "L1M", "L1D", "L2M", "L2D", "L3M", "L3D"]


def _remove_outliers(vertices: np.ndarray, low_pct: float = 1.0, high_pct: float = 99.0) -> np.ndarray:
    """Clips to the 1st-99th percentile per raw axis before any landmark
    search or axis-role detection runs, so scan-bed/retractor/noise
    vertices can't skew either the bounding box or the axis-role
    detection below."""
    mask = np.ones(len(vertices), dtype=bool)
    for axis in range(3):
        lo, hi = np.percentile(vertices[:, axis], [low_pct, high_pct])
        mask &= (vertices[:, axis] >= lo) & (vertices[:, axis] <= hi)
    filtered = vertices[mask]
    return filtered if len(filtered) >= 50 else vertices  # safety floor


def _detect_axis_roles(vertices: np.ndarray) -> Tuple[int, int, int]:
    """Returns (transverse_idx, ap_idx, vertical_idx) into the raw x/y/z
    columns, picked by range (max-min) per axis: widest = transverse
    (ear-to-ear), next = anteroposterior (front-to-back), narrowest =
    vertical (occlusal-gingival tooth height). This holds for a typical
    full-arch scan regardless of which raw column happens to hold each
    role in a given file -- which is exactly what differed between the
    upper and lower files in this bug report."""
    ranges = vertices.max(axis=0) - vertices.min(axis=0)
    order = np.argsort(ranges)[::-1]  # largest range first
    transverse_idx, ap_idx, vertical_idx = int(order[0]), int(order[1]), int(order[2])
    return transverse_idx, ap_idx, vertical_idx


def _nearest_vertex(vertices: np.ndarray, target: np.ndarray) -> np.ndarray:
    idx = np.argmin(np.linalg.norm(vertices - target, axis=1))
    return vertices[idx]


def _anterior_points(vertices: np.ndarray, names: List[str], axes: Tuple[int, int, int],
                      right_is_negative: bool) -> Dict[str, np.ndarray]:
    """Places anterior sequence points along the detected transverse axis,
    ordered R3 -> R1Mid -> L3, snapped to the nearest real vertex."""
    t_idx, a_idx, v_idx = axes
    t = vertices[:, t_idx]
    lo, hi = t.min(), t.max()
    start, end = (hi, lo) if right_is_negative else (lo, hi)

    n = len(names)
    points = {}
    for i, name in enumerate(names):
        frac = i / max(n - 1, 1)
        target_t = start + frac * (end - start)
        window = abs(end - start) / max(n - 1, 1) * 1.5 or 1.0
        mask = np.abs(t - target_t) <= window
        candidates = vertices[mask] if mask.any() else vertices
        cv = candidates[:, v_idx]
        top = candidates[cv >= np.percentile(cv, 70)]
        top = top if len(top) else candidates
        target_point = np.zeros(3)
        target_point[t_idx] = target_t
        target_point[a_idx] = np.median(candidates[:, a_idx])
        target_point[v_idx] = top[:, v_idx].max()
        points[name] = _nearest_vertex(top, target_point)
    return points


def _molar_premolar_points(vertices: np.ndarray, side: str,
                            tooth_frac_center: float, tag: str,
                            axes: Tuple[int, int, int],
                            right_is_negative: bool) -> Dict[str, np.ndarray]:
    """Finds cusp points for one molar/premolar tooth region.

    tag='6' -> emits {side}6MB,6MP,6DB,6DP,6GB,6M
    tag='5' -> emits {side}5BT,5PT
    tag='4' -> emits {side}4BT,4PT
    """
    t_idx, a_idx, v_idx = axes
    t = vertices[:, t_idx]
    lo, hi = t.min(), t.max()
    span = hi - lo

    right_end = hi if right_is_negative else lo
    left_end = lo if right_is_negative else hi
    region_end = right_end if side == "R" else left_end
    towards_mid = (left_end - right_end) if side == "R" else (right_end - left_end)
    center_t = region_end + tooth_frac_center * towards_mid
    width = 0.12 * abs(span)
    mask = np.abs(t - center_t) <= width
    region = vertices[mask] if mask.any() else vertices

    arch_center_t = (lo + hi) / 2.0
    cusp_v_thresh = np.percentile(region[:, v_idx], 75)
    cusps = region[region[:, v_idx] >= cusp_v_thresh]
    cusps = cusps if len(cusps) else region

    points: Dict[str, np.ndarray] = {}

    if tag == "6":
        a = cusps[:, a_idx]
        a_med = np.median(a)
        mesial_mask = a <= a_med
        distal_mask = a > a_med
        mesial = cusps[mesial_mask] if mesial_mask.any() else cusps
        distal = cusps[distal_mask] if distal_mask.any() else cusps

        def buccal_palatal(cluster):
            dist_from_mid = np.abs(cluster[:, t_idx] - arch_center_t)
            b = cluster[np.argmax(dist_from_mid)]  # farther from centerline = buccal
            p = cluster[np.argmin(dist_from_mid)]  # closer to centerline = palatal/lingual
            return b, p

        mb, mp = buccal_palatal(mesial)
        db, dp = buccal_palatal(distal)
        points[f"{side}6MB"] = mb
        points[f"{side}6MP"] = mp
        points[f"{side}6DB"] = db
        points[f"{side}6DP"] = dp
        points[f"{side}6GB"] = region[np.argmin(region[:, v_idx])]
        med_t = np.median(mesial[:, t_idx])
        points[f"{side}6M"] = mesial[np.argmin(np.abs(mesial[:, t_idx] - med_t))]

    else:  # premolar: single buccal/palatal tip pair, no mesial/distal split
        dist_from_mid = np.abs(cusps[:, t_idx] - arch_center_t)
        bt = cusps[np.argmax(dist_from_mid)]
        pt = cusps[np.argmin(dist_from_mid)]
        points[f"{side}{tag}BT"] = bt
        points[f"{side}{tag}PT"] = pt

    return points


def detect_arch_landmarks(mesh_path: str, slot: str) -> Dict[str, Tuple[float, float, float]]:
    """Main entry point. slot is 'UPPER', 'LOWER', or 'BUCCAL'."""
    mesh = trimesh.load(mesh_path, force="mesh")
    if not isinstance(mesh, trimesh.Trimesh) or len(mesh.vertices) == 0:
        raise ValueError(f"Could not load a valid mesh from {mesh_path}")
    vertices_full = np.asarray(mesh.vertices)
    vertices = _remove_outliers(vertices_full)

    axes = _detect_axis_roles(vertices)
    right_is_negative = RIGHT_IS_NEGATIVE_TRANSVERSE.get(slot, True)
    t_idx, a_idx, v_idx = axes
    logger.info(f"[{slot}] detected axis roles: transverse=col{t_idx} ap=col{a_idx} vertical=col{v_idx}")

    result: Dict[str, np.ndarray] = {}

    if slot in ("UPPER", "LOWER"):
        seq = ANTERIOR_SEQUENCE_UPPER if slot == "UPPER" else ANTERIOR_SEQUENCE_LOWER
        result.update(_anterior_points(vertices, seq, axes, right_is_negative))
        for side in ("R", "L"):
            result.update(_molar_premolar_points(vertices, side, 0.12, "6", axes, right_is_negative))
            result.update(_molar_premolar_points(vertices, side, 0.22, "5", axes, right_is_negative))
            result.update(_molar_premolar_points(vertices, side, 0.30, "4", axes, right_is_negative))

    elif slot == "BUCCAL":
        t = vertices[:, t_idx]
        lo, hi = t.min(), t.max()
        right_end = hi if right_is_negative else lo
        left_end = lo if right_is_negative else hi

        def region(side):
            end = right_end if side == "R" else left_end
            mid = (lo + hi) / 2.0
            center = end + 0.12 * (mid - end)
            width = 0.12 * (hi - lo)
            mask = np.abs(t - center) <= width
            return vertices[mask] if mask.any() else vertices

        r = region("R")
        l = region("L")
        result["RU6"] = r[np.argmax(r[:, v_idx])]
        result["RL6"] = r[np.argmin(r[:, v_idx])]
        result["LU6"] = l[np.argmax(l[:, v_idx])]
        result["LL6"] = l[np.argmin(l[:, v_idx])]
        mid_mask = np.abs(t - (lo + hi) / 2) <= 0.15 * (hi - lo)
        mid_region = vertices[mid_mask] if mid_mask.any() else vertices
        result["LCover"] = mid_region[np.argmin(mid_region[:, v_idx])]

    else:
        raise ValueError(f"Unknown slot: {slot}")

    # -- Match the frontend's display transform (see previous round) --
    # Uses the FULL unfiltered vertex set on purpose, to match Three.js's
    # geo.computeBoundingBox() on the frontend exactly.
    DISPLAY_BOX_SIZE = 80.0
    bbox_min = vertices_full.min(axis=0)
    bbox_max = vertices_full.max(axis=0)
    bbox_center = (bbox_min + bbox_max) / 2.0
    bbox_size = bbox_max - bbox_min
    max_dim = float(np.max(bbox_size)) or 1.0
    display_scale = DISPLAY_BOX_SIZE / max_dim

    transformed = {
        name: (p - bbox_center) * display_scale
        for name, p in result.items()
    }

    return {name: (float(p[0]), float(p[1]), float(p[2])) for name, p in transformed.items()}
