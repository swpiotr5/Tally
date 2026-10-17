from datetime import date
from decimal import Decimal

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.models import Category, ProductDictionary, Receipt, ReceiptItem, ReceiptStatus


def make_receipt(**overrides: object) -> Receipt:
    fields: dict[str, object] = {
        "store_name": "Biedronka",
        "store_nip": "7791011327",
        "purchase_date": date(2026, 10, 17),
        "total": Decimal("9.68"),
        "image_paths": ["uploads/receipt.jpg"],
        "items": [
            ReceiptItem(
                raw_name="MLEKO 2% 1L",
                quantity=Decimal("2"),
                unit_price=Decimal("3.49"),
                total_price=Decimal("6.98"),
                discount=Decimal("0.50"),
                category=Category.DAIRY,
            ),
            ReceiptItem(
                raw_name="BANANY LUZ",
                quantity=Decimal("0.535"),
                unit_price=Decimal("5.99"),
                total_price=Decimal("3.20"),
                category=Category.FRUITS_VEGETABLES,
            ),
        ],
    }
    fields.update(overrides)
    return Receipt(**fields)


def reload(session: Session, receipt: Receipt) -> Receipt:
    """Flush, forget the in-memory objects and read the receipt back from the database."""
    session.flush()
    receipt_id = receipt.id
    session.expunge_all()
    loaded = session.get(Receipt, receipt_id)
    assert loaded is not None
    return loaded


def test_receipt_with_items_round_trip(db_session: Session) -> None:
    receipt = make_receipt()
    db_session.add(receipt)

    loaded = reload(db_session, receipt)

    assert loaded.store_name == "Biedronka"
    assert loaded.purchase_date == date(2026, 10, 17)
    assert loaded.total == Decimal("9.68")
    assert loaded.status is ReceiptStatus.OK
    assert loaded.created_at is not None
    assert [item.raw_name for item in loaded.items] == ["MLEKO 2% 1L", "BANANY LUZ"]


def test_money_and_quantity_are_exact_decimals(db_session: Session) -> None:
    db_session.add(receipt := make_receipt())

    milk, bananas = reload(db_session, receipt).items

    assert isinstance(milk.unit_price, Decimal)
    assert milk.unit_price == Decimal("3.49")
    assert milk.discount == Decimal("0.50")
    assert bananas.quantity == Decimal("0.535")


def test_discount_defaults_to_zero(db_session: Session) -> None:
    db_session.add(receipt := make_receipt())

    _, bananas = reload(db_session, receipt).items

    assert bananas.discount == Decimal("0.00")


def test_enums_are_stored_as_values(db_session: Session) -> None:
    db_session.add(make_receipt(status=ReceiptStatus.NEEDS_REVIEW))
    db_session.flush()

    status = db_session.scalar(text("SELECT status::text FROM receipt"))
    categories = db_session.scalars(text("SELECT category::text FROM receipt_item ORDER BY id"))

    assert status == "needs_review"
    assert list(categories) == ["dairy", "fruits_vegetables"]


def test_deleting_receipt_through_orm_deletes_items(db_session: Session) -> None:
    db_session.add(receipt := make_receipt())
    db_session.flush()

    db_session.delete(receipt)
    db_session.flush()

    assert db_session.scalar(select(func.count()).select_from(ReceiptItem)) == 0


def test_deleting_receipt_in_sql_cascades_to_items(db_session: Session) -> None:
    db_session.add(make_receipt())
    db_session.flush()

    # Bypasses the ORM: relies on ON DELETE CASCADE in the database.
    db_session.execute(delete(Receipt))

    assert db_session.scalar(select(func.count()).select_from(ReceiptItem)) == 0


def test_removing_item_from_receipt_deletes_it(db_session: Session) -> None:
    db_session.add(receipt := make_receipt())
    db_session.flush()

    receipt.items.pop()
    loaded = reload(db_session, receipt)

    assert [item.raw_name for item in loaded.items] == ["MLEKO 2% 1L"]
    assert db_session.scalar(select(func.count()).select_from(ReceiptItem)) == 1


def test_product_dictionary_round_trip(db_session: Session) -> None:
    db_session.add(ProductDictionary(normalized_raw_name="mleko 2% 1l", category=Category.DAIRY))
    db_session.flush()
    db_session.expunge_all()

    entry = db_session.get(ProductDictionary, "mleko 2% 1l")

    assert entry is not None
    assert entry.category is Category.DAIRY
