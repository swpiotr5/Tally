"""Test doubles and sample data shared by several test modules."""

import io
from types import SimpleNamespace

from PIL import Image

from app.extraction import ExtractedReceipt


def jpeg_photo(width: int = 3000, height: int = 4000) -> bytes:
    """A blank JPEG with the proportions of a phone photo."""
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="JPEG")
    return buffer.getvalue()


class FakeMessages:
    """Stands in for client.messages and records the arguments of every parse() call."""

    def __init__(self, response: object = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[dict] = []

    def parse(self, **kwargs: object) -> object:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.response


class FakeAnthropic:
    """Just enough of anthropic.Anthropic for the vision extractor; never touches the network."""

    def __init__(self, response: object = None, error: Exception | None = None) -> None:
        self.messages = FakeMessages(response, error)


def parsed_response(
    receipt: ExtractedReceipt | None,
    *,
    stop_reason: str = "end_turn",
    input_tokens: int = 1800,
    output_tokens: int = 900,
) -> SimpleNamespace:
    """The parts of a messages.parse() response that the extractor reads."""
    return SimpleNamespace(
        parsed_output=receipt,
        stop_reason=stop_reason,
        usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
    )
