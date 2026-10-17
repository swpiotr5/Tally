import enum

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import Connection, text

from app.models import Base, Category, ReceiptStatus


def test_migrations_match_models(connection: Connection) -> None:
    diff = compare_metadata(MigrationContext.configure(connection), Base.metadata)

    assert diff == []


# Autogenerate does not compare enum values, so a new Python member without a
# migration would only fail at insert time. This test catches it earlier.
@pytest.mark.parametrize(
    ("type_name", "enum_cls"),
    [("category", Category), ("receipt_status", ReceiptStatus)],
)
def test_database_enum_values_match_python_enum(
    connection: Connection, type_name: str, enum_cls: type[enum.Enum]
) -> None:
    values = connection.scalars(text(f"SELECT unnest(enum_range(NULL::{type_name}))::text"))

    assert list(values) == [member.value for member in enum_cls]


SINGLE_PHOTO_REVISION = "c2b4ec2ff5b9"


def insert_receipt(connection: Connection, photo_column: str, photos: str) -> None:
    connection.execute(
        text(
            f"INSERT INTO receipt (store_name, purchase_date, total, {photo_column}, status) "
            f"VALUES ('Lidl', '2026-10-17', 9.68, {photos}, 'ok')"
        )
    )


def test_existing_photo_survives_the_move_to_a_photo_list(
    connection: Connection, alembic_cfg: Config
) -> None:
    command.downgrade(alembic_cfg, SINGLE_PHOTO_REVISION)
    insert_receipt(connection, "image_path", "'old.jpg'")

    command.upgrade(alembic_cfg, "head")

    assert connection.scalar(text("SELECT image_paths FROM receipt")) == ["old.jpg"]


def test_downgrade_keeps_the_first_photo(connection: Connection, alembic_cfg: Config) -> None:
    insert_receipt(connection, "image_paths", "ARRAY['top.jpg', 'bottom.jpg']")

    command.downgrade(alembic_cfg, SINGLE_PHOTO_REVISION)

    assert connection.scalar(text("SELECT image_path FROM receipt")) == "top.jpg"


def test_downgrade_to_base_and_upgrade_again(connection: Connection, alembic_cfg: Config) -> None:
    # PostgreSQL has transactional DDL, so the fixture's rollback restores the schema.
    command.downgrade(alembic_cfg, "base")
    tables = connection.scalars(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
    types = connection.scalars(text("SELECT typname FROM pg_type WHERE typtype = 'e'"))
    assert list(tables) == ["alembic_version"]
    assert list(types) == []

    command.upgrade(alembic_cfg, "head")
