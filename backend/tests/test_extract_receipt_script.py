import json
from pathlib import Path

import pytest

from app.extraction import StubExtractor
from scripts.extract_receipt import main
from tests.helpers import FakeAnthropic, jpeg_photo, parsed_response

RECEIPT = StubExtractor().extract(b"")


def test_prints_the_receipt_as_json_and_the_cost(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    image = tmp_path / "receipt.jpg"
    image.write_bytes(jpeg_photo())
    client = FakeAnthropic(parsed_response(RECEIPT, input_tokens=2000, output_tokens=1000))

    main([str(image), "--model", "claude-haiku-5-5", "--effort", "low"], client=client)

    output = capsys.readouterr()
    assert json.loads(output.out)["store_name"] == "Stub Market"
    assert "effort low: 2000 input + 1000 output tokens" in output.err
    # 2000 * $0.10 / 1M + 1000 * $0.50 / 1M
    assert "~$0.0007" in output.err


def test_exits_with_a_message_when_the_receipt_cannot_be_read(tmp_path: Path) -> None:
    image = tmp_path / "notes.txt"
    image.write_text("not an image")

    with pytest.raises(SystemExit, match="Could not read the receipt"):
        main([str(image)], client=FakeAnthropic())
