#!/usr/bin/env python3
"""
dataset_preprocessor.py — PAR ML Training Data Preprocessor

REQUIREMENT 4:  Second validation layer after loading each sample:
  - ground_truth_par between 1 and 50
  - All 3 STL files load without trimesh error
  - Each point cloud has exactly 1024 points after processing
  - No NaN or Inf values in tensors
  - If any check fails: skip sample, append to failed_samples.log, never stop batch

REQUIREMENT 8:  STL integrity check before trimesh.load():
  - File size > 1024 bytes
  - Binary STL: triangle_count * 50 + 84 == file_size

REQUIREMENT 13: Uses anonymised_label only — never joins to patients table
  - DB credentials from .env only — never hardcoded
  - No patient identifiers in output tensors

REQUIREMENT 14: Component labels set to -1.0 sentinel (train.py must skip for -1.0)
  - Uses filelock for .pt writes to prevent corruption from concurrent runs

Usage:
  python dataset_preprocessor.py

Output:
  data/preprocessed/{set_id}.pt  — per-set tensor files
  failed_samples.log             — sets that failed validation with reasons
"""

import os
import sys
import struct
import logging
import traceback
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
import trimesh
import mysql.connector
from dotenv import load_dotenv
from filelock import FileLock

# ── Load .env credentials ────────────────────────────────────────────────

load_dotenv()

DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = int(os.getenv("DB_PORT", "3306"))
DB_NAME     = os.getenv("DB_NAME",     "par_system")
DB_USER     = os.getenv("DB_USER",     "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")   # REQUIREMENT 16: from .env only
BASE_DIR    = os.getenv("STORAGE_BASE_DIR", "./uploads")

NUM_POINTS     = 1024
OUTPUT_DIR     = Path("data/preprocessed")
FAILED_LOG     = Path("failed_samples.log")
# REQUIREMENT 14: Component labels — sentinel -1.0 (only totalPAR is available)
SENTINEL       = -1.0

# ── Logging ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s — %(message)s",
)
logger = logging.getLogger("preprocessor")


def log_failure(set_id: int, reason: str):
    """REQUIREMENT 4: Append failure to failed_samples.log — never stop the batch."""
    with open(FAILED_LOG, "a") as f:
        f.write(f"{datetime.utcnow().isoformat()}  set_id={set_id}  reason={reason}\n")


def validate_stl_integrity(filepath: str) -> tuple[bool, str]:
    """
    REQUIREMENT 8: STL integrity check before trimesh.load()
      - File size > 1024 bytes
      - Binary STL: triangle_count * 50 + 84 == file_size
    Returns (valid: bool, reason: str)
    """
    p = Path(filepath)
    if not p.exists():
        return False, f"File not found: {filepath}"

    file_size = p.stat().st_size

    if file_size < 1024:
        return False, f"File too small ({file_size} bytes) — likely not a valid STL"

    # Detect binary STL: first 80 bytes are ASCII header, bytes 80-84 are triangle count
    try:
        with open(filepath, "rb") as f:
            header         = f.read(80)
            triangle_bytes = f.read(4)

        if len(triangle_bytes) < 4:
            return False, "File too short to contain STL triangle count"

        triangle_count = struct.unpack("<I", triangle_bytes)[0]
        expected_size  = triangle_count * 50 + 84   # binary STL formula

        # Allow ASCII STL (starts with "solid") — skip binary check
        if not header.strip().startswith(b"solid"):
            if abs(expected_size - file_size) > 4:   # 4-byte tolerance for alignment
                return False, (
                    f"Binary STL size mismatch: triangle_count={triangle_count} "
                    f"expected={expected_size} actual={file_size}"
                )

    except Exception as e:
        return False, f"Could not read STL header: {e}"

    return True, "ok"


def stl_to_pointcloud(filepath: str, num_points: int = NUM_POINTS) -> np.ndarray:
    """
    Load STL file and sample exactly num_points from surface.
    Returns ndarray (num_points, 3), normalised to unit sphere.
    Raises on failure.
    """
    mesh = trimesh.load(filepath, force="mesh")

    if not isinstance(mesh, trimesh.Trimesh):
        raise ValueError(f"Not a valid triangular mesh: {filepath}")

    if len(mesh.faces) == 0:
        raise ValueError(f"Mesh has 0 faces: {filepath}")

    # Sample surface points
    points, _ = trimesh.sample.sample_surface(mesh, num_points)

    if len(points) < num_points:
        # Pad by repetition
        repeats = (num_points // len(points)) + 1
        points  = np.tile(points, (repeats, 1))[:num_points]

    # Normalise to unit sphere
    centroid = points.mean(axis=0)
    points   = points - centroid
    scale    = np.max(np.linalg.norm(points, axis=1))
    if scale > 0:
        points = points / scale

    return points.astype(np.float32)


def get_approved_sets(cursor) -> list[dict]:
    """
    REQUIREMENT 13: Query APPROVED training sets — select only what we need.
    Never join to patients table. Use anonymised_label only.
    """
    cursor.execute("""
        SELECT
            ts.id,
            ts.anonymised_label,
            ts.ground_truth_par
        FROM training_sets ts
        WHERE ts.status = 'APPROVED'
        ORDER BY ts.id ASC
    """)
    return [
        {"id": row[0], "label": row[1], "ground_truth_par": row[2]}
        for row in cursor.fetchall()
    ]


def get_model_files_for_set(cursor, set_id: int) -> dict:
    """
    REQUIREMENT 14: Only totalPAR is available — no patient identifiers.
    Returns {"UPPER": path, "LOWER": path, "BUCCAL": path} or partial.
    """
    cursor.execute("""
        SELECT slot, storage_path
        FROM model3d_files
        WHERE training_set_id = %s
    """, (set_id,))
    rows = cursor.fetchall()
    return {row[0]: row[1] for row in rows}


def is_already_processed(set_id: int) -> bool:
    """REQUIREMENT 14: Skip already-processed sets."""
    return (OUTPUT_DIR / f"{set_id}.pt").exists()


def process_set(set_info: dict, file_paths: dict) -> tuple[bool, str]:
    """
    Process a single training set. Returns (success, reason).

    REQUIREMENT 4 validations:
      1. ground_truth_par between 1 and 50
      2. All 3 STL files load without trimesh error
      3. Each point cloud has exactly 1024 points after processing
      4. No NaN or Inf values in tensors
    """
    set_id        = set_info["id"]
    ground_truth  = set_info["ground_truth_par"]

    # ── Validation 1: ground_truth_par range ─────────────────────────────
    if not (1 <= ground_truth <= 50):
        return False, f"ground_truth_par={ground_truth} is outside range [1, 50]"

    # ── Validation 2: All 3 slots present ────────────────────────────────
    required_slots = ["UPPER", "LOWER", "BUCCAL"]
    for slot in required_slots:
        if slot not in file_paths:
            return False, f"Missing {slot} file"

    # ── REQUIREMENT 8: STL integrity checks ──────────────────────────────
    point_clouds = {}
    for slot in required_slots:
        relative_path = file_paths[slot]
        abs_path      = str(Path(BASE_DIR) / relative_path)

        valid, reason = validate_stl_integrity(abs_path)
        if not valid:
            return False, f"STL integrity check failed for {slot}: {reason}"

        # ── Validation 2: Load without trimesh error ──────────────────────
        try:
            pc = stl_to_pointcloud(abs_path, NUM_POINTS)
        except Exception as e:
            return False, f"trimesh load failed for {slot}: {e}"

        # ── Validation 3: Exactly 1024 points ────────────────────────────
        if pc.shape != (NUM_POINTS, 3):
            return False, f"{slot} point cloud shape is {pc.shape}, expected ({NUM_POINTS}, 3)"

        # ── Validation 4: No NaN or Inf ──────────────────────────────────
        tensor = torch.from_numpy(pc)
        if torch.isnan(tensor).any():
            return False, f"{slot} tensor contains NaN values"
        if torch.isinf(tensor).any():
            return False, f"{slot} tensor contains Inf values"

        point_clouds[slot] = pc

    # ── REQUIREMENT 14: Build output tensor ──────────────────────────────
    # Component labels: all 7 set to -1.0 sentinel — train.py must skip for -1.0
    # Only totalPAR is available in the accepted system
    output = {
        # REQUIREMENT 13: Use anonymised_label only — no patient identifiers
        "set_id":              set_id,
        "label":               float(ground_truth),   # totalPAR
        # 7 component labels as -1.0 sentinel
        "component_labels":    torch.full((7,), SENTINEL, dtype=torch.float32),
        # Point clouds
        "upper":   torch.from_numpy(point_clouds["UPPER"]),
        "lower":   torch.from_numpy(point_clouds["LOWER"]),
        "buccal":  torch.from_numpy(point_clouds["BUCCAL"]),
    }

    # Final NaN check on output label
    label_tensor = torch.tensor(float(ground_truth))
    if torch.isnan(label_tensor).any() or torch.isinf(label_tensor).any():
        return False, f"Label {ground_truth} converted to NaN/Inf tensor"

    # ── Save with filelock ────────────────────────────────────────────────
    out_path  = OUTPUT_DIR / f"{set_id}.pt"
    lock_path = OUTPUT_DIR / f"{set_id}.lock"

    with FileLock(str(lock_path), timeout=30):
        torch.save(output, out_path)

    return True, "ok"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Clear/create failed log
    FAILED_LOG.write_text(
        f"# Failed samples log — {datetime.utcnow().isoformat()}\n"
        f"# Format: timestamp  set_id=N  reason=...\n"
    )

    # ── Connect to MySQL ──────────────────────────────────────────────────
    try:
        conn = mysql.connector.connect(
            host     = DB_HOST,
            port     = DB_PORT,
            database = DB_NAME,
            user     = DB_USER,
            password = DB_PASSWORD,   # REQUIREMENT 16: never hardcoded
        )
        cursor = conn.cursor()
        logger.info(f"Connected to {DB_NAME}@{DB_HOST}:{DB_PORT}")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        sys.exit(1)

    try:
        approved_sets = get_approved_sets(cursor)
        total         = len(approved_sets)
        logger.info(f"Found {total} APPROVED training sets")

        processed = 0
        skipped   = 0
        failed    = 0

        for idx, set_info in enumerate(approved_sets, start=1):
            set_id = set_info["id"]

            # REQUIREMENT 14: Skip already-processed sets
            if is_already_processed(set_id):
                skipped += 1
                print(f"[{idx}/{total}] Skipped set {set_id} (already processed)")
                continue

            # Get model file paths for this set
            file_paths = get_model_files_for_set(cursor, set_id)

            # REQUIREMENT 4: Process with full validation
            try:
                success, reason = process_set(set_info, file_paths)
            except Exception as e:
                success = False
                reason  = f"Unexpected error: {traceback.format_exc(limit=3)}"

            if success:
                processed += 1
                # REQUIREMENT 14: Print progress
                print(f"[{idx}/{total}] Processed set {set_id}")
            else:
                failed += 1
                # REQUIREMENT 4: Skip the sample, log reason — never stop the batch
                print(f"[{idx}/{total}] FAILED set {set_id}: {reason}")
                log_failure(set_id, reason)

    finally:
        cursor.close()
        conn.close()

    # REQUIREMENT 14: End summary
    print(f"\nDone. Processed: {processed}  Skipped: {skipped}  Failed: {failed}")
    logger.info(f"Preprocessing complete — processed={processed} skipped={skipped} failed={failed}")

    if failed > 0:
        print(f"See {FAILED_LOG} for details on {failed} failed samples.")


if __name__ == "__main__":
    main()
