import logging
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.schemas import (
    ReceiptItemRead,
    ReceiptItemUpdate,
    ReceiptRead,
    ReceiptSummary,
    ReceiptUpdate,
)
from app.config import Settings, get_settings
from app.db import get_session
from app.extraction import ExtractedReceipt, ExtractionError, ReceiptExtractor, get_extractor
from app.models import Receipt, ReceiptItem
from app.storage import ALLOWED_IMAGE_TYPES, delete_image, save_image

logger = logging.getLogger(__name__)


@lru_cache
def _configured_extractor() -> ReceiptExtractor:
    # One extractor per process, so the vision extractor reuses its API client and connections.
    return get_extractor(get_settings())


def provide_extractor() -> ReceiptExtractor:
    return _configured_extractor()


SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
ExtractorDep = Annotated[ReceiptExtractor, Depends(provide_extractor)]

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ReceiptRead)
def create_receipt(
    file: UploadFile, session: SessionDep, settings: SettingsDep, extractor: ExtractorDep
) -> Receipt:
    """Upload a receipt photo, extract its contents and store the result."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type {file.content_type!r}. "
            f"Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}.",
        )

    image = file.file.read()
    # Extract before saving: if extraction fails, there is no file to clean up.
    try:
        extracted = extractor.extract(image)
    except ExtractionError as error:
        logger.warning("Receipt extraction failed: %s", error)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail="Could not read the receipt from the photo."
        ) from error
    filename = save_image(image, file.content_type, settings.upload_dir)

    receipt = _to_model(extracted, image_path=filename)
    try:
        session.add(receipt)
        session.commit()
    except Exception:
        delete_image(filename, settings.upload_dir)
        raise
    return receipt


@router.get("", response_model=list[ReceiptSummary])
def list_receipts(session: SessionDep) -> list[ReceiptSummary]:
    """All receipts, most recently uploaded first."""
    stmt = (
        select(Receipt, func.count(ReceiptItem.id))
        .outerjoin(Receipt.items)
        .group_by(Receipt.id)
        .order_by(Receipt.created_at.desc(), Receipt.id.desc())
    )
    return [
        ReceiptSummary(
            id=receipt.id,
            store_name=receipt.store_name,
            purchase_date=receipt.purchase_date,
            total=receipt.total,
            status=receipt.status,
            created_at=receipt.created_at,
            item_count=item_count,
        )
        for receipt, item_count in session.execute(stmt)
    ]


@router.get("/{receipt_id}", response_model=ReceiptRead)
def get_receipt(receipt_id: int, session: SessionDep) -> Receipt:
    return _find_receipt(session, receipt_id)


@router.patch("/{receipt_id}", response_model=ReceiptRead)
def update_receipt(receipt_id: int, update: ReceiptUpdate, session: SessionDep) -> Receipt:
    """Correct the receipt header: store, NIP, date or total."""
    receipt = _find_receipt(session, receipt_id)
    for field, value in update.changes().items():
        setattr(receipt, field, value)
    session.commit()
    return receipt


@router.patch("/{receipt_id}/items/{item_id}", response_model=ReceiptItemRead)
def update_item(
    receipt_id: int, item_id: int, update: ReceiptItemUpdate, session: SessionDep
) -> ReceiptItem:
    """Correct one line item: its name, quantity, prices, discount or category."""
    item = _find_item(session, receipt_id, item_id)
    for field, value in update.changes().items():
        setattr(item, field, value)
    session.commit()
    return item


@router.delete("/{receipt_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(receipt_id: int, item_id: int, session: SessionDep) -> None:
    """Remove a line that is not on the receipt, e.g. one the model invented or duplicated."""
    session.delete(_find_item(session, receipt_id, item_id))
    session.commit()


def _find_receipt(session: Session, receipt_id: int) -> Receipt:
    receipt = session.get(Receipt, receipt_id, options=[selectinload(Receipt.items)])
    if receipt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Receipt not found.")
    return receipt


def _find_item(session: Session, receipt_id: int, item_id: int) -> ReceiptItem:
    item = session.get(ReceiptItem, item_id)
    # An item id from another receipt is treated as not found, not silently edited.
    if item is None or item.receipt_id != receipt_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Item not found.")
    return item


def _to_model(extracted: ExtractedReceipt, image_path: str) -> Receipt:
    return Receipt(
        **extracted.model_dump(exclude={"items"}),
        image_path=image_path,
        items=[ReceiptItem(**item.model_dump()) for item in extracted.items],
    )
