from app.config import Settings
from app.extraction.base import ReceiptExtractor
from app.extraction.schemas import ExtractedItem, ExtractedReceipt
from app.extraction.stub import StubExtractor

__all__ = [
    "ExtractedItem",
    "ExtractedReceipt",
    "ReceiptExtractor",
    "StubExtractor",
    "get_extractor",
]


def get_extractor(settings: Settings) -> ReceiptExtractor:
    """Build the extractor selected by the EXTRACTOR setting."""
    match settings.extractor:
        case "stub":
            return StubExtractor()
    raise ValueError(f"Unknown extractor: {settings.extractor!r}")
