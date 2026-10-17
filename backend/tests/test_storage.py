from pathlib import Path

import pytest

from app.storage import UnsupportedImageTypeError, delete_image, save_image


def test_saves_bytes_and_returns_relative_name(tmp_path: Path) -> None:
    filename = save_image(b"jpeg bytes", "image/jpeg", tmp_path)

    assert Path(filename).name == filename
    assert (tmp_path / filename).read_bytes() == b"jpeg bytes"


@pytest.mark.parametrize(
    ("content_type", "extension"),
    [
        ("image/jpeg", ".jpg"),
        ("image/png", ".png"),
        ("image/webp", ".webp"),
        ("image/heic", ".heic"),
    ],
)
def test_extension_follows_content_type(tmp_path: Path, content_type: str, extension: str) -> None:
    assert save_image(b"x", content_type, tmp_path).endswith(extension)


def test_names_are_unique(tmp_path: Path) -> None:
    names = {save_image(b"x", "image/png", tmp_path) for _ in range(5)}

    assert len(names) == 5


def test_creates_missing_upload_dir(tmp_path: Path) -> None:
    upload_dir = tmp_path / "nested" / "uploads"

    filename = save_image(b"x", "image/png", upload_dir)

    assert (upload_dir / filename).is_file()


def test_rejects_unsupported_type(tmp_path: Path) -> None:
    with pytest.raises(UnsupportedImageTypeError):
        save_image(b"x", "application/pdf", tmp_path)

    assert list(tmp_path.iterdir()) == []


def test_delete_removes_file_and_tolerates_missing_one(tmp_path: Path) -> None:
    filename = save_image(b"x", "image/png", tmp_path)

    delete_image(filename, tmp_path)
    delete_image(filename, tmp_path)

    assert not (tmp_path / filename).exists()
