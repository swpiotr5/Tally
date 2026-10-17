from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

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
