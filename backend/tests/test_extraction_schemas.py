from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.extraction import ExtractedItem, ExtractedReceipt
from app.models import Category

ITEM = {
    "raw_name": "MLEKO 2% 1L",
    "quantity": "2",
    "unit_price": "3.49",
    "total_price": "6.98",
    "discount": "0.50",
    "category": "dairy",
}


def test_parses_json_into_exact_types() -> None:
    receipt = ExtractedReceipt.model_validate_json(
        '{"store_name": "Biedronka", "store_nip": "7791011327", "purchase_date": "2026-10-17",'
        ' "total": 6.48, "items": [{"raw_name": "MLEKO 2% 1L", "quantity": 2,'
        ' "unit_price": 3.49, "total_price": 6.98, "discount": 0.5, "category": "dairy"}]}'
    )

    item = receipt.items[0]
    assert receipt.purchase_date == date(2026, 10, 17)
    assert receipt.total == Decimal("6.48")
    assert item.unit_price == Decimal("3.49")
    assert item.category is Category.DAIRY


def test_nip_is_optional() -> None:
    receipt = ExtractedReceipt(
        store_name="Lidl", purchase_date=date(2026, 10, 17), total=Decimal("0.00"), items=[]
    )

    assert receipt.store_nip is None


def test_discount_defaults_to_zero() -> None:
    without_discount = {key: value for key, value in ITEM.items() if key != "discount"}

    item = ExtractedItem.model_validate(without_discount)

    assert item.discount == Decimal("0.00")


def test_accepts_weighed_quantity() -> None:
    item = ExtractedItem.model_validate(ITEM | {"quantity": "0.535"})

    assert item.quantity == Decimal("0.535")


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("raw_name", ""),
        ("quantity", "0"),
        ("quantity", "0.0005"),
        ("unit_price", "-1.00"),
        ("total_price", "3.499"),
        ("discount", "-0.50"),
        ("category", "electronics"),
    ],
)
def test_rejects_invalid_item_field(field: str, value: str) -> None:
    with pytest.raises(ValidationError):
        ExtractedItem.model_validate(ITEM | {field: value})


@pytest.mark.parametrize("nip", ["779-101-13-27", "779101132", "77910113270", "NIP7791011"])
def test_rejects_nip_that_is_not_ten_digits(nip: str) -> None:
    with pytest.raises(ValidationError):
        ExtractedReceipt(
            store_name="Biedronka",
            store_nip=nip,
            purchase_date=date(2026, 10, 17),
            total=Decimal("6.48"),
            items=[],
        )
