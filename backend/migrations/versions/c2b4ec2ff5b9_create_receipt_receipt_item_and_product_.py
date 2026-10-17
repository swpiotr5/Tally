"""create receipt, receipt_item and product_dictionary tables

Revision ID: c2b4ec2ff5b9
Revises:
Create Date: 2026-10-17 17:06:34.251886

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c2b4ec2ff5b9"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Enum types are created and dropped explicitly: `category` is shared by two tables,
# and autogenerate does not drop enum types on downgrade.
# Values are frozen here on purpose; migrations must not import application code.
category = postgresql.ENUM(
    "bakery",
    "dairy",
    "meat",
    "fruits_vegetables",
    "drinks",
    "sweets_snacks",
    "alcohol",
    "household_chemicals",
    "cosmetics",
    "clothing",
    "home",
    "other",
    name="category",
    create_type=False,
)
receipt_status = postgresql.ENUM("ok", "needs_review", name="receipt_status", create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    category.create(bind)
    receipt_status.create(bind)

    op.create_table(
        "product_dictionary",
        sa.Column("normalized_raw_name", sa.String(length=255), nullable=False),
        sa.Column("category", category, nullable=False),
        sa.PrimaryKeyConstraint("normalized_raw_name", name=op.f("pk_product_dictionary")),
    )
    op.create_table(
        "receipt",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("store_name", sa.String(length=255), nullable=False),
        sa.Column("store_nip", sa.String(length=10), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("total", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("image_path", sa.String(length=500), nullable=False),
        sa.Column("status", receipt_status, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_receipt")),
    )
    op.create_table(
        "receipt_item",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("receipt_id", sa.Integer(), nullable=False),
        sa.Column("raw_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("total_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("discount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("category", category, nullable=False),
        sa.ForeignKeyConstraint(
            ["receipt_id"],
            ["receipt.id"],
            name=op.f("fk_receipt_item_receipt_id_receipt"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_receipt_item")),
    )
    op.create_index(
        op.f("ix_receipt_item_receipt_id"), "receipt_item", ["receipt_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_receipt_item_receipt_id"), table_name="receipt_item")
    op.drop_table("receipt_item")
    op.drop_table("receipt")
    op.drop_table("product_dictionary")

    bind = op.get_bind()
    receipt_status.drop(bind)
    category.drop(bind)
