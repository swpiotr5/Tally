from collections.abc import Iterator
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.receipts import provide_extractor
from app.config import Settings, get_settings
from app.db import get_session
from app.extraction import ExtractedItem, ExtractedReceipt
from app.main import app
from app.models import Category, Receipt

JPEG = ("receipt.jpg", b"fake jpeg bytes", "image/jpeg")


def extracted_receipt(store_name: str = "Biedronka") -> ExtractedReceipt:
    return ExtractedReceipt(
        store_name=store_name,
        store_nip="7791011327",
        purchase_date=date(2026, 10, 17),
        total=Decimal("9.68"),
        items=[
            ExtractedItem(
                raw_name="MLEKO 2% 1L",
                quantity=Decimal("2"),
                unit_price=Decimal("3.49"),
                total_price=Decimal("6.98"),
                discount=Decimal("0.50"),
                category=Category.DAIRY,
            ),
            ExtractedItem(
                raw_name="BANANY LUZ",
                quantity=Decimal("0.535"),
                unit_price=Decimal("5.99"),
                total_price=Decimal("3.20"),
                category=Category.FRUITS_VEGETABLES,
            ),
        ],
    )


class FakeExtractor:
    """Satisfies ReceiptExtractor structurally; records what it was given."""

    def __init__(self, result: ExtractedReceipt | None = None) -> None:
        self.result = result or extracted_receipt()
        self.images: list[bytes] = []

    def extract(self, image: bytes) -> ExtractedReceipt:
        self.images.append(image)
        return self.result


class FailingExtractor:
    def extract(self, image: bytes) -> ExtractedReceipt:
        raise RuntimeError("extraction failed")


@pytest.fixture
def upload_dir(tmp_path: Path) -> Path:
    return tmp_path / "uploads"


@pytest.fixture
def extractor() -> FakeExtractor:
    return FakeExtractor()


@pytest.fixture
def client(
    db_session: Session, upload_dir: Path, extractor: FakeExtractor, database_url: str
) -> Iterator[TestClient]:
    settings = Settings(_env_file=None, database_url=database_url, upload_dir=upload_dir)
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[provide_extractor] = lambda: extractor
    yield TestClient(app)
    app.dependency_overrides.clear()


def receipt_count(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Receipt))


def saved_files(upload_dir: Path) -> list[Path]:
    return list(upload_dir.iterdir()) if upload_dir.exists() else []


def test_upload_stores_receipt_and_image(
    client: TestClient, db_session: Session, upload_dir: Path, extractor: FakeExtractor
) -> None:
    response = client.post("/receipts", files={"file": JPEG})

    assert response.status_code == 201
    body = response.json()
    assert body["store_name"] == "Biedronka"
    assert body["status"] == "ok"
    assert [item["raw_name"] for item in body["items"]] == ["MLEKO 2% 1L", "BANANY LUZ"]
    assert extractor.images == [b"fake jpeg bytes"]

    receipt = db_session.get(Receipt, body["id"])
    assert receipt is not None
    assert len(receipt.items) == 2
    assert (upload_dir / receipt.image_path).read_bytes() == b"fake jpeg bytes"


def test_amounts_are_serialized_as_exact_strings(client: TestClient) -> None:
    body = client.post("/receipts", files={"file": JPEG}).json()

    milk, bananas = body["items"]
    assert body["total"] == "9.68"
    assert milk["unit_price"] == "3.49"
    assert milk["discount"] == "0.50"
    assert bananas["quantity"] == "0.535"
    assert bananas["category"] == "fruits_vegetables"


def test_image_path_is_not_exposed(client: TestClient) -> None:
    body = client.post("/receipts", files={"file": JPEG}).json()

    assert "image_path" not in body


def test_rejects_unsupported_file_type(
    client: TestClient, db_session: Session, upload_dir: Path, extractor: FakeExtractor
) -> None:
    response = client.post("/receipts", files={"file": ("notes.txt", b"hello", "text/plain")})

    assert response.status_code == 415
    assert extractor.images == []
    assert receipt_count(db_session) == 0
    assert saved_files(upload_dir) == []


def test_requires_a_file(client: TestClient) -> None:
    assert client.post("/receipts").status_code == 422


@pytest.mark.parametrize("extractor", [FailingExtractor()])
def test_failed_extraction_saves_nothing(
    client: TestClient, db_session: Session, upload_dir: Path
) -> None:
    with pytest.raises(RuntimeError, match="extraction failed"):
        client.post("/receipts", files={"file": JPEG})

    assert receipt_count(db_session) == 0
    assert saved_files(upload_dir) == []


def test_failed_database_write_removes_saved_image(
    client: TestClient, db_session: Session, upload_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def failing_commit() -> None:
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(db_session, "commit", failing_commit)

    with pytest.raises(RuntimeError, match="database unavailable"):
        client.post("/receipts", files={"file": JPEG})

    assert saved_files(upload_dir) == []


def test_get_returns_the_uploaded_receipt(client: TestClient) -> None:
    created = client.post("/receipts", files={"file": JPEG}).json()

    response = client.get(f"/receipts/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_receipt_returns_404(client: TestClient) -> None:
    response = client.get("/receipts/999999")

    assert response.status_code == 404


def test_list_is_empty_without_receipts(client: TestClient) -> None:
    assert client.get("/receipts").json() == []


def test_list_shows_newest_first_with_item_counts(
    client: TestClient, extractor: FakeExtractor
) -> None:
    first = client.post("/receipts", files={"file": JPEG}).json()
    extractor.result = extracted_receipt(store_name="Lidl").model_copy(update={"items": []})
    second = client.post("/receipts", files={"file": JPEG}).json()

    body = client.get("/receipts").json()

    assert [r["id"] for r in body] == [second["id"], first["id"]]
    assert [r["store_name"] for r in body] == ["Lidl", "Biedronka"]
    assert [r["item_count"] for r in body] == [0, 2]
    assert "items" not in body[0]
