from typing import Protocol

from app.extraction.schemas import ExtractedReceipt


class ReceiptExtractor(Protocol):
    """Reads a receipt photo into structured data.

    A Protocol, so implementations (stub, vision LLM, OCR + LLM) need no common base class
    and tests can pass any object with a matching `extract` method.
    """

    def extract(self, image: bytes) -> ExtractedReceipt:
        """Return the store, date, total and line items read from the image bytes."""
        ...
