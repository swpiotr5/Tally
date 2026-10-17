from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection, create_engine, pool

from app.config import get_settings
from app.models import Base

config = context.config

if config.config_file_name is not None:
    # Keep loggers configured elsewhere (app, pytest) when migrations run in-process.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of running it (`alembic upgrade head --sql`)."""
    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database.

    Callers (e.g. the test suite) may pass an open connection in
    `config.attributes["connection"]`; otherwise one is created from DATABASE_URL.
    """
    connection = config.attributes.get("connection")
    if connection is not None:
        _run_with(connection)
        return

    engine = create_engine(get_settings().database_url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        _run_with(connection)


def _run_with(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
