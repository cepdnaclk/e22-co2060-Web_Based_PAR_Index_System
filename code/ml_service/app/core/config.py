"""
REQUIREMENT 9:  ML_SERVICE_SECRET loaded from .env
REQUIREMENT 16: All credentials from environment — never hardcoded
"""

from pydantic_settings import BaseSettings
from pathlib import Path
from pydantic import field_validator


class Settings(BaseSettings):
    # ── Database (used by dataset_preprocessor.py) ─────────────────────
    DB_HOST:     str = "localhost"
    DB_PORT:     int = 3306
    DB_NAME:     str = "par_system"
    DB_USER:     str = "root"
    DB_PASSWORD: str = ""   # REQUIREMENT 16: from .env only

    # ── Spring Boot URL ────────────────────────────────────────────────
    ML_SERVICE_URL: str = "http://localhost:8000"

    # ── REQUIREMENT 9: Service key for securing FastAPI endpoints ──────
    ML_SERVICE_SECRET: str = ""   # loaded from .env

    # ── Model storage paths ────────────────────────────────────────────
    MODEL_DIR:          str = "models"
    LATEST_MODEL_PATH:  str = "models/latest.pt"
    PREPROCESSED_DIR:   str = "data/preprocessed"

    # ── Training defaults ──────────────────────────────────────────────
    DEFAULT_EPOCHS:     int   = 50
    LEARNING_RATE:      float = 1e-4
    BATCH_SIZE:         int   = 16
    NUM_POINTS:         int   = 1024   # Points per point cloud

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"   # Ignore unexpected env vars silently

    @field_validator("ML_SERVICE_SECRET")
    @classmethod
    def _normalize_secret(cls, value: str) -> str:
        return value.strip()


settings = Settings()
"""
REQUIREMENT 9:  ML_SERVICE_SECRET loaded from .env
REQUIREMENT 16: All credentials from environment — never hardcoded
"""

from pydantic_settings import BaseSettings
from pathlib import Path
from pydantic import field_validator


class Settings(BaseSettings):
    # ── Database (used by dataset_preprocessor.py) ─────────────────────
    DB_HOST:     str = "localhost"
    DB_PORT:     int = 3306
    DB_NAME:     str = "par_system"
    DB_USER:     str = "root"
    DB_PASSWORD: str = ""   # REQUIREMENT 16: from .env only

    # ── Spring Boot URL ────────────────────────────────────────────────
    ML_SERVICE_URL: str = "http://localhost:8000"

    # ── REQUIREMENT 9: Service key for securing FastAPI endpoints ──────
    ML_SERVICE_SECRET: str = ""   # loaded from .env

    # ── Model storage paths ────────────────────────────────────────────
    MODEL_DIR:          str = "models"
    LATEST_MODEL_PATH:  str = "models/latest.pt"
    PREPROCESSED_DIR:   str = "data/preprocessed"

    # ── Training defaults ──────────────────────────────────────────────
    DEFAULT_EPOCHS:     int   = 50
    LEARNING_RATE:      float = 1e-4
    BATCH_SIZE:         int   = 16
    NUM_POINTS:         int   = 1024   # Points per point cloud

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"   # Ignore unexpected env vars silently

    @field_validator("ML_SERVICE_SECRET")
    @classmethod
    def _normalize_secret(cls, value: str) -> str:
        return value.strip()


settings = Settings()