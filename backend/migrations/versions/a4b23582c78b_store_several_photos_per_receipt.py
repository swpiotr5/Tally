"""store several photos per receipt

Revision ID: a4b23582c78b
Revises: c2b4ec2ff5b9
Create Date: 2026-10-17 22:37:46.554300

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a4b23582c78b"
down_revision: str | Sequence[str] | None = "c2b4ec2ff5b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Written by hand: autogenerate would drop image_path and add a new column, losing the data.


def upgrade() -> None:
    """A long receipt can be photographed in parts: image_path becomes a list of paths."""
    op.alter_column(
        "receipt",
        "image_path",
        type_=postgresql.ARRAY(sa.String(length=500)),
        postgresql_using="ARRAY[image_path]",
        existing_type=sa.String(length=500),
        existing_nullable=False,
    )
    op.alter_column("receipt", "image_path", new_column_name="image_paths")


def downgrade() -> None:
    """The old schema has room for one photo, so only the first one is kept."""
    op.alter_column("receipt", "image_paths", new_column_name="image_path")
    op.alter_column(
        "receipt",
        "image_path",
        type_=sa.String(length=500),
        postgresql_using="image_path[1]",
        existing_type=postgresql.ARRAY(sa.String(length=500)),
        existing_nullable=False,
    )
