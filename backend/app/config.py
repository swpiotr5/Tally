from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings read from environment variables (and `.env` if present)."""

    # extra="ignore": the shared .env also holds variables for other services (e.g. POSTGRES_*).
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    extractor: Literal["stub"] = "stub"
    upload_dir: Path = Path("uploads")


@lru_cache
def get_settings() -> Settings:
    """Return the settings, created once on first use rather than at import time."""
    return Settings()
