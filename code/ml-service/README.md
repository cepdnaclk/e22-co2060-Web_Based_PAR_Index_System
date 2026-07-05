# ML Service — Redesigned for Zero Orthodontist Annotation

## Why this design

Requirement: orthodontist workload = approve/reject only. No manual
landmark placement, ever, for training or review of old cases.

**The core constraint that shapes everything here:** a single PAR score
per case cannot mathematically determine ~150+ landmark coordinate
values — there's no unique solution, so there's nothing for a model to
learn landmark *positions* from using only (mesh, PAR score) pairs. That
rules out training a landmark-coordinate model from this data, no matter
how it's approached.

So the pipeline is split into two genuinely different problems:

### 1. Landmark detection — geometric, not learned (`geometry.py`)

Detects landmarks the way a person would describe them geometrically:
- Cusp tips / incisal edges -> local curvature maxima on the mesh surface
- Contact points -> high local point-density regions along the arch
- Occlusal fit -> nearest-point distance between upper and lower meshes

**No training data required — works from the very first upload.** This
is what makes the "no manual annotation, ever" requirement achievable:
there's no cold-start period where the system needs 20 hand-labelled
cases before it can do anything.

Tradeoff: less accurate than a well-trained supervised model on unusual
anatomy (missing teeth, severe crowding, impactions). Mitigated by the
existing review step — every detected point is written back as
`LandmarkPoint(source=ML_PREDICTED, confirmed=false)`, so a clinician
always has the chance to adjust before it affects a real score.

### 2. PAR-score estimate — real trained ML (`features.py` + `train_regressor.py`)

This IS supervised machine learning, because a PAR score (a single
number) is exactly the kind of target that one number *can* predict.

- **Input**: an automatically-computed feature vector per case (mesh
  curvature statistics, upper/lower gap distances, bounding-box
  measurements, left/right asymmetry proxy) — same computation, every
  case, zero manual work.
- **Target**: the `ground_truth_par` the undergraduate already uploaded
  and the orthodontist already verified by approving the case.
- **Model**: Ridge regression. Deliberately small/regularised — with
  ~20 samples a deep model would just memorise noise; a linear model
  with L2 regularisation is the right capacity for this data size.
- **Retraining**: rerun `train_regressor.py` whenever more cases are
  approved. It always retrains from the full current approved pool — no
  old case is ever revisited or needs relabelling.

This estimate is informational — it runs *alongside* the existing
geometric `GeometricPARService` calculation in the Java backend, as a
cross-check, not a replacement.

## Data safety guarantee

`train_regressor.py`'s query filters `WHERE ts.status = 'APPROVED'` at
the SQL level — pending/rejected uploads can never become training data.

## Running training

```bash
python train_regressor.py
# needs at least MIN_SAMPLES (default 8) approved cases with both
# UPPER and LOWER models present; otherwise it leaves any existing
# model untouched and tells you how many more you need.

curl -X POST http://localhost:5001/reload   # picks up a freshly-trained model
```

## API

`GET /health` — always available; also reports whether the PAR
regressor has been trained yet.

`POST /predict` — geometric landmark detection (always available, no
training required):
```json
{ "slot": "UPPER", "meshPath": "/uploads/clinical/42/upper_....stl" }
```

`POST /predict-par` — ML PAR-score estimate (available once the
regressor has been trained on >= MIN_SAMPLES approved cases):
```json
{ "upperMeshPath": "/uploads/.../upper.stl", "lowerMeshPath": "/uploads/.../lower.stl" }
```
Returns `503` with a clear message if not trained yet — this is an
expected, non-error state early on, and the geometric PAR calculation in
the Java backend works completely independently of it.

## Growing over time

As more cases are approved, only `train_regressor.py` needs rerunning —
no orthodontist action, no old-case relabelling. If accuracy needs to go
further than a linear model allows, the natural upgrade (same feature
vectors, same zero-annotation data pipeline) is gradient-boosted trees
(e.g. `sklearn.ensemble.GradientBoostingRegressor`) once there's enough
data (rule of thumb: 50+ samples) to justify the extra capacity.
