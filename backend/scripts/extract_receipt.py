"""Read one receipt with the vision extractor and print what it found.

Makes a real, paid API call. Run from backend/ with the API key in the environment; a long
receipt can be passed as several photos, top to bottom:

    uv run --env-file ../.env python -m scripts.extract_receipt top.jpg bottom.jpg
"""

import argparse
import os
import sys
from pathlib import Path

import anthropic

from app.extraction import ExtractionError, VisionLLMExtractor

# USD per million input / output tokens on the Claude API (prompts up to 100K tokens),
# as of October 2026. Check the pricing page before relying on these numbers.
PRICES = {
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-opus-5-5": (4.00, 20.00),
}


def main(argv: list[str] | None = None, client: anthropic.Anthropic | None = None) -> None:
    parser = argparse.ArgumentParser(description="Read one receipt with the vision model.")
    parser.add_argument("images", type=Path, nargs="+", help="photos of the receipt, top to bottom")
    parser.add_argument("--model", default=os.environ.get("VISION_MODEL", "claude-haiku-5-5"))
    parser.add_argument(
        "--effort",
        choices=["low", "medium", "high"],
        default=os.environ.get("VISION_EFFORT", "medium"),
    )
    parser.add_argument(
        "--max-side", type=int, default=int(os.environ.get("VISION_MAX_IMAGE_SIDE", "1568"))
    )
    args = parser.parse_args(argv)

    extractor = VisionLLMExtractor(
        client or anthropic.Anthropic(),
        model=args.model,
        effort=args.effort,
        max_image_side=args.max_side,
    )
    try:
        receipt, stats = extractor.extract_with_stats([path.read_bytes() for path in args.images])
    except ExtractionError as error:
        sys.exit(f"Could not read the receipt: {error}")

    print(receipt.model_dump_json(indent=2))
    summary = (
        f"{args.model}, effort {args.effort}, {len(args.images)} photo(s): "
        f"{stats.input_tokens} input + {stats.output_tokens} output tokens, {stats.seconds:.1f} s"
    )
    if args.model in PRICES:
        input_price, output_price = PRICES[args.model]
        cost = (stats.input_tokens * input_price + stats.output_tokens * output_price) / 1_000_000
        summary += f", ~${cost:.4f}"
    print(summary, file=sys.stderr)


if __name__ == "__main__":
    main()
