# Landmark detection — fix summary

Your project already had almost everything built. These files close the
actual gap: a real geometric landmark-detection endpoint, 3 wiring bugs
that were silently breaking the connection between Spring Boot and the ML
service, and the missing auto-trigger that means points now populate
automatically instead of requiring manual placement.

## New file
- `ml_service/app/core/landmark_detector.py` — geometric landmark detector.
  Produces every named point `GeometricPARService.java` requires (R3M,
  R1Mid, R6MB, LCover, etc.) from the mesh surface using a PCA-based arch
  frame + nearest-surface-vertex snapping. No trained landmark model
  exists in this project (only a total-PAR regressor does, in
  `model_store.py`), so this is a geometric approximation, not a learned
  prediction — confidence is deliberately reported as 0.35.

## Modified: `ml_service/app/main.py`
Added two endpoints your Java code already expected but that didn't exist:
- `POST /predict-landmarks` — `{slot, meshPath}` → named 3D points
- `POST /predict-par` — returns 503 by design (see code comment)

## Modified: 3 wiring bugs in existing Java files
1. **`MlPredictionService.java`** — was POSTing to the wrong endpoint
   with no auth header (always 403). Fixed.
2. **`MLClientService.java`** — wrong Spring property keys
   (`ml.service.url` vs the real `app.ml.service-url`). Fixed.
3. **`MLService.java`** — same wrong-key bug. Fixed.

## NEW: automated point placement (this round's fix)
This was the missing piece behind "points are still adding manually":
the ML landmark prediction (`MlPredictionService.predictForCase()`) was
fully built and correctly designed — it geometrically predicts points and
saves them as `ML_PREDICTED` / `confirmed=false`, without ever touching
clinician-confirmed points — but **nothing ever called it**. Only the
total-PAR *score* prediction was wired to auto-run on upload; the
landmark *points* prediction had no trigger at all, so the frontend's
landmark viewer always started empty and the clinician had to click every
point by hand.

- **`CaseController.java`** — `triggerMLPredictionAsync()` now also calls
  `mlPredictionService.predictForCase()` right after all 3 models are
  uploaded, in the same background task as the existing total-PAR call.
  If landmark prediction fails (e.g. ml-service down, corrupt mesh), it
  logs a warning and the total-PAR prediction still runs — the two are
  independent.
- **`LandmarkDto.java` / `LandmarkService.java`** — `GET /landmarks` now
  also returns `source` (`MANUAL` / `ML_PREDICTED`) and `confirmed`, so
  the frontend can (optionally) show a "predicted, please review" badge.
  Your frontend's `ThreeDAutoScore.jsx` **already** fetches and restores
  stored landmarks on mount (that code existed already) — it was just
  never getting anything back because nothing populated the table. No
  frontend changes were needed for the core automation to work; the two
  pieces just weren't connected until now.

### What the clinician experience becomes
1. Upload UPPER/LOWER/BUCCAL models.
2. Points are geometrically predicted and saved in the background —
   no manual clicking through 40+ landmarks per case.
3. Opening the 3D landmark panel now shows those points already placed,
   ready to review/nudge instead of place from scratch.
4. Clicking "Save slot" (existing `submitPoints` flow) re-saves them as
   `MANUAL` / `confirmed=true` — this is how confirmation already worked,
   unchanged.
5. Auto-calculate PAR from confirmed points, as before.

## To apply
Drop these files into the matching paths in your actual repo (overwrite
the originals), rebuild both containers, and redeploy:

```
docker compose build backend ml-service
docker compose up -d
```

## Known limitation, stated plainly
The detector is geometric, not trained — it will be less accurate than a
model trained on labeled landmark data, especially on unusual arch
shapes. That's exactly why predicted points still land as unconfirmed and
still require a clinician's review before counting toward a final score —
automation removes the manual placement grind, not the clinical
sign-off.

## Also worth doing
`ml_service/.env` in your zip has real committed secrets (DB password,
JWT/ML secret keys). Get that out of version control, rotate the
credentials, and use a `.env.example` with placeholders instead.

## UPDATE: point placement was geometrically wrong (this round's fix)

Confirmed by comparing your `GeometricPARService.java` against the
senior zip's `ParScoreService.java` (which — unlike the rest of that zip
— does contain a real, working PAR formula). Both hard-code:

    x = transverse (left/right)
    y = anteroposterior
    z = vertical (occlusal-gingival)

`landmark_detector.py` v1 ignored this — it built a PCA-derived frame per
mesh instead of using the file's actual x/y/z, so predicted points could
come out rotated relative to what the scoring math assumes. It also told
buccal cusps apart from palatal/lingual cusps by height, which isn't
anatomically correct (they sit at similar heights; they differ by
distance from the arch centerline toward cheek vs. tongue).

v2 (this file) fixes both: it uses the mesh's native x/y/z directly, and
splits buccal/palatal points by `|x - arch_center_x|` instead of z.

**One assumption you need to verify against a real scan**: which sign of
x is the patient's right side can't be determined from geometry alone —
it depends on how your scanner/export orients meshes. `landmark_detector.py`
has a `RIGHT_IS_NEGATIVE_X` constant at the top with a comment: if
predicted "R" points land on the anatomical left side (or vice versa),
flip that one constant — it will mirror every point back to the correct
side in one change, rather than needing per-point fixes.

## UPDATE: points floating off the model entirely (this round's fix)

Root cause: a coordinate-space mismatch, not a placement-algorithm bug.
`STLViewer.jsx` re-centers each mesh to the origin and rescales it to an
80-unit box purely for display (`geo.translate(-center)`, then
`mesh.scale.setScalar(80/maxDim)`). Manually-clicked points are captured
via a Three.js raycast against the already-transformed mesh, so they land
correctly. `landmark_detector.py` was returning raw, untransformed STL
coordinates — so predicted points rendered nowhere near the visually
shifted/rescaled model (exactly the "points floating away from the arch"
screenshots).

Fixed: `detect_arch_landmarks()` now applies the identical center+scale
transform as the frontend before returning points, so predicted and
manually-placed points live in the same coordinate space.

**Fragile coupling to flag**: the transform hardcodes `80` to match
`STLViewer.jsx`'s display box size. If that frontend constant ever
changes, this Python constant needs to change with it, or the mismatch
comes back. Longer-term, the more robust fix is to never bake a display
transform into stored coordinates at all — but that's a coordinated
frontend+backend change beyond this round's scope.

## Separate issue: "3D viewer lost GPU context"

Your screenshots also show a WebGL context-loss error. This is unrelated
to the coordinate bug above — it's the browser's GPU driver giving up,
most likely from the combination of very large meshes (1.5M+ vertices,
flagged "High complexity" in your own UI) with `shadowMap.enabled = true`
and `castShadow`/`receiveShadow` on that geometry. Shadow-mapping a mesh
that size is expensive on any GPU. Once context is lost, everything you
see afterward (the flat blob shapes, disconnected markers) is a broken
fallback render, not a true picture of your data.

Not fixed in this round — options worth considering: decimate/simplify
meshes above a vertex threshold before sending them to the viewer,
disable shadows for high-vertex meshes, or add a "reduce quality" mode
triggered by the same `vCount > MAX_VERTICES` check that already exists
in `STLViewer.jsx`.

## UPDATE: all points landing on one side (this round's fix)

Two candidate explanations, worth stating honestly:

1. Your screenshots all show the "3D viewer lost GPU context" banner —
   once that fires, whatever's on screen is a frozen/broken render, not
   necessarily an accurate picture of the real coordinates. This alone
   could explain the visual.
2. A real, verifiable gap regardless: every function in
   `landmark_detector.py` derived the arch's left-right range from raw
   `x.min()`/`x.max()` across ALL mesh vertices. Real intraoral scans this
   large (1.5-1.7M vertices in your screenshots) commonly include more
   than the tooth arch — retractor tissue, scan-bed geometry, floating
   noise vertices, disconnected islands from the scan process. A handful
   of stray vertices far to one side blows out the bounding box, so
   fractional landmark positions (computed as fractions between that
   min and max) mostly land in empty outlier space and get nearest-
   vertex-snapped toward wherever the real tooth geometry actually is —
   which looks exactly like "everything bunched on one side."

Fixed regardless, since it's a legitimate robustness gap either way:
added `_remove_outliers()`, which clips to the 1st-99th percentile per
axis before any landmark search runs. The final display-transform step
(center + scale, from last round's fix) still uses the FULL unfiltered
vertex set on purpose — it has to match Three.js's
`geo.computeBoundingBox()` on the frontend, which sees the whole mesh
including any noise, or the coordinate-space fix breaks again.

Verified against a synthetic mesh with injected outlier vertices far to
one side: previously this would have collapsed the arch; landmarks now
stay spread correctly across the full left-right range.

**Still can't fully rule out #1** without a version of the app where the
viewer hasn't already crashed. Worth checking after this fix: does the
GPU-context-loss error still happen? If so, that's the frontend/mesh-size
issue flagged in the previous round, separate from this fix.

## UPDATE: upper wrong, lower correct (this round's fix)

Real, verifiable bug, and the evidence pointed straight at it: the two
screenshots showed genuinely different mesh orientations (lower a normal
wide U-shape, upper narrow and vertically elongated). Upper and lower
arch STL exports frequently aren't oriented the same way relative to
each other -- a real, common scanner quirk (you scan looking down into
the lower arch, up into the upper arch). `landmark_detector.py` hard-
assumed raw column 0=x=transverse, 1=y=AP, 2=z=vertical identically for
every file. That held for lower in this case and not for upper.

Fixed: `_detect_axis_roles()` now picks each mesh's transverse/AP/vertical
columns by range (widest = transverse, next = AP, narrowest = vertical)
instead of assuming column order, per mesh. All downstream logic
(anterior sequence, molar/premolar cusp detection, buccal reference
points) now reads from the detected axis indices instead of hardcoded
x/y/z. Verified against a synthetic test with the transverse/AP columns
swapped (simulating a differently-oriented export) -- detection still
correctly finds and spreads points across the real transverse axis.

`RIGHT_IS_NEGATIVE_TRANSVERSE` (the R/L sign flag from an earlier round)
is now keyed per slot (`UPPER`/`LOWER`/`BUCCAL`) instead of one global
constant, since upper/lower being mirrored relative to each other means
their correct sign could differ too. If predicted points still land
mirrored (right-side points on the anatomical left) for a specific slot,
flip that slot's entry in this dict -- same one-line fix as before, now
scoped correctly.
