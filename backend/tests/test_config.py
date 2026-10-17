from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import Settings

DB_URL = "postgresql+psycopg://user:pass@localhost:5432/tally"


# _env_file=None keeps a local .env from leaking into the tests.


def test_reads_values_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", DB_URL)
    monkeypatch.setenv("EXTRACTOR", "stub")
    monkeypatch.setenv("UPLOAD_DIR", "/data/uploads")

    settings = Settings(_env_file=None)

    assert settings.database_url == DB_URL
    assert settings.extractor == "stub"
    assert settings.upload_dir == Path("/data/uploads")


def test_uses_defaults_for_optional_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", DB_URL)
    monkeypatch.delenv("EXTRACTOR", raising=False)
    monkeypatch.delenv("UPLOAD_DIR", raising=False)

    settings = Settings(_env_file=None)

    assert settings.extractor == "stub"
    assert settings.upload_dir == Path("uploads")


def test_database_url_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_rejects_unknown_extractor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", DB_URL)
    monkeypatch.setenv("EXTRACTOR", "does-not-exist")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_ignores_unrelated_variables_from_env_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(f"DATABASE_URL={DB_URL}\nPOSTGRES_PASSWORD=secret\n")

    settings = Settings(_env_file=env_file)

    assert settings.database_url == DB_URL
