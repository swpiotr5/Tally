from collections.abc import Sequence
from typing import Protocol

from app.extraction.schemas import ExtractedReceipt


class ExtractionError(Exception):
    """The receipt could not be read from the images (unreadable photo, model or API failure)."""


class ReceiptExtractor(Protocol):
    """Reads receipt photos into structured data.

    A Protocol, so implementations (stub, vision LLM, OCR + LLM) need no common base class
    and tests can pass any object with a matching `extract` method.
    """

    def extract(self, images: Sequence[bytes]) -> ExtractedReceipt:
        """Return the store, date, total and line items read from the photos.

        A long receipt comes as several photos, in order from top to bottom.
        Raises ExtractionError when the receipt cannot be read.
        """
        ...
