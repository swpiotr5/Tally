from datetime import date, datetime
from decimal import Decimal
from typing import Any, ClassVar, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.extraction.schemas import Money, Quantity
from app.models import Category, ReceiptStatus

# Decimal fields serialize to JSON strings ("3.49"), so amounts reach the client unrounded.


class ReceiptItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    raw_name: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    discount: Decimal
    category: Category


class ReceiptSummary(BaseModel):
    """Receipt as shown in the list: no items, only their count."""

    id: int
    store_name: str
    purchase_date: date
    total: Decimal
    status: ReceiptStatus
    created_at: datetime
    item_count: int


class ReceiptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_name: str
    store_nip: str | None
    purchase_date: date
    total: Decimal
    status: ReceiptStatus
    created_at: datetime
    items: list[ReceiptItemRead]


class PartialUpdate(BaseModel):
    """Body of a PATCH request: only the fields that were sent change.

    Sending null is allowed only for nullable columns; elsewhere it would fail in the
    database instead of returning a validation error.
    """

    model_config = ConfigDict(extra="forbid")

    nullable_fields: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="after")
    def _no_null_for_required_fields(self) -> Self:
        for field in sorted(self.model_fields_set - self.nullable_fields):
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

    def changes(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


class ReceiptItemUpdate(PartialUpdate):
    raw_name: str | None = Field(default=None, min_length=1, max_length=255)
    quantity: Quantity | None = None
    unit_price: Money | None = None
    total_price: Money | None = None
    discount: Money | None = None
    category: Category | None = None


class ReceiptUpdate(PartialUpdate):
    nullable_fields = frozenset({"store_nip"})

    store_name: str | None = Field(default=None, min_length=1, max_length=255)
    store_nip: str | None = Field(default=None, pattern=r"^\d{10}$")
    purchase_date: date | None = None
    total: Money | None = None
