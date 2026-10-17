import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, create_engine, text
from sqlalchemy.orm import Session

# Separate database created by docker/db/init; override when credentials differ.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://tally:change-me@localhost:5432/tally_test",
)

BACKEND_DIR = Path(__file__).resolve().parents[1]


def alembic_config(connection: Connection) -> Config:
    """Alembic config that runs migrations on the given connection."""
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["connection"] = connection
    return config


@pytest.fixture(scope="session")
def database_url() -> str:
    return TEST_DATABASE_URL


@pytest.fixture(scope="session")
def engine(database_url: str) -> Iterator[Engine]:
    """Engine for the test database, with the schema built by the real migrations."""
    engine = create_engine(database_url)
    with engine.begin() as connection:
        # Start from an empty schema so leftovers from an aborted run cannot leak in.
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
        command.upgrade(alembic_config(connection), "head")
    yield engine
    engine.dispose()


@pytest.fixture
def connection(engine: Engine) -> Iterator[Connection]:
    """Connection inside a transaction that is rolled back after the test."""
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            yield connection
        finally:
            transaction.rollback()


@pytest.fixture
def alembic_cfg(connection: Connection) -> Config:
    return alembic_config(connection)


@pytest.fixture
def db_session(connection: Connection) -> Iterator[Session]:
    """ORM session bound to the rolled-back connection; commits become savepoints."""
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
