from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field

from app.models import Category

# Shape constraints only, mirroring the database columns. Business rules (item sum vs total,
# NIP checksum, sensible date) belong to the validation step, not to the extraction schema.
Money = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]


class ExtractedItem(BaseModel):
    raw_name: str = Field(
        min_length=1, max_length=255, description="Item name exactly as printed on the receipt."
    )
    quantity: Decimal = Field(
        gt=0, max_digits=10, decimal_places=3, description="Pieces, or kilograms for weighed goods."
    )
    unit_price: Money
    total_price: Money = Field(description="Price for the whole quantity, before the discount.")
    discount: Money = Field(
        default=Decimal("0.00"), description="Discount for this item as a positive amount."
    )
    category: Category


class ExtractedReceipt(BaseModel):
    store_name: str = Field(min_length=1, max_length=255)
    store_nip: str | None = Field(
        default=None, pattern=r"^\d{10}$", description="Store tax ID: 10 digits, no separators."
    )
    purchase_date: date
    total: Money = Field(description="Amount paid, as printed on the receipt.")
    items: list[ExtractedItem]
