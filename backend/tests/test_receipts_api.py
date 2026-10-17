from collections.abc import Iterator, Sequence
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
from app.extraction import ExtractedItem, ExtractedReceipt, ExtractionError
from app.main import app
from app.models import Category, Receipt

JPEG = ("receipt.jpg", b"fake jpeg bytes", "image/jpeg")
TOP = ("top.jpg", b"top of the receipt", "image/jpeg")
BOTTOM = ("bottom.png", b"bottom of the receipt", "image/png")


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
    """Satisfies ReceiptExtractor structurally; records the photos of every call."""

    def __init__(self, result: ExtractedReceipt | None = None) -> None:
        self.result = result or extracted_receipt()
        self.calls: list[list[bytes]] = []

    def extract(self, images: Sequence[bytes]) -> ExtractedReceipt:
        self.calls.append(list(images))
        return self.result


class FailingExtractor:
    def extract(self, images: Sequence[bytes]) -> ExtractedReceipt:
        raise RuntimeError("extraction failed")


class UnreadableReceiptExtractor:
    def extract(self, images: Sequence[bytes]) -> ExtractedReceipt:
        raise ExtractionError("blurry photo")


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


def upload(client: TestClient, *photos: tuple[str, bytes, str]):
    """POST photos of one receipt, in order, as the browser sends them."""
    return client.post("/receipts", files=[("files", photo) for photo in photos])


def receipt_count(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Receipt))


def saved_files(upload_dir: Path) -> list[Path]:
    return list(upload_dir.iterdir()) if upload_dir.exists() else []


def test_upload_stores_receipt_and_photo(
    client: TestClient, db_session: Session, upload_dir: Path, extractor: FakeExtractor
) -> None:
    response = upload(client, JPEG)

    assert response.status_code == 201
    body = response.json()
    assert body["store_name"] == "Biedronka"
    assert body["status"] == "ok"
    assert [item["raw_name"] for item in body["items"]] == ["MLEKO 2% 1L", "BANANY LUZ"]
    assert extractor.calls == [[b"fake jpeg bytes"]]

    receipt = db_session.get(Receipt, body["id"])
    assert receipt is not None
    assert len(receipt.items) == 2
    [path] = receipt.image_paths
    assert (upload_dir / path).read_bytes() == b"fake jpeg bytes"


def test_reads_and_stores_several_photos_in_order(
    client: TestClient, db_session: Session, upload_dir: Path, extractor: FakeExtractor
) -> None:
    response = upload(client, TOP, BOTTOM)

    assert response.status_code == 201
    assert extractor.calls == [[b"top of the receipt", b"bottom of the receipt"]]
    receipt = db_session.get(Receipt, response.json()["id"])
    assert receipt is not None
    top, bottom = receipt.image_paths
    assert (upload_dir / top).read_bytes() == b"top of the receipt"
    assert (upload_dir / bottom).read_bytes() == b"bottom of the receipt"
    assert bottom.endswith(".png")


def test_amounts_are_serialized_as_exact_strings(client: TestClient) -> None:
    body = upload(client, JPEG).json()

    milk, bananas = body["items"]
    assert body["total"] == "9.68"
    assert milk["unit_price"] == "3.49"
    assert milk["discount"] == "0.50"
    assert bananas["quantity"] == "0.535"
    assert bananas["category"] == "fruits_vegetables"


def test_photo_paths_are_not_exposed(client: TestClient) -> None:
    body = upload(client, JPEG).json()

    assert "image_paths" not in body


def test_rejects_unsupported_file_type(
    client: TestClient, db_session: Session, upload_dir: Path, extractor: FakeExtractor
) -> None:
    response = upload(client, JPEG, ("notes.txt", b"hello", "text/plain"))

    assert response.status_code == 415
    assert extractor.calls == []
    assert receipt_count(db_session) == 0
    assert saved_files(upload_dir) == []


def test_rejects_more_than_five_photos(
    client: TestClient, db_session: Session, upload_dir: Path, extractor: FakeExtractor
) -> None:
    response = upload(client, *[JPEG] * 6)

    assert response.status_code == 422
    assert extractor.calls == []
    assert receipt_count(db_session) == 0
    assert saved_files(upload_dir) == []


def test_requires_a_photo(client: TestClient) -> None:
    assert client.post("/receipts").status_code == 422


@pytest.mark.parametrize(
    ("missing", "expected"),
    [
        ({"total": None}, ["total"]),
        ({"purchase_date": None, "total": None}, ["purchase_date", "total"]),
    ],
)
def test_receipt_without_date_or_total_is_not_stored(
    client: TestClient,
    db_session: Session,
    upload_dir: Path,
    extractor: FakeExtractor,
    missing: dict,
    expected: list[str],
) -> None:
    extractor.result = extracted_receipt().model_copy(update=missing)

    response = upload(client, TOP)

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "incomplete_receipt"
    assert detail["missing"] == expected
    assert receipt_count(db_session) == 0
    assert saved_files(upload_dir) == []


@pytest.mark.parametrize("extractor", [UnreadableReceiptExtractor()])
def test_unreadable_receipt_returns_502_and_saves_nothing(
    client: TestClient, db_session: Session, upload_dir: Path
) -> None:
    response = upload(client, JPEG)

    assert response.status_code == 502
    assert response.json() == {"detail": "Could not read the receipt from the photos."}
    assert receipt_count(db_session) == 0
    assert saved_files(upload_dir) == []


@pytest.mark.parametrize("extractor", [FailingExtractor()])
def test_failed_extraction_saves_nothing(
    client: TestClient, db_session: Session, upload_dir: Path
) -> None:
    with pytest.raises(RuntimeError, match="extraction failed"):
        upload(client, JPEG)

    assert receipt_count(db_session) == 0
    assert saved_files(upload_dir) == []


def test_failed_database_write_removes_every_saved_photo(
    client: TestClient, db_session: Session, upload_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def failing_commit() -> None:
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(db_session, "commit", failing_commit)

    with pytest.raises(RuntimeError, match="database unavailable"):
        upload(client, TOP, BOTTOM)

    assert saved_files(upload_dir) == []


def test_get_returns_the_uploaded_receipt(client: TestClient) -> None:
    created = upload(client, JPEG).json()

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
    first = upload(client, JPEG).json()
    extractor.result = extracted_receipt(store_name="Lidl").model_copy(update={"items": []})
    second = upload(client, JPEG).json()

    body = client.get("/receipts").json()

    assert [r["id"] for r in body] == [second["id"], first["id"]]
    assert [r["store_name"] for r in body] == ["Lidl", "Biedronka"]
    assert [r["item_count"] for r in body] == [0, 2]
    assert "items" not in body[0]
