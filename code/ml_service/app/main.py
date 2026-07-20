"""
PAR ML Service — FastAPI main application.

REQUIREMENT 9:  Service key middleware — protects /train, /predict, /rollback
REQUIREMENT 5:  CORS includes port 8081 (Spring Boot port)
REQUIREMENT 9:  Rate limiting on /predict: max 10 calls/minute (slowapi)
REQUIREMENT 10: Model backup endpoint
"""

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
import shutil
import tempfile
import os
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

from app.core.config import settings
from app.core.model_store import ModelStore

# ── Logging ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(name)s — %(message)s",
)
logger = logging.getLogger("ml_service")

# ── Rate limiter (REQUIREMENT 9) ───────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="PAR ML Service",
    description="ML prediction service for PAR dental scoring system",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS (REQUIREMENT 5: include port 8081 for Spring Boot) ───────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8081",   # REQUIREMENT 5: Spring Boot port
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REQUIREMENT 9: Service key middleware ──────────────────────────────────

EXEMPT_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

MAX_UPLOAD_SIZE = 50 * 1024 * 1024

@app.middleware("http")
async def verify_service_key(request: Request, call_next):
    """
    REQUIREMENT 9: Protect all endpoints except /health, /docs, /openapi.json
    with X-ML-Service-Key header validation.
    """
    if request.url.path in EXEMPT_PATHS:
        return await call_next(request)

    key = request.headers.get("X-ML-Service-Key")
    if not settings.ML_SERVICE_SECRET:
        logger.error("ML_SERVICE_SECRET is not configured")
        raise HTTPException(status_code=503, detail="ML service secret is not configured.")
    if key != settings.ML_SERVICE_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized — invalid X-ML-Service-Key")

    return await call_next(request)

# ── Model store singleton ──────────────────────────────────────────────────

model_store = ModelStore()

# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check — exempt from auth (used by Spring Boot MLClientService)."""
    return {
        "status":  "ok",
        "service": "par-ml-engine",
        "model_loaded": model_store.is_model_loaded(),
    }


@app.get("/status")
async def status():
    """Return current model version, accuracy, and dataset count."""
    info = model_store.get_status()
    return info


@app.post("/predict")
@limiter.limit("10/minute")   # REQUIREMENT 9: Max 10 predictions/minute
async def predict(
    request:    Request,            # required by slowapi for limiter
    upperFile:  UploadFile = File(...),
    lowerFile:  UploadFile = File(...),
    buccalFile: UploadFile = File(...),
):
    """
    Predict PAR score from three STL files.
    REQUIREMENT 9: Rate limited to 10 calls/minute.
    """
    if not model_store.is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="No trained model available. Start a training run first."
        )

    # Write uploaded files to temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        upper_path  = tmpdir / "upper.stl"
        lower_path  = tmpdir / "lower.stl"
        buccal_path = tmpdir / "buccal.stl"

        for upload, path in [
            (upperFile,  upper_path),
            (lowerFile,  lower_path),
            (buccalFile, buccal_path),
        ]:
            content = await upload.read()
            if not content:
                raise HTTPException(status_code=400, detail=f"{upload.filename or 'file'} is empty.")
            if len(content) > MAX_UPLOAD_SIZE:
                raise HTTPException(status_code=413, detail="Uploaded file exceeds 50 MB.")
            path.write_bytes(content)

        try:
            result = model_store.predict(
                upper_path=str(upper_path),
                lower_path=str(lower_path),
                buccal_path=str(buccal_path),
            )
            return {
                "totalPAR":     result["total_par"],
                "modelVersion": result["model_version"],
                "confidence":   result.get("confidence", "unknown"),
            }
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/train")
async def train(request: Request):
    """
    Start model training.
    REQUIREMENT 10: Backs up existing model before overwriting.
    REQUIREMENT 11: Training logs available via status endpoint.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON.")
    model_version = body.get("model_version", "v1.0")
    try:
        epochs = int(body.get("epochs", 50))
        dataset_size = int(body.get("dataset_size", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="epochs and dataset_size must be integers.")

    if not model_version or not str(model_version).strip():
        raise HTTPException(status_code=400, detail="model_version is required.")
    if epochs < 1 or epochs > 500:
        raise HTTPException(status_code=400, detail="epochs must be 1–500")

    logger.info(f"Training started: version={model_version} epochs={epochs} dataset_size={dataset_size}")

    try:
        result = model_store.train(
            model_version=model_version,
            epochs=epochs,
            dataset_size=dataset_size,
        )
        logger.info(f"Training completed: version={model_version} mae={result.get('mae')} loss={result.get('loss')}")
        return {
            "status":        "COMPLETED",
            "model_version": model_version,
            "mae":           result.get("mae", 0.0),
            "loss":          result.get("loss", 0.0),
            "val_loss":      result.get("val_loss", 0.0),
        }
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@app.post("/rollback/{version}")
async def rollback(version: str):
    """
    REQUIREMENT 10: Rollback to a previously backed-up model version.
    Copies models/{version}.pt to models/latest.pt.
    """
    try:
        model_store.rollback(version)
        logger.info(f"Model rolled back to version: {version}")
        return {"status": "ok", "message": f"Model rolled back to version: {version}"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Backup version '{version}' not found")
    except Exception as e:
        logger.error(f"Rollback failed: {e}")
        raise HTTPException(status_code=500, detail=f"Rollback failed: {str(e)}")
