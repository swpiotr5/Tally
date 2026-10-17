import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Annotated

from pydantic import BaseModel, Field, WithJsonSchema, field_validator

from app.models import Category

# Shape constraints only, mirroring the database columns. Business rules (item sum vs total,
# NIP checksum, sensible date) belong to the validation step, not to the extraction schema.
#
# The vision model fills this schema. Amounts are plain numbers in the JSON schema it sees:
# Pydantic's default for Decimal also allows strings, which would invite Polish decimal
# commas ("3,49") that are not valid decimals.
Money = Annotated[
    Decimal,
    Field(ge=0, max_digits=10, decimal_places=2),
    WithJsonSchema({"type": "number"}),
]
Quantity = Annotated[
    Decimal,
    Field(gt=0, max_digits=10, decimal_places=3),
    WithJsonSchema({"type": "number"}),
]


class ExtractedItem(BaseModel):
    raw_name: str = Field(
        min_length=1, max_length=255, description="Item name exactly as printed on the receipt."
    )
    quantity: Quantity = Field(description="Pieces, or kilograms for weighed goods.")
    unit_price: Money
    total_price: Money = Field(description="Price for the whole quantity, before the discount.")
    discount: Money = Field(
        default=Decimal("0.00"), description="Discount for this item as a positive amount."
    )
    category: Category

    @field_validator("discount", mode="before")
    @classmethod
    def _discount_as_positive_amount(cls, value: object) -> object:
        # Receipts print discounts as negative lines ("RABAT -1,20"); store the amount.
        if isinstance(value, int | float | Decimal | str):
            try:
                amount = Decimal(str(value))
            except InvalidOperation:
                return value  # left for the regular validation to reject
            if amount < 0:
                return -amount
        return value


class ExtractedReceipt(BaseModel):
    store_name: str = Field(min_length=1, max_length=255)
    store_nip: str | None = Field(
        default=None, pattern=r"^\d{10}$", description="Store tax ID: 10 digits, no separators."
    )
    purchase_date: date
    total: Money = Field(description="Amount paid, as printed on the receipt.")
    items: list[ExtractedItem]

    @field_validator("store_nip", mode="before")
    @classmethod
    def _nip_digits_only(cls, value: object) -> object:
        # Printed as "779-10-11-327", "PL 7791011327" and so on. A NIP that does not have
        # 10 digits is dropped instead of failing the whole receipt.
        if not isinstance(value, str):
            return value
        digits = re.sub(r"\D", "", value)
        return digits if len(digits) == 10 else None
