import io

from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

# Lets Pillow open HEIC/HEIF photos, which iPhones may upload instead of JPEG.
register_heif_opener()

JPEG_QUALITY = 85


class InvalidImageError(ValueError):
    """The bytes are not an image that can be decoded."""


def prepare_image(data: bytes, max_side: int) -> bytes:
    """Return the photo as a JPEG whose longer side is at most max_side pixels.

    - applies the EXIF orientation: phones often store rotation only as metadata,
      so without this the model would get a sideways receipt,
    - converts to RGB (JPEG has no alpha channel; transparency becomes white),
    - downscales, never upscales: image tokens grow with the pixel count,
    - drops all metadata (EXIF, GPS), which the model does not need.
    """
    try:
        with Image.open(io.BytesIO(data)) as original:
            image = _to_rgb(ImageOps.exif_transpose(original))
    except (UnidentifiedImageError, OSError) as error:
        raise InvalidImageError("Cannot decode the image.") from error

    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return output.getvalue()


def _to_rgb(image: Image.Image) -> Image.Image:
    if image.mode in ("RGBA", "LA") or "transparency" in image.info:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")
