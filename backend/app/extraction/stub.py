from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from app.extraction.schemas import ExtractedItem, ExtractedReceipt
from app.models import Category


class StubExtractor:
    """Returns the same fake receipt for any photos.

    Lets the upload flow work end to end before a real extractor exists. The data is
    internally consistent (items minus discounts equal the total, NIP checksum is valid),
    so later validation rules accept it.
    """

    def extract(self, images: Sequence[bytes]) -> ExtractedReceipt:
        return ExtractedReceipt(
            store_name="Stub Market",
            store_nip="1234563218",
            purchase_date=date(2026, 10, 17),
            total=Decimal("23.40"),
            items=[
                ExtractedItem(
                    raw_name="CHLEB ZWYKLY 500G",
                    quantity=Decimal("1"),
                    unit_price=Decimal("3.99"),
                    total_price=Decimal("3.99"),
                    category=Category.BAKERY,
                ),
                ExtractedItem(
                    raw_name="MLEKO UHT 3,2% 1L",
                    quantity=Decimal("2"),
                    unit_price=Decimal("3.29"),
                    total_price=Decimal("6.58"),
                    discount=Decimal("0.60"),
                    category=Category.DAIRY,
                ),
                ExtractedItem(
                    raw_name="BANANY LUZ",
                    quantity=Decimal("0.742"),
                    unit_price=Decimal("5.99"),
                    total_price=Decimal("4.44"),
                    category=Category.FRUITS_VEGETABLES,
                ),
                ExtractedItem(
                    raw_name="PLYN DO NACZYN 1L",
                    quantity=Decimal("1"),
                    unit_price=Decimal("8.99"),
                    total_price=Decimal("8.99"),
                    category=Category.HOUSEHOLD_CHEMICALS,
                ),
            ],
        )
