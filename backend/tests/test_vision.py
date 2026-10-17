import base64
import io

import anthropic
import httpx2
import pytest
from PIL import Image
from pydantic import ValidationError

from app.extraction import (
    ExtractedReceipt,
    ExtractionError,
    StubExtractor,
    VisionLLMExtractor,
)
from app.extraction.prompt import SYSTEM_PROMPT, USER_PROMPT
from tests.helpers import FakeAnthropic, jpeg_photo, parsed_response

RECEIPT = StubExtractor().extract(b"")
REQUEST = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


def make_extractor(client: FakeAnthropic, max_image_side: int = 1568) -> VisionLLMExtractor:
    return VisionLLMExtractor(
        client,  # stands in for anthropic.Anthropic
        model="claude-haiku-5-5",
        effort="medium",
        max_image_side=max_image_side,
    )


def test_returns_the_parsed_receipt() -> None:
    client = FakeAnthropic(parsed_response(RECEIPT))

    assert make_extractor(client).extract(jpeg_photo()) == RECEIPT


def test_sends_prompt_schema_and_model_settings() -> None:
    client = FakeAnthropic(parsed_response(RECEIPT))

    make_extractor(client).extract(jpeg_photo())

    [call] = client.messages.calls
    assert call["model"] == "claude-haiku-5-5"
    assert call["system"] == SYSTEM_PROMPT
    assert call["output_format"] is ExtractedReceipt
    assert call["output_config"] == {"effort": "medium"}
    assert call["messages"][0]["content"][1] == {"type": "text", "text": USER_PROMPT}


def test_sends_the_photo_as_a_downscaled_jpeg() -> None:
    client = FakeAnthropic(parsed_response(RECEIPT))

    make_extractor(client, max_image_side=800).extract(jpeg_photo(3000, 4000))

    source = client.messages.calls[0]["messages"][0]["content"][0]["source"]
    sent = Image.open(io.BytesIO(base64.standard_b64decode(source["data"])))
    assert source["media_type"] == "image/jpeg"
    assert sent.format == "JPEG"
    assert sent.size == (600, 800)


def test_reports_tokens_and_time() -> None:
    client = FakeAnthropic(parsed_response(RECEIPT, input_tokens=1800, output_tokens=900))

    _, stats = make_extractor(client).extract_with_stats(jpeg_photo())

    assert (stats.input_tokens, stats.output_tokens) == (1800, 900)
    assert stats.seconds >= 0


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_rejects_a_response_without_a_complete_receipt(stop_reason: str) -> None:
    client = FakeAnthropic(parsed_response(None, stop_reason=stop_reason))

    with pytest.raises(ExtractionError, match=stop_reason):
        make_extractor(client).extract(jpeg_photo())


def test_rejects_output_that_does_not_fit_the_schema() -> None:
    with pytest.raises(ValidationError) as caught:
        ExtractedReceipt.model_validate_json('{"store_name": ""}')
    client = FakeAnthropic(error=caught.value)

    with pytest.raises(ExtractionError, match="schema"):
        make_extractor(client).extract(jpeg_photo())


@pytest.mark.parametrize(
    ("error", "message"),
    [
        (anthropic.APIConnectionError(request=REQUEST), "Cannot reach"),
        (
            anthropic.RateLimitError(
                "Too many requests", response=httpx2.Response(429, request=REQUEST), body=None
            ),
            "429",
        ),
        (
            anthropic.AuthenticationError(
                "Invalid API key", response=httpx2.Response(401, request=REQUEST), body=None
            ),
            "401",
        ),
    ],
)
def test_turns_api_failures_into_extraction_errors(error: Exception, message: str) -> None:
    client = FakeAnthropic(error=error)

    with pytest.raises(ExtractionError, match=message):
        make_extractor(client).extract(jpeg_photo())


def test_does_not_call_the_api_for_a_file_that_is_not_an_image() -> None:
    client = FakeAnthropic(parsed_response(RECEIPT))

    with pytest.raises(ExtractionError, match="readable image"):
        make_extractor(client).extract(b"not an image")

    assert client.messages.calls == []
