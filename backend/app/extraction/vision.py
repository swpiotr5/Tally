import base64
import logging
import time
from dataclasses import dataclass
from typing import Literal

import anthropic
from pydantic import ValidationError

from app.extraction.base import ExtractionError
from app.extraction.images import InvalidImageError, prepare_image
from app.extraction.prompt import SYSTEM_PROMPT, USER_PROMPT
from app.extraction.schemas import ExtractedReceipt

logger = logging.getLogger(__name__)

Effort = Literal["low", "medium", "high"]

# Room for adaptive thinking plus the JSON of a long receipt; thinking counts toward the cap.
MAX_TOKENS = 16_000


@dataclass(frozen=True)
class ExtractionStats:
    """Cost of one extraction: billed tokens and wall-clock time."""

    input_tokens: int
    output_tokens: int
    seconds: float


class VisionLLMExtractor:
    """Reads a receipt photo with a Claude vision model and structured outputs.

    The API client is passed in, so tests use a fake one and never call the paid API.
    """

    def __init__(
        self, client: anthropic.Anthropic, *, model: str, effort: Effort, max_image_side: int
    ) -> None:
        self._client = client
        self._model = model
        self._effort = effort
        self._max_image_side = max_image_side

    def extract(self, image: bytes) -> ExtractedReceipt:
        receipt, _ = self.extract_with_stats(image)
        return receipt

    def extract_with_stats(self, image: bytes) -> tuple[ExtractedReceipt, ExtractionStats]:
        try:
            jpeg = prepare_image(image, self._max_image_side)
        except InvalidImageError as error:
            raise ExtractionError("The file is not a readable image.") from error

        started = time.perf_counter()
        try:
            response = self._client.messages.parse(
                model=self._model,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": self._content(jpeg)}],
                output_config={"effort": self._effort},
                output_format=ExtractedReceipt,
            )
        except anthropic.APIStatusError as error:
            raise ExtractionError(
                f"Anthropic API error {error.status_code}: {error.message}"
            ) from error
        except anthropic.APIConnectionError as error:
            raise ExtractionError("Cannot reach the Anthropic API.") from error
        except ValidationError as error:
            # parse() validates the JSON against ExtractedReceipt. A refusal or an answer cut
            # off at max_tokens also ends up here, because its text is not valid JSON.
            raise ExtractionError(
                f"Model output does not fit the receipt schema: {error}"
            ) from error

        stats = ExtractionStats(
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            seconds=time.perf_counter() - started,
        )
        logger.info(
            "Receipt read by %s: %d input + %d output tokens in %.1f s, stop reason %s",
            self._model,
            stats.input_tokens,
            stats.output_tokens,
            stats.seconds,
            response.stop_reason,
        )
        if response.stop_reason != "end_turn" or response.parsed_output is None:
            raise ExtractionError(
                f"No receipt in the response (stop reason {response.stop_reason})."
            )
        return response.parsed_output, stats

    @staticmethod
    def _content(jpeg: bytes) -> list[dict]:
        return [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": base64.standard_b64encode(jpeg).decode("ascii"),
                },
            },
            {"type": "text", "text": USER_PROMPT},
        ]
