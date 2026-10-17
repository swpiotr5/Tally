from collections.abc import Iterator

import pytest
from sqlalchemy import text

from app.config import get_settings
from app.db import get_engine, get_session


@pytest.fixture
def configured_url(monkeypatch: pytest.MonkeyPatch, database_url: str) -> Iterator[str]:
    """Point the cached settings and engine at the test database for one test."""
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    get_engine.cache_clear()
    yield database_url
    get_engine().dispose()
    get_settings.cache_clear()
    get_engine.cache_clear()


def test_engine_uses_database_url_from_settings(configured_url: str) -> None:
    assert get_engine().url.render_as_string(hide_password=False) == configured_url


@pytest.mark.usefixtures("configured_url")
def test_engine_is_created_once() -> None:
    assert get_engine() is get_engine()


@pytest.mark.usefixtures("configured_url")
def test_session_dependency_yields_working_session() -> None:
    dependency = get_session()
    session = next(dependency)

    assert session.scalar(text("SELECT 1")) == 1

    dependency.close()
