import uuid
from pathlib import Path

# Content type -> file extension. HEIC covers iPhones that upload without converting to JPEG.
ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}


class UnsupportedImageTypeError(ValueError):
    pass


def save_image(data: bytes, content_type: str, upload_dir: Path) -> str:
    """Save image bytes under a random name and return that name (relative to upload_dir)."""
    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if extension is None:
        raise UnsupportedImageTypeError(content_type)

    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (upload_dir / filename).write_bytes(data)
    return filename


def delete_image(filename: str, upload_dir: Path) -> None:
    """Remove a saved image; a missing file is not an error."""
    (upload_dir / filename).unlink(missing_ok=True)
