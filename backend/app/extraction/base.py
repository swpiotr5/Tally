from typing import Protocol

from app.extraction.schemas import ExtractedReceipt


class ExtractionError(Exception):
    """The receipt could not be read from the image (unreadable photo, model or API failure)."""


class ReceiptExtractor(Protocol):
    """Reads a receipt photo into structured data.

    A Protocol, so implementations (stub, vision LLM, OCR + LLM) need no common base class
    and tests can pass any object with a matching `extract` method.
    """

    def extract(self, image: bytes) -> ExtractedReceipt:
        """Return the store, date, total and line items read from the image bytes.

        Raises ExtractionError when the receipt cannot be read.
        """
        ...
