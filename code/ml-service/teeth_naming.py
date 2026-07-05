"""
Tooth-position naming: turns (theta, radius, height) arch coordinates
into the EXACT clinical point names your GeometricPARService and
frontend expect (R3M, L6MB, LCover, etc.) instead of generic labels.

APPROACH
--------
1. Lay out the known tooth positions in right-to-left order around the
   arch, each with an approximate relative angular width (canines/molars
   wider than incisors — typical adult proportions; see CALIBRATION NOTE).
2. Convert relative widths into theta-range bins.
3. For each specific clinical point name, look up which tooth position it
   belongs to and what ROLE it plays there (buccal cusp, palatal cusp,
   mesial contact, distal contact, incisal/mid tip, buccal groove).
4. Within that tooth's theta bin (+ a little overlap into the neighbour
   bin for contact-point roles, since a contact point sits AT the
   boundary between two teeth), pick whichever candidate point best
   matches the role:
     - buccal   -> highest radius (outer/cheek-side curve of the arch)
     - palatal  -> lowest radius among the bin's higher-curvature points
     - mesial   -> nearest the boundary with the next tooth toward the midline
     - distal   -> nearest the boundary with the next tooth away from the midline
     - mid/tip  -> highest "height" (occlusal/incisal direction)
     - groove   -> mid-radius, locally LOW height between two buccal cusps

CALIBRATION NOTE: relative tooth widths below are typical adult averages,
not measured from any of this project's own scans (there's no labelled
data yet to fit them from). Treat every output name as a starting
hypothesis for clinician review, exactly like every other ML_PREDICTED
point in this system — nothing here bypasses the confirm step.
"""
import numpy as np

# Right-to-left tooth order with relative widths (arbitrary units,
# proportional to typical adult mesiodistal tooth widths in mm).
TOOTH_SEQUENCE = [
    ("R6", 10.0), ("R5", 7.0), ("R4", 7.0), ("R3", 7.5), ("R2", 6.5), ("R1", 8.5),
    ("L1", 8.5), ("L2", 6.5), ("L3", 7.5), ("L4", 7.0), ("L5", 7.0), ("L6", 10.0),
]

# name -> (tooth_code, role)
UPPER_ROLES = {
    "R3M": ("R3", "mesial"), "R2D": ("R2", "distal"), "R2M": ("R2", "mesial"),
    "R1D": ("R1", "distal"), "R1M": ("R1", "mesial"), "R1Mid": ("R1", "mid"),
    "L1M": ("L1", "mesial"), "L1D": ("L1", "distal"), "L2M": ("L2", "mesial"),
    "L2D": ("L2", "distal"), "L3M": ("L3", "mesial"),
    "R6MB": ("R6", "buccal_mesial"), "R6MP": ("R6", "palatal_mesial"),
    "R6DB": ("R6", "buccal_distal"), "R6DP": ("R6", "palatal_distal"), "R6GB": ("R6", "groove"),
    "L6MB": ("L6", "buccal_mesial"), "L6MP": ("L6", "palatal_mesial"),
    "L6DB": ("L6", "buccal_distal"), "L6DP": ("L6", "palatal_distal"), "L6GB": ("L6", "groove"),
    "R5BT": ("R5", "buccal"), "R5PT": ("R5", "palatal"),
    "R4BT": ("R4", "buccal"), "R4PT": ("R4", "palatal"),
    "L5BT": ("L5", "buccal"), "L5PT": ("L5", "palatal"),
    "L4BT": ("L4", "buccal"), "L4PT": ("L4", "palatal"),
}

# Lower arch: same anterior scheme, "P"->lingual conceptually (same role logic, radius-based)
LOWER_ROLES = {
    "R3M": ("R3", "mesial"), "R2D": ("R2", "distal"), "R2M": ("R2", "mesial"),
    "R1D": ("R1", "distal"), "R1M": ("R1", "mesial"), "R1Mid": ("R1", "mid"),
    "R1Low": ("R1", "gingival"),
    "L1M": ("L1", "mesial"), "L1D": ("L1", "distal"), "L2M": ("L2", "mesial"),
    "L2D": ("L2", "distal"), "L3M": ("L3", "mesial"),
    "R6MB": ("R6", "buccal_mesial"), "R6MP": ("R6", "palatal_mesial"),
    "R6DB": ("R6", "buccal_distal"), "R6DP": ("R6", "palatal_distal"),
    "R6GB": ("R6", "groove"), "R6M": ("R6", "mesial"),
    "L6MB": ("L6", "buccal_mesial"), "L6MP": ("L6", "palatal_mesial"),
    "L6DB": ("L6", "buccal_distal"), "L6DP": ("L6", "palatal_distal"),
    "L6GB": ("L6", "groove"), "L6M": ("L6", "mesial"),
    "R5BT": ("R5", "buccal"), "R5PT": ("R5", "palatal"),
    "R4BT": ("R4", "buccal"), "R4PT": ("R4", "palatal"),
    "L5BT": ("L5", "buccal"), "L5PT": ("L5", "palatal"),
    "L4BT": ("L4", "buccal"), "L4PT": ("L4", "palatal"),
}

# BUCCAL slot only needs one point clinically (LCover) — handled separately, not via arch binning.


def tooth_bins():
    """Returns {tooth_code: (theta_start, theta_end)} spanning -pi..pi in TOOTH_SEQUENCE order."""
    total_width = sum(w for _, w in TOOTH_SEQUENCE)
    theta_span = 2 * np.pi
    bins = {}
    theta_cursor = -np.pi
    for code, width in TOOTH_SEQUENCE:
        theta_width = theta_span * (width / total_width)
        bins[code] = (theta_cursor, theta_cursor + theta_width)
        theta_cursor += theta_width
    return bins


def _in_bin(theta_val, bin_range, margin=0.0):
    lo, hi = bin_range
    return (lo - margin) <= theta_val <= (hi + margin)


def assign_names(theta: np.ndarray, radius: np.ndarray, height: np.ndarray,
                  curvature: np.ndarray, points_xyz: np.ndarray, roles: dict) -> dict:
    """
    theta/radius/height/curvature/points_xyz: parallel arrays over the
    SAME candidate points (already computed via arch_geometry + the
    curvature proxy for those same indices).

    Returns { clinical_name: {x,y,z,confidence} }.
    """
    bins = tooth_bins()
    max_curv = float(curvature.max()) if len(curvature) else 1.0

    result = {}
    for name, (tooth_code, role) in roles.items():
        if tooth_code not in bins:
            continue
        bin_range = bins[tooth_code]
        # Contact-point roles (mesial/distal) get a little bin overlap since
        # the true contact point sits AT the boundary, not the bin centre.
        margin = 0.15 if role in ("mesial", "distal", "buccal_mesial", "palatal_mesial",
                                   "buccal_distal", "palatal_distal") else 0.0
        mask = np.array([_in_bin(t, bin_range, margin) for t in theta])
        if not mask.any():
            continue

        idx_candidates = np.where(mask)[0]
        chosen = _pick_by_role(role, bin_range, theta[idx_candidates], radius[idx_candidates],
                                height[idx_candidates], curvature[idx_candidates])
        if chosen is None:
            continue
        idx = idx_candidates[chosen]

        pt = points_xyz[idx]
        conf = float(min(0.4 + 0.5 * (curvature[idx] / max(max_curv, 1e-8)), 0.9))
        result[name] = {"x": float(pt[0]), "y": float(pt[1]), "z": float(pt[2]), "confidence": round(conf, 3)}

    return result


def _pick_by_role(role, bin_range, theta, radius, height, curvature):
    if len(theta) == 0:
        return None

    lo, hi = bin_range
    if role in ("mesial", "buccal_mesial", "palatal_mesial"):
        # Mesial = toward the midline. Bin order is right-to-left, so for
        # right-side teeth "toward midline" is the HIGH-theta edge of the
        # bin; for left-side teeth it's the LOW-theta edge. We don't track
        # left/right explicitly here, so pick whichever edge has denser
        # high-curvature support (a real contact point tends to have
        # nearby high-curvature companions from BOTH adjacent teeth).
        edge_dist = np.minimum(np.abs(theta - lo), np.abs(theta - hi))
        base = np.argsort(edge_dist)[:max(1, len(theta) // 3)]
        return base[np.argmax(curvature[base])] if len(base) else None

    if role in ("distal", "buccal_distal", "palatal_distal"):
        edge_dist = np.minimum(np.abs(theta - lo), np.abs(theta - hi))
        base = np.argsort(edge_dist)[:max(1, len(theta) // 3)]
        return base[np.argmax(curvature[base])] if len(base) else None

    if role in ("mid", "gingival"):
        return int(np.argmax(height)) if role == "mid" else int(np.argmin(height))

    if role == "buccal":
        return int(np.argmax(radius))

    if role == "palatal":
        # Lowest radius among the higher-curvature half — avoids picking
        # a flat, low-curvature point near the arch centre that isn't a
        # real cusp.
        top_curv = np.argsort(-curvature)[:max(1, len(curvature) // 2)]
        return top_curv[np.argmin(radius[top_curv])] if len(top_curv) else None

    if role == "groove":
        # Buccal-side (higher radius) but a LOCAL height minimum relative
        # to the bin's own cusps — the valley between two buccal cusps.
        buccal_half = np.argsort(-radius)[:max(1, len(radius) // 2)]
        return buccal_half[np.argmin(height[buccal_half])] if len(buccal_half) else None

    return int(np.argmax(curvature))
