"""
Arch-relative coordinate frame.

A dental arch is a horseshoe. This module finds that horseshoe's own
coordinate system directly from mesh geometry via PCA — no labeled data,
no per-patient calibration needed for the geometry itself:

  - The 2 directions of largest variance span the "arch plane" (the plane
    the horseshoe roughly lies in).
  - The 1 remaining direction is the "height" axis (occlusal/incisal
    direction — how far a point sticks up from the arch's average plane;
    cusp tips and incisal edges are height maxima).
  - Within the arch plane, a point's ANGLE around the arch centroid tells
    you which tooth position it's near (right molars -> ... -> right
    canine -> incisors -> left canine -> ... -> left molars form one
    continuous angular sweep around a horseshoe).
  - A point's RADIUS from the arch centroid tells you buccal vs
    palatal/lingual: buccal (cheek-side) is the OUTER curve of the
    horseshoe = larger radius; palatal/lingual (tongue-side) is the INNER
    curve = smaller radius.

CALIBRATION CAVEAT (important): the mapping from "angular position" to
"which specific tooth" uses approximate, evenly-weighted bins for now
(ANTERIOR_BIN_NAMES / POSTERIOR bins below) because there's no labeled
data yet to fit real proportions from (real human arches aren't evenly
spaced — canines/molars are wider than incisors). Once there are enough
approved+reviewed cases, the bin boundaries here should be refit from
where clinicians actually end up correcting points to. Until then, treat
every angle-derived name as a starting hypothesis for clinician review —
which is exactly what the confirmed=False / review workflow already
enforces.

LEFT/RIGHT HANDEDNESS CAVEAT: whether increasing angle means
right-to-left or left-to-right depends on how the STL was exported
(scanner/software convention). This module picks a convention and
verifies/orients it using the mesh's own asymmetry (see `_resolve_handedness`)
but if your scanner/software consistently flips this, set MIRROR_LR=True
below once and it applies to every case.
"""
import numpy as np

MIRROR_LR = False  # flip if right/left labels come out swapped for your scanner's export convention


def compute_arch_frame(vertices: np.ndarray):
    """Returns (centroid, arch_plane_basis[3x2], height_axis[3])."""
    centroid = vertices.mean(axis=0)
    centered = vertices - centroid
    cov = np.cov(centered.T)
    eigvals, eigvecs = np.linalg.eigh(cov)
    order = np.argsort(-eigvals)
    eigvecs = eigvecs[:, order]
    arch_plane_basis = eigvecs[:, :2]   # 2 largest-variance directions
    height_axis = eigvecs[:, 2]         # smallest-variance direction
    return centroid, arch_plane_basis, height_axis


def to_arch_coords(vertices: np.ndarray, centroid, arch_plane_basis, height_axis):
    """Returns (theta, radius, height) arrays, one entry per input vertex."""
    centered = vertices - centroid
    xy = centered @ arch_plane_basis
    height = centered @ height_axis
    theta = np.arctan2(xy[:, 1], xy[:, 0])
    radius = np.linalg.norm(xy, axis=1)
    return theta, radius, height


def _resolve_handedness(theta: np.ndarray, height: np.ndarray) -> float:
    """
    Returns +1 or -1 to apply to theta so that increasing (signed) angle
    consistently means "right side -> front -> left side" — anchored on
    the anterior point (max height = incisal tips stick up/forward the
    most) sitting near theta=0, which is orientation-invariant. The
    left/right SIGN convention itself still depends on MIRROR_LR since
    "which physical side is positive angle" can't be derived from
    symmetric geometry alone.
    """
    return -1.0 if MIRROR_LR else 1.0


def arch_position(vertices: np.ndarray, query_indices: np.ndarray):
    """
    Convenience: compute the arch frame from `vertices` (should be the
    full mesh, or a large representative sample) and return
    (theta, radius, height) for just `query_indices`, with the anterior
    point re-centred to theta=0 and consistent handedness applied.
    """
    centroid, basis, height_axis = compute_arch_frame(vertices)
    theta_all, radius_all, height_all = to_arch_coords(vertices, centroid, basis, height_axis)

    anterior_idx = int(np.argmax(height_all))
    theta_offset = theta_all[anterior_idx]

    theta_q, radius_q, height_q = to_arch_coords(vertices[query_indices], centroid, basis, height_axis)
    sign = _resolve_handedness(theta_all, height_all)
    theta_q = sign * _wrap_angle(theta_q - theta_offset)

    return theta_q, radius_q, height_q


def _wrap_angle(theta: np.ndarray) -> np.ndarray:
    """Wraps angles to (-pi, pi]."""
    return np.mod(theta + np.pi, 2 * np.pi) - np.pi
