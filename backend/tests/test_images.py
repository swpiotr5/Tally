import io

import pytest
from PIL import Image

from app.extraction.images import InvalidImageError, prepare_image

EXIF_ORIENTATION = 0x0112


def encode(image: Image.Image, image_format: str, **params: object) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format=image_format, **params)
    return buffer.getvalue()


def decode(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def test_returns_jpeg() -> None:
    png = encode(Image.new("RGB", (300, 200), "white"), "PNG")

    prepared = decode(prepare_image(png, max_side=1568))

    assert prepared.format == "JPEG"
    assert prepared.mode == "RGB"


def test_downscales_the_longer_side_and_keeps_proportions() -> None:
    photo = encode(Image.new("RGB", (3000, 4000), "white"), "JPEG")

    prepared = decode(prepare_image(photo, max_side=1568))

    assert prepared.size == (1176, 1568)


def test_never_upscales() -> None:
    photo = encode(Image.new("RGB", (800, 600), "white"), "JPEG")

    prepared = decode(prepare_image(photo, max_side=1568))

    assert prepared.size == (800, 600)


def test_applies_exif_orientation() -> None:
    # Stored landscape, marked "rotate 90° clockwise to display" as phones do.
    exif = Image.Exif()
    exif[EXIF_ORIENTATION] = 6
    photo = encode(Image.new("RGB", (400, 200), "white"), "JPEG", exif=exif)

    prepared = decode(prepare_image(photo, max_side=1568))

    assert prepared.size == (200, 400)


def test_drops_metadata() -> None:
    exif = Image.Exif()
    exif[EXIF_ORIENTATION] = 1
    exif[0x010F] = "Phone maker"  # Make
    photo = encode(Image.new("RGB", (400, 200), "white"), "JPEG", exif=exif)

    prepared = decode(prepare_image(photo, max_side=1568))

    assert dict(prepared.getexif()) == {}


def test_fills_transparency_with_white() -> None:
    transparent = encode(Image.new("RGBA", (10, 10), (0, 0, 0, 0)), "PNG")

    prepared = decode(prepare_image(transparent, max_side=1568))

    red, green, blue = prepared.getpixel((5, 5))
    assert min(red, green, blue) > 245


def test_reads_heic() -> None:
    heic = encode(Image.new("RGB", (64, 48), "white"), "HEIF")

    prepared = decode(prepare_image(heic, max_side=1568))

    assert prepared.format == "JPEG"
    assert prepared.size == (64, 48)


def test_rejects_bytes_that_are_not_an_image() -> None:
    with pytest.raises(InvalidImageError):
        prepare_image(b"definitely not an image", max_side=1568)
