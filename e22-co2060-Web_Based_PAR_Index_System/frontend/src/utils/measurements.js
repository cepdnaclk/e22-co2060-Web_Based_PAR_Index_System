// frontend/src/utils/measurements.js
// NEW FILE — PAR-relevant 3D measurement utilities

/** Euclidean distance between two 3D points */
export function dist3(a, b) {
  return Math.sqrt(
    (a.x - b.x) ** 2 +
    (a.y - b.y) ** 2 +
    (a.z - b.z) ** 2
  )
}

/**
 * Overjet — horizontal (X-axis) distance between upper and lower incisor tips.
 * Uses the R1Mid landmark from UPPER and LOWER placedPoints.
 * Returns mm distance (positive = upper protrudes, negative = anterior crossbite).
 */
export function calcOverjet(upperPoints, lowerPoints) {
  const u = upperPoints['R1Mid']
  const l = lowerPoints['R1Mid']
  if (!u || !l) return null
  // Horizontal component only (X axis in dental orientation)
  return parseFloat((u.z - l.z).toFixed(2))
}

/**
 * Overbite — vertical (Y-axis) difference between upper and lower incisor tips.
 * Positive = upper covers lower (overbite), negative = open bite.
 */
export function calcOverbite(upperPoints, lowerPoints) {
  const u = upperPoints['R1Mid']
  const l = lowerPoints['R1Mid'] ?? lowerPoints['R1Low']
  if (!u || !l) return null
  return parseFloat((u.y - l.y).toFixed(2))
}

/**
 * Centerline deviation — X-axis offset between upper and lower dental midlines.
 * Upper midline = midpoint of R1M and L1M in UPPER.
 * Lower midline = midpoint of R1M and L1M in LOWER.
 */
export function calcCenterlineDeviation(upperPoints, lowerPoints) {
  const uR = upperPoints['R1M']
  const uL = upperPoints['L1M']
  const lR = lowerPoints['R1M']
  const lL = lowerPoints['L1M']
  if (!uR || !uL || !lR || !lL) return null

  const upperMidX = (uR.x + uL.x) / 2
  const lowerMidX = (lR.x + lL.x) / 2
  return parseFloat(Math.abs(upperMidX - lowerMidX).toFixed(2))
}

/**
 * Before/After improvement — computes per-landmark displacement between
 * pre-treatment and post-treatment placedPoints for the same slot.
 *
 * Returns array of { name, pre, post, displacement } sorted descending.
 */
export function calcLandmarkImprovement(preSlotPoints, postSlotPoints) {
  const names = Object.keys(preSlotPoints).filter(n => postSlotPoints[n])
  return names
    .map(name => ({
      name,
      pre: preSlotPoints[name],
      post: postSlotPoints[name],
      displacement: dist3(preSlotPoints[name], postSlotPoints[name]),
    }))
    .sort((a, b) => b.displacement - a.displacement)
}

/**
 * Summary of all PAR-relevant measurements given all three slot placedPoints.
 * Returns { overjet, overbite, centerlineDeviation } — all in mm.
 */
export function calcAllMeasurements(upperPoints, lowerPoints) {
  return {
    overjet:             calcOverjet(upperPoints, lowerPoints),
    overbite:            calcOverbite(upperPoints, lowerPoints),
    centerlineDeviation: calcCenterlineDeviation(upperPoints, lowerPoints),
  }
}