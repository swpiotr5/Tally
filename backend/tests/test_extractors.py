import pytest

from app.config import Settings
from app.extraction import ExtractedReceipt, StubExtractor, VisionLLMExtractor, get_extractor

DB_URL = "postgresql+psycopg://user:pass@localhost:5432/tally"


def test_stub_returns_a_receipt_with_items() -> None:
    receipt = StubExtractor().extract(b"any image bytes")

    assert isinstance(receipt, ExtractedReceipt)
    assert receipt.items


def test_stub_ignores_the_image() -> None:
    extractor = StubExtractor()

    assert extractor.extract(b"first") == extractor.extract(b"second")


def test_stub_receipt_is_internally_consistent() -> None:
    receipt = StubExtractor().extract(b"")

    items_total = sum(item.total_price - item.discount for item in receipt.items)

    assert items_total == receipt.total


def test_factory_builds_stub_extractor() -> None:
    settings = Settings(_env_file=None, database_url=DB_URL, extractor="stub")

    assert isinstance(get_extractor(settings), StubExtractor)


def test_factory_builds_vision_extractor() -> None:
    # Building the client makes no request, so no real key or network is needed.
    settings = Settings(
        _env_file=None, database_url=DB_URL, extractor="vision", anthropic_api_key="sk-ant-test"
    )

    assert isinstance(get_extractor(settings), VisionLLMExtractor)


def test_factory_rejects_unknown_extractor() -> None:
    # model_construct skips validation, simulating a value Settings would normally reject.
    settings = Settings.model_construct(database_url=DB_URL, extractor="unknown")

    with pytest.raises(ValueError, match="unknown"):
        get_extractor(settings)
