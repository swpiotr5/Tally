from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings read from environment variables (and `.env` if present)."""

    # extra="ignore": the shared .env also holds variables for other services (e.g. POSTGRES_*).
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    extractor: Literal["stub", "vision"] = "stub"
    upload_dir: Path = Path("uploads")

    # Vision extractor (EXTRACTOR=vision). SecretStr keeps the key out of logs and reprs.
    anthropic_api_key: SecretStr | None = None
    vision_model: str = "claude-haiku-5-5"
    vision_effort: Literal["low", "medium", "high"] = "medium"
    # 2576 px is the largest side the newest models read; small receipt print needs it, and
    # the extra input tokens cost less than the output (measured on real photos).
    vision_max_image_side: int = Field(default=2576, ge=512, le=4096)

    @model_validator(mode="after")
    def _vision_needs_api_key(self) -> Self:
        key = self.anthropic_api_key.get_secret_value() if self.anthropic_api_key else ""
        if self.extractor == "vision" and not key:
            raise ValueError("ANTHROPIC_API_KEY is required when EXTRACTOR=vision")
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the settings, created once on first use rather than at import time."""
    return Settings()
