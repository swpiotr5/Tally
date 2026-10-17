from collections.abc import Iterator
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import get_session
from app.main import app
from app.models import Category, Receipt, ReceiptItem


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_session] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def receipt(db_session: Session) -> Receipt:
    receipt = Receipt(
        store_name="Biedronka",
        store_nip="7791011327",
        purchase_date=date(2026, 10, 17),
        total=Decimal("9.68"),
        image_path="receipt.jpg",
        items=[
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
    )
    db_session.add(receipt)
    db_session.flush()
    return receipt


def item_url(receipt: Receipt, item: ReceiptItem) -> str:
    return f"/receipts/{receipt.id}/items/{item.id}"


# Editing an item


def test_changes_only_the_fields_that_were_sent(client: TestClient, receipt: Receipt) -> None:
    milk = receipt.items[0]

    response = client.patch(item_url(receipt, milk), json={"category": "drinks"})

    assert response.status_code == 200
    body = response.json()
    assert body["category"] == "drinks"
    assert body["raw_name"] == "MLEKO 2% 1L"
    assert body["unit_price"] == "3.49"


def test_stores_corrected_amounts_exactly(client: TestClient, receipt: Receipt) -> None:
    milk = receipt.items[0]

    response = client.patch(
        item_url(receipt, milk),
        json={"quantity": 1.5, "unit_price": "3.79", "total_price": "5.69", "discount": 0},
    )

    assert response.status_code == 200
    assert milk.quantity == Decimal("1.500")
    assert milk.unit_price == Decimal("3.79")
    assert milk.total_price == Decimal("5.69")
    assert milk.discount == Decimal("0.00")


@pytest.mark.parametrize(
    "body",
    [
        {"unit_price": -1},
        {"total_price": "3.499"},
        {"quantity": 0},
        {"raw_name": ""},
        {"raw_name": None},
        {"category": "electronics"},
        {"receipt_id": 2},
    ],
)
def test_rejects_invalid_item_changes(client: TestClient, receipt: Receipt, body: dict) -> None:
    response = client.patch(item_url(receipt, receipt.items[0]), json=body)

    assert response.status_code == 422


def test_item_of_another_receipt_is_not_found(
    client: TestClient, receipt: Receipt, db_session: Session
) -> None:
    other = Receipt(
        store_name="Lidl", purchase_date=date(2026, 10, 18), total=Decimal("1.00"), image_path="x"
    )
    db_session.add(other)
    db_session.flush()

    response = client.patch(item_url(other, receipt.items[0]), json={"category": "drinks"})

    assert response.status_code == 404


def test_unknown_item_is_not_found(client: TestClient, receipt: Receipt) -> None:
    response = client.patch(f"/receipts/{receipt.id}/items/999999", json={"category": "drinks"})

    assert response.status_code == 404


# Deleting an item


def test_deletes_an_item(client: TestClient, receipt: Receipt) -> None:
    url = item_url(receipt, receipt.items[0])

    response = client.delete(url)

    assert response.status_code == 204
    items = client.get(f"/receipts/{receipt.id}").json()["items"]
    assert [item["raw_name"] for item in items] == ["BANANY LUZ"]


def test_deleting_an_item_twice_reports_not_found(client: TestClient, receipt: Receipt) -> None:
    url = item_url(receipt, receipt.items[0])
    client.delete(url)

    assert client.delete(url).status_code == 404


# Editing the receipt header


def test_updates_the_receipt_header(client: TestClient, receipt: Receipt) -> None:
    response = client.patch(
        f"/receipts/{receipt.id}",
        json={"store_name": "Lidl", "purchase_date": "2026-10-16", "total": "10.18"},
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["store_name"], body["purchase_date"], body["total"]) == (
        "Lidl",
        "2026-10-16",
        "10.18",
    )
    assert body["store_nip"] == "7791011327"
    assert len(body["items"]) == 2


def test_clears_the_nip(client: TestClient, receipt: Receipt) -> None:
    response = client.patch(f"/receipts/{receipt.id}", json={"store_nip": None})

    assert response.status_code == 200
    assert response.json()["store_nip"] is None


@pytest.mark.parametrize(
    "body",
    [
        {"store_nip": "123"},
        {"store_name": None},
        {"store_name": ""},
        {"total": -5},
        {"purchase_date": "17.10.2026"},
        {"status": "ok"},
    ],
)
def test_rejects_invalid_header_changes(client: TestClient, receipt: Receipt, body: dict) -> None:
    response = client.patch(f"/receipts/{receipt.id}", json=body)

    assert response.status_code == 422


def test_unknown_receipt_is_not_found(client: TestClient) -> None:
    response = client.patch("/receipts/999999", json={"store_name": "Lidl"})

    assert response.status_code == 404
