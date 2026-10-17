import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, MetaData, Numeric, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Money is always Numeric(10, 2) -> Decimal; never float.
Money = Numeric(10, 2)


class Category(enum.StrEnum):
    BAKERY = "bakery"
    DAIRY = "dairy"
    MEAT = "meat"
    FRUITS_VEGETABLES = "fruits_vegetables"
    DRINKS = "drinks"
    SWEETS_SNACKS = "sweets_snacks"
    ALCOHOL = "alcohol"
    HOUSEHOLD_CHEMICALS = "household_chemicals"
    COSMETICS = "cosmetics"
    CLOTHING = "clothing"
    HOME = "home"
    OTHER = "other"


class ReceiptStatus(enum.StrEnum):
    OK = "ok"
    NEEDS_REVIEW = "needs_review"


def _pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """Native PostgreSQL enum that stores member values ("dairy"), not names ("DAIRY")."""
    return Enum(enum_cls, name=name, values_callable=lambda members: [m.value for m in members])


# Shared instances: one PostgreSQL type, even when used by several columns.
CategoryType = _pg_enum(Category, "category")
ReceiptStatusType = _pg_enum(ReceiptStatus, "receipt_status")


class Base(DeclarativeBase):
    # Deterministic constraint names, so Alembic migrations can reference them reliably.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class Receipt(Base):
    __tablename__ = "receipt"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_name: Mapped[str] = mapped_column(String(255))
    store_nip: Mapped[str | None] = mapped_column(String(10))
    purchase_date: Mapped[date] = mapped_column(Date)
    total: Mapped[Decimal] = mapped_column(Money)
    image_path: Mapped[str] = mapped_column(String(500))
    status: Mapped[ReceiptStatus] = mapped_column(ReceiptStatusType, default=ReceiptStatus.OK)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["ReceiptItem"]] = relationship(
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ReceiptItem.id",
    )


class ReceiptItem(Base):
    __tablename__ = "receipt_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_id: Mapped[int] = mapped_column(
        ForeignKey("receipt.id", ondelete="CASCADE"), index=True
    )
    raw_name: Mapped[str] = mapped_column(String(255))
    # Three decimal places: weighed goods are sold in kg (e.g. 0.535).
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    unit_price: Mapped[Decimal] = mapped_column(Money)
    total_price: Mapped[Decimal] = mapped_column(Money)
    discount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"))
    category: Mapped[Category] = mapped_column(CategoryType)

    receipt: Mapped[Receipt] = relationship(back_populates="items")


class ProductDictionary(Base):
    """Cache of known product names, so they do not need an LLM call to be categorized."""

    __tablename__ = "product_dictionary"

    normalized_raw_name: Mapped[str] = mapped_column(String(255), primary_key=True)
    category: Mapped[Category] = mapped_column(CategoryType)
