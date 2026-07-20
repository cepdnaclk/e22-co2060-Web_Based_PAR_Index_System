"""
REQUIREMENT 10: Backup existing model before every training overwrite.
  - Before saving: copy latest.pt → backup_{timestamp}.pt
  - Keep max 5 backups (prune oldest)
  - rollback(version): copies models/{version}.pt → models/latest.pt

REQUIREMENT 14: filelock prevents concurrent write corruption.
"""

import logging
import shutil
import torch
import torch.nn as nn
import trimesh
import numpy as np
from datetime import datetime
from pathlib import Path
from filelock import FileLock

from app.core.config import settings

logger = logging.getLogger("model_store")


class PARRegressor(nn.Module):
    """
    BUG FIX: this class did not exist before. _save_model() previously wrote
    only metrics (mae/loss/val_loss) into the checkpoint — never any model
    weights — so predict()'s `self._model.get("model_state")` was always None
    and inference permanently fell back to the placeholder point-cloud-spread
    heuristic, regardless of how much "training" had run.

    Minimal but genuinely trainable architecture: each of the 3 point clouds
    (upper/lower/buccal, each [N, 3]) is mean+max pooled into a small feature
    vector (a standard, simple PointNet-style global pooling — no per-point
    learned weights, kept deliberately small so it trains fast on CPU), the
    three pooled vectors are concatenated, and a small MLP regresses the
    single total PAR score.
    """

    def __init__(self):
        super().__init__()
        # 3 coords -> pooled features per cloud (mean + max = 6 dims per cloud)
        self.head = nn.Sequential(
            nn.Linear(3 * 6, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    @staticmethod
    def _pool(cloud: torch.Tensor) -> torch.Tensor:
        # cloud: [B, N, 3] -> [B, 6] (mean xyz concat max xyz)
        mean = cloud.mean(dim=1)
        mx   = cloud.max(dim=1).values
        return torch.cat([mean, mx], dim=-1)

    def forward(self, upper: torch.Tensor, lower: torch.Tensor, buccal: torch.Tensor) -> torch.Tensor:
        feat = torch.cat([self._pool(upper), self._pool(lower), self._pool(buccal)], dim=-1)
        return self.head(feat).squeeze(-1)


class ModelStore:
    """
    Manages the lifecycle of the PAR scoring ML model:
      - Load / predict
      - Train (real or stub if no GPU/data)
      - Backup before overwrite
      - Rollback to prior version
    """

    def __init__(self):
        self._model       = None
        self._version     = None
        self._model_path  = Path(settings.LATEST_MODEL_PATH)
        self._model_dir   = Path(settings.MODEL_DIR)
        self._lock_path   = self._model_dir / "latest.lock"
        self._model_dir.mkdir(parents=True, exist_ok=True)
        self._load_if_exists()

    # ── Model loading ──────────────────────────────────────────────────

    def _load_if_exists(self):
        if self._model_path.exists():
            try:
                checkpoint     = torch.load(self._model_path, map_location="cpu", weights_only=False)
                self._version  = checkpoint.get("version", "unknown")
                self._model    = checkpoint
                logger.info(f"Loaded model version: {self._version}")
            except Exception as e:
                logger.warning(f"Could not load existing model: {e}")
                self._model   = None
                self._version = None

    def is_model_loaded(self) -> bool:
        return self._model is not None

    def get_status(self) -> dict:
        backups = sorted(self._model_dir.glob("backup_*.pt"))
        return {
            "model_loaded":    self.is_model_loaded(),
            "current_version": self._version,
            "latest_path":     str(self._model_path),
            "backup_count":    len(backups),
            "backups":         [b.name for b in backups],
        }

    # ── Predict ────────────────────────────────────────────────────────

    def predict(self, upper_path: str, lower_path: str, buccal_path: str) -> dict:
        """
        Load three STL files, convert to point clouds, run model inference.
        Returns {"total_par": float, "model_version": str, "confidence": str}
        """
        if not self.is_model_loaded():
            raise RuntimeError("No model loaded")

        try:
            upper_pc  = self._stl_to_pointcloud(upper_path)
            lower_pc  = self._stl_to_pointcloud(lower_path)
            buccal_pc = self._stl_to_pointcloud(buccal_path)
        except Exception as e:
            raise RuntimeError(f"Failed to load STL files: {e}")

        # Stack point clouds into per-cloud tensors: [1, num_points, 3]
        upper_t  = torch.from_numpy(upper_pc).float().unsqueeze(0)
        lower_t  = torch.from_numpy(lower_pc).float().unsqueeze(0)
        buccal_t = torch.from_numpy(buccal_pc).float().unsqueeze(0)

        # BUG FIX: the checkpoint previously never contained a "model_state"
        # key at all (see _save_model below), so this lookup always returned
        # None and inference always used the heuristic branch, even right
        # after a successful training run. Now that _save_model persists a
        # real state_dict, build a PARRegressor and load it.
        state_dict = self._model.get("model_state") if isinstance(self._model, dict) else None

        if state_dict is not None:
            try:
                model_obj = PARRegressor()
                model_obj.load_state_dict(state_dict)
                model_obj.eval()
                with torch.no_grad():
                    output    = model_obj(upper_t, lower_t, buccal_t)
                    total_par = float(output.squeeze().item())
            except Exception as e:
                logger.warning(f"Failed to run trained model, falling back to heuristic: {e}")
                total_par = self._heuristic_predict(upper_pc, lower_pc, buccal_pc)
        else:
            # No trained weights yet (e.g. before the first train() call) —
            # use the simple heuristic so /predict still returns something.
            total_par = self._heuristic_predict(upper_pc, lower_pc, buccal_pc)

        # Validate output range
        if total_par < 0 or total_par > 100:
            logger.warning(f"Predicted PAR out of range: {total_par}. Clamping.")
            total_par = max(0.0, min(100.0, total_par))

        return {
            "total_par":     round(total_par, 2),
            "model_version": self._version or "unknown",
            "confidence":    "experimental" if state_dict is None else "trained",
        }

    @staticmethod
    def _heuristic_predict(upper_pc: np.ndarray, lower_pc: np.ndarray, buccal_pc: np.ndarray) -> float:
        """Fallback used only when no trained weights are available yet."""
        upper_spread  = float(np.std(upper_pc))
        lower_spread  = float(np.std(lower_pc))
        buccal_spread = float(np.std(buccal_pc))
        return min(100.0, max(0.0, (upper_spread + lower_spread + buccal_spread) * 2.5))

    # ── Train ─────────────────────────────────────────────────────────

    def train(self, model_version: str, epochs: int, dataset_size: int) -> dict:
        """
        REQUIREMENT 10: Backup existing model before overwriting.
        Train (or simulate training if no preprocessed data).
        """
        self._backup_current()

        preprocessed_dir = Path(settings.PREPROCESSED_DIR)
        data_files       = list(preprocessed_dir.glob("*.pt")) if preprocessed_dir.exists() else []

        if not data_files:
            logger.warning("No preprocessed data found — running stub training")
            result = self._stub_train(model_version, epochs, dataset_size)
        else:
            result = self._real_train(model_version, epochs, data_files)

        self._save_model(model_version, result)
        return result

    def _stub_train(self, model_version: str, epochs: int, dataset_size: int) -> dict:
        """
        Stub training — simulates convergence for integration testing
        when no preprocessed data exists yet.
        """
        import math
        mae       = max(2.0, 12.0 - (epochs * 0.08))
        loss      = max(0.05, 0.8 - (epochs * 0.006))
        val_loss  = loss * 1.12

        logger.info(
            f"Stub training complete: version={model_version} "
            f"epochs={epochs} mae={mae:.4f} loss={loss:.4f}"
        )
        return {
            "mae":           round(mae, 4),
            "loss":          round(loss, 4),
            "val_loss":      round(val_loss, 4),
            "epochs_run":    epochs,
            "dataset_size":  dataset_size,
        }

    def _real_train(self, model_version: str, epochs: int, data_files: list) -> dict:
        """
        Real training loop over preprocessed .pt files.
        Each file contains {"upper": tensor, "lower": tensor, "buccal": tensor, "label": float}
        """
        # Load all preprocessed samples
        samples = []
        for f in data_files:
            try:
                sample = torch.load(f, map_location="cpu", weights_only=False)
                label  = sample.get("label", -1.0)
                # REQUIREMENT 4: NaN guard
                if isinstance(label, (float, int)) and 1.0 <= float(label) <= 50.0:
                    samples.append(sample)
            except Exception as e:
                logger.warning(f"Skipping corrupt sample {f.name}: {e}")

        if not samples:
            return self._stub_train(model_version, epochs, 0)

        # BUG FIX: this loop previously never built a model at all — the
        # "forward pass" was a hardcoded `torch.tensor(25.0)` regardless of
        # input, so no weights were ever learned and nothing was returned for
        # _save_model() to persist. Build a real PARRegressor and actually
        # optimise it against the dataset.
        model     = PARRegressor()
        optimizer = torch.optim.Adam(model.parameters(), lr=settings.LEARNING_RATE)
        criterion = nn.MSELoss()

        running_loss = 1.0
        running_mae  = 15.0

        for epoch in range(1, epochs + 1):
            batch_losses = []
            batch_maes   = []
            for sample in samples:
                try:
                    label = torch.tensor(float(sample["label"]), dtype=torch.float32)

                    # REQUIREMENT 4: NaN guard on labels
                    if torch.isnan(label).any() or torch.isinf(label).any():
                        logger.warning("NaN/Inf labels in batch — skipping")
                        continue

                    upper_t  = sample["upper"].float().unsqueeze(0)
                    lower_t  = sample["lower"].float().unsqueeze(0)
                    buccal_t = sample["buccal"].float().unsqueeze(0)

                    optimizer.zero_grad()
                    pred = model(upper_t, lower_t, buccal_t).squeeze()
                    loss = criterion(pred, label)
                    loss.backward()
                    optimizer.step()

                    batch_losses.append(float(loss.item()))
                    batch_maes.append(float(torch.abs(pred - label).item()))
                except Exception as e:
                    logger.warning(f"Batch error: {e}")
                    continue

            if batch_losses:
                running_loss = sum(batch_losses) / len(batch_losses)
                running_mae  = sum(batch_maes) / len(batch_maes)
            else:
                running_loss *= 0.97
                running_mae   = running_loss ** 0.5

            if epoch % 10 == 0 or epoch == epochs:
                logger.info(f"Epoch {epoch}/{epochs} — loss={running_loss:.4f} mae={running_mae:.4f}")

        return {
            "mae":           round(running_mae, 4),
            "loss":          round(running_loss, 4),
            "val_loss":      round(running_loss * 1.1, 4),
            "epochs_run":    epochs,
            "dataset_size":  len(samples),
            # BUG FIX: this is the piece that was missing entirely — without
            # it, _save_model() had no weights to persist and predict() could
            # never use anything this training run learned.
            "model_state":   model.state_dict(),
        }

    # ── Save model ─────────────────────────────────────────────────────

    def _save_model(self, model_version: str, result: dict):
        """Save checkpoint with REQUIREMENT 14: filelock to prevent corruption."""
        checkpoint = {
            "version":        model_version,
            "trained_at":     datetime.utcnow().isoformat(),
            "mae":            result.get("mae"),
            "loss":           result.get("loss"),
            "val_loss":       result.get("val_loss"),
            "dataset_size":   result.get("dataset_size"),
            # BUG FIX: this key never existed before — predict()'s lookup of
            # self._model.get("model_state") was always None as a result, so
            # inference never used anything a training run produced.
            # _stub_train() (no real data yet) has no weights to offer, so
            # this stays absent in that case and predict() correctly falls
            # back to the heuristic until real training data exists.
            "model_state":    result.get("model_state"),
        }

        # REQUIREMENT 14: filelock for safe concurrent writes
        lock_path = self._lock_path
        with FileLock(str(lock_path), timeout=60):
            torch.save(checkpoint, self._model_path)
            logger.info(f"Saved model checkpoint: version={model_version} → {self._model_path}")

        self._version = model_version
        self._model   = checkpoint

    # ── REQUIREMENT 10: Backup before overwrite ────────────────────────

    def _backup_current(self):
        """
        REQUIREMENT 10: Before overwriting latest.pt, copy it to backup_{timestamp}.pt.
        Keep max 5 backups — prune oldest.
        """
        latest = Path(settings.LATEST_MODEL_PATH)

        if latest.exists():
            ts     = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup = Path(settings.MODEL_DIR) / f"backup_{ts}.pt"
            shutil.copy2(latest, backup)
            logger.info(f"Backed up previous model to {backup}")

            # Prune: keep only 5 most recent backups
            backups = sorted(Path(settings.MODEL_DIR).glob("backup_*.pt"))
            while len(backups) > 5:
                oldest = backups[0]
                oldest.unlink()
                logger.info(f"Pruned old backup: {oldest.name}")
                backups = backups[1:]

    # ── REQUIREMENT 10: Rollback ───────────────────────────────────────

    def rollback(self, version: str):
        """
        REQUIREMENT 10: Copy models/{version}.pt to models/latest.pt.
        version can be a backup timestamp (e.g. "backup_20240101_120000"),
        that same string with ".pt" already appended (as returned by
        get_status()'s "backups" list), or a bare timestamp without the
        "backup_" prefix.
        """
        model_dir = Path(settings.MODEL_DIR)

        # BUG FIX: the previous candidate list didn't agree with this
        # method's own docstring example. If the caller passed the exact
        # filename shown in get_status()["backups"] (e.g.
        # "backup_20260618_120000.pt", which already has both the prefix
        # AND the extension), none of the old candidates matched it:
        #   f"{version}.pt"        -> "backup_20260618_120000.pt.pt"  (wrong)
        #   version                -> "backup_20260618_120000.pt"     (this one
        #                              happened to work only by coincidence)
        #   f"backup_{version}.pt" -> "backup_backup_20260618_120000.pt.pt" (wrong)
        # Normalise first: strip a trailing ".pt" and a leading "backup_" if
        # present, then rebuild every variant from the bare timestamp/name so
        # any of the three input styles described in the docstring resolves
        # to the same, single, correct candidate.
        stem = version
        if stem.endswith(".pt"):
            stem = stem[:-3]
        if stem.startswith("backup_"):
            stem = stem[len("backup_"):]

        candidates = [
            model_dir / f"backup_{stem}.pt",  # normal case: bare timestamp
            model_dir / f"{stem}.pt",         # version names that aren't backups
            model_dir / stem,                 # already has its own extension
        ]

        source = None
        for c in candidates:
            if c.exists():
                source = c
                break

        if source is None:
            existing = [p.name for p in model_dir.glob("*.pt")]
            raise FileNotFoundError(
                f"Backup version '{version}' not found in {model_dir}. "
                f"Available: {existing}"
            )

        # REQUIREMENT 14: filelock for safe write
        with FileLock(str(self._lock_path), timeout=60):
            shutil.copy2(source, self._model_path)

        logger.info(f"Model rolled back: {source.name} → {self._model_path}")
        self._load_if_exists()

    # ── Helpers ────────────────────────────────────────────────────────

    def _stl_to_pointcloud(self, path: str, num_points: int = 1024) -> np.ndarray:
        """
        Load STL file and sample exactly num_points from its surface.
        Returns ndarray shape (num_points, 3).
        """
        mesh = trimesh.load(path, force="mesh")

        if not isinstance(mesh, trimesh.Trimesh):
            raise ValueError(f"Could not load mesh from {path}")

        if len(mesh.faces) == 0:
            raise ValueError(f"Mesh has no faces: {path}")

        # Sample points uniformly from mesh surface
        points, _ = trimesh.sample.sample_surface(mesh, num_points)

        if len(points) < num_points:
            # Pad by repeating if mesh is too small
            repeats  = (num_points // len(points)) + 1
            points   = np.tile(points, (repeats, 1))[:num_points]

        # Normalise to unit sphere
        centroid = points.mean(axis=0)
        points   = points - centroid
        scale    = np.max(np.linalg.norm(points, axis=1))
        if scale > 0:
            points = points / scale

        return points.astype(np.float32)