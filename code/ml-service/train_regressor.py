"""
Trains the PAR-score regressor.

This is the ONE part of the pipeline that is real, trained, supervised ML
— because it's the one part with a learnable target. A single PAR score
per case IS enough signal to fit a regression model (unlike landmark
coordinates, which need ~150+ numbers of "signal" per case that a single
score can't provide — see README.md).

Data source: only APPROVED training_sets, each contributing one
(feature_vector, true_par_score) pair — the true_par_score is exactly the
value the undergraduate already uploaded and the orthodontist already
verified by approving the case. No extra work by anyone.

With ~20 samples, a small linear/ridge model is the right choice — enough
capacity to find a genuine relationship, not enough to memorise noise the
way a deep net would. As more approved cases accumulate, this script can
simply be rerun; it always retrains from the full current approved pool
(no old case ever needs to be revisited or relabelled).
"""
import json
import os
from datetime import datetime

import numpy as np
import pymysql
from sklearn.linear_model import Ridge
from sklearn.model_selection import LeaveOneOut, cross_val_score
import joblib

from features import extract_features, features_to_vector, FEATURE_NAMES

MODEL_DIR = os.environ.get("MODEL_DIR", "/models")
UPLOADS_DIR = os.environ.get("UPLOADS_DIR", "/uploads")
MIN_SAMPLES = int(os.environ.get("MIN_SAMPLES", "8"))

DB_CONFIG = dict(
    host=os.environ.get("DB_HOST", "db"),
    port=int(os.environ.get("DB_PORT", "3306")),
    user=os.environ.get("DB_USER", "paruser"),
    password=os.environ.get("DB_PASS", "parpass"),
    database=os.environ.get("DB_NAME", "par_system"),
)


def fetch_approved_cases(conn):
    """
    Every APPROVED training set that has BOTH an upper and a lower model
    uploaded, with its ground_truth_par.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ts.id, ts.ground_truth_par,
                   MAX(CASE WHEN mf.slot='UPPER' THEN mf.storage_path END) as upper_path,
                   MAX(CASE WHEN mf.slot='LOWER' THEN mf.storage_path END) as lower_path
            FROM training_sets ts
            JOIN model3d_files mf ON mf.training_set_id = ts.id
            WHERE ts.status = 'APPROVED'
            GROUP BY ts.id, ts.ground_truth_par
            """
        )
        rows = cur.fetchall()

    cases = []
    for set_id, par, upper_rel, lower_rel in rows:
        if not upper_rel or not lower_rel:
            continue
        upper_path = os.path.join(UPLOADS_DIR, upper_rel)
        lower_path = os.path.join(UPLOADS_DIR, lower_rel)
        if not os.path.exists(upper_path) or not os.path.exists(lower_path):
            print(f"  [skip] set {set_id}: mesh file(s) missing on disk")
            continue
        cases.append({"training_set_id": set_id, "par": float(par),
                       "upper_path": upper_path, "lower_path": lower_path})
    return cases


def record_model_version(conn, version_label: str, n_samples: int, notes: str):
    with conn.cursor() as cur:
        cur.execute("UPDATE ml_model_versions SET is_active = FALSE")
        cur.execute(
            """
            INSERT INTO ml_model_versions
                (version_label, training_set_count, method, notes, is_active)
            VALUES (%s, %s, %s, %s, TRUE)
            """,
            (version_label, n_samples, "PAR_REGRESSOR_RIDGE", notes),
        )
    conn.commit()


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)
    conn = pymysql.connect(**DB_CONFIG)

    try:
        cases = fetch_approved_cases(conn)
        print(f"Found {len(cases)} usable APPROVED cases (upper+lower model present).")

        if len(cases) < MIN_SAMPLES:
            print(f"Need at least {MIN_SAMPLES} approved cases to (re)train the PAR regressor, "
                  f"have {len(cases)}. Leaving any existing model untouched.")
            return

        X, y = [], []
        for case in cases:
            feat = extract_features(case["upper_path"], case["lower_path"])
            X.append(features_to_vector(feat))
            y.append(case["par"])
        X = np.array(X)
        y = np.array(y)

        model = Ridge(alpha=1.0)

        # Leave-one-out CV — the right choice for ~20 samples, gives an
        # honest estimate of real-world accuracy without needing a
        # separate held-out set (which we can't afford to spare at this
        # sample size).
        cv_scores = cross_val_score(model, X, y, cv=LeaveOneOut(), scoring="neg_mean_absolute_error")
        mean_abs_error = -cv_scores.mean()
        print(f"Leave-one-out CV mean absolute error: {mean_abs_error:.2f} PAR points "
              f"(n={len(cases)})")

        model.fit(X, y)

        version_label = "v" + datetime.utcnow().strftime("%Y%m%d%H%M%S")
        joblib.dump(model, os.path.join(MODEL_DIR, "par_regressor.joblib"))
        with open(os.path.join(MODEL_DIR, "par_regressor_meta.json"), "w") as f:
            json.dump({
                "version": version_label,
                "n_samples": len(cases),
                "feature_names": FEATURE_NAMES,
                "cv_mean_abs_error": float(mean_abs_error),
                "trained_at": datetime.utcnow().isoformat(),
            }, f)

        record_model_version(conn, version_label, len(cases), f"LOO-CV MAE={mean_abs_error:.2f}")
        print(f"Model version {version_label} saved. Call POST /reload on ml-service to pick it up.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
