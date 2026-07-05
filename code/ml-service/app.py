"""
ML microservice — redesigned around zero orthodontist annotation work.

Two independent capabilities:

  1. /predict — automatic GEOMETRIC landmark detection (geometry.py).
     Not a trained model. Works immediately on any mesh, from the very
     first upload, with zero training data. This is what makes "no
     manual landmark placement, ever" possible.

  2. /predict-par — a trained ML regressor (features.py + train_regressor.py)
     that estimates the PAR score directly from automatically-computed
     mesh features. This IS real supervised ML, trained on the approved
     training cases' (features, true PAR score) pairs. Returns a
     "not enough approved cases yet" message until MIN_SAMPLES is met —
     that's expected and handled gracefully by the backend/frontend.

Every landmark /predict returns is written back by the backend as
UNCONFIRMED — a clinician always reviews before it affects a real PAR
score (see LandmarkPoint.confirmed in the Java backend).
"""
import json
import os

import joblib
import numpy as np
from flask import Flask, jsonify, request

from geometry import detect_landmarks_for_slot
from features import extract_features, features_to_vector

app = Flask(__name__)

MODEL_DIR = os.environ.get("MODEL_DIR", "/models")
_regressor_cache = {}


def load_regressor():
    if "model" in _regressor_cache:
        return _regressor_cache["model"], _regressor_cache["meta"]

    model_path = os.path.join(MODEL_DIR, "par_regressor.joblib")
    meta_path = os.path.join(MODEL_DIR, "par_regressor_meta.json")
    if not os.path.exists(model_path) or not os.path.exists(meta_path):
        return None, None

    model = joblib.load(model_path)
    with open(meta_path) as f:
        meta = json.load(f)
    _regressor_cache["model"] = model
    _regressor_cache["meta"] = meta
    return model, meta


@app.route("/health", methods=["GET"])
def health():
    _, meta = load_regressor()
    return jsonify({
        "status": "ok",
        "landmark_detector": "always available (geometric, no training required)",
        "par_regressor_trained": meta is not None,
        "par_regressor_meta": meta,
    })


@app.route("/predict", methods=["POST"])
def predict():
    """Geometric landmark detection — no template, no training data required."""
    body = request.get_json(force=True)
    slot = body.get("slot")
    mesh_path = body.get("meshPath")

    if not slot or not mesh_path:
        return jsonify({"error": "slot and meshPath are required"}), 400
    if not os.path.exists(mesh_path):
        return jsonify({"error": f"Mesh file not found: {mesh_path}"}), 404

    try:
        raw_points = detect_landmarks_for_slot(mesh_path, slot)
    except Exception as e:
        return jsonify({"error": f"Landmark detection failed: {e}"}), 500

    points = [
        {"name": name, "x": p["x"], "y": p["y"], "z": p["z"]}
        for name, p in raw_points.items()
    ]
    confidences = [p["confidence"] for p in raw_points.values()]

    return jsonify({
        "modelVersion": "geometric-v1",
        "confidence": round(float(np.mean(confidences)) if confidences else 0.0, 3),
        "points": points,
    })


@app.route("/predict-par", methods=["POST"])
def predict_par():
    """
    ML PAR-score estimate from automatically-computed mesh features.
    Returns 503 with a clear message if the regressor hasn't been trained
    yet (fewer than MIN_SAMPLES approved cases so far) — this is an
    expected, non-error state early in the project's data collection.
    """
    body = request.get_json(force=True)
    upper_path = body.get("upperMeshPath")
    lower_path = body.get("lowerMeshPath")

    if not upper_path or not lower_path:
        return jsonify({"error": "upperMeshPath and lowerMeshPath are required"}), 400

    model, meta = load_regressor()
    if model is None:
        return jsonify({
            "error": "PAR regressor not trained yet. Approve more training cases, "
                     "then run train_regressor.py. This estimate is optional — "
                     "the geometric PAR calculation works independently of this."
        }), 503

    try:
        feat = extract_features(upper_path, lower_path)
        vec = features_to_vector(feat).reshape(1, -1)
        estimate = float(model.predict(vec)[0])
    except Exception as e:
        return jsonify({"error": f"PAR estimation failed: {e}"}), 500

    return jsonify({
        "estimatedPar": round(estimate, 1),
        "modelVersion": meta["version"],
        "trainedOnSamples": meta["n_samples"],
        "crossValidationMeanAbsError": meta["cv_mean_abs_error"],
    })


@app.route("/reload", methods=["POST"])
def reload_models():
    """Clears the in-memory regressor cache so a freshly-trained model is picked up without a restart."""
    _regressor_cache.clear()
    return jsonify({"message": "Model cache cleared."})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
