import anthropic

from app.config import Settings
from app.extraction.base import ExtractionError, ReceiptExtractor
from app.extraction.schemas import ExtractedItem, ExtractedReceipt
from app.extraction.stub import StubExtractor
from app.extraction.vision import VisionLLMExtractor

__all__ = [
    "ExtractedItem",
    "ExtractedReceipt",
    "ExtractionError",
    "ReceiptExtractor",
    "StubExtractor",
    "VisionLLMExtractor",
    "get_extractor",
]

# A receipt takes seconds; a hanging request should fail while the user is still waiting.
VISION_TIMEOUT_SECONDS = 60.0


def get_extractor(settings: Settings) -> ReceiptExtractor:
    """Build the extractor selected by the EXTRACTOR setting."""
    match settings.extractor:
        case "stub":
            return StubExtractor()
        case "vision":
            if settings.anthropic_api_key is None:
                raise ValueError("ANTHROPIC_API_KEY is required for the vision extractor")
            client = anthropic.Anthropic(
                api_key=settings.anthropic_api_key.get_secret_value(),
                timeout=VISION_TIMEOUT_SECONDS,
                max_retries=1,
            )
            return VisionLLMExtractor(
                client,
                model=settings.vision_model,
                effort=settings.vision_effort,
                max_image_side=settings.vision_max_image_side,
            )
    raise ValueError(f"Unknown extractor: {settings.extractor!r}")
