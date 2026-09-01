from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models import Part, User
from app.schemas import PaginatedParts, PartCreate, PartOut, PartUpdate, StockAdjustment
from app.services.inventory_service import is_low_stock

router = APIRouter(prefix="/api/parts", tags=["parts"])


def _to_out(part: Part) -> PartOut:
    return PartOut(
        id=part.id,
        name=part.name,
        sku=part.sku,
        current_stock=part.current_stock,
        reorder_threshold=part.reorder_threshold,
        unit_price=part.unit_price,
        supplier_id=part.supplier_id,
        is_low_stock=is_low_stock(part),
        created_at=part.created_at,
        updated_at=part.updated_at,
    )


SORTABLE_FIELDS = {
    "name": Part.name,
    "sku": Part.sku,
    "current_stock": Part.current_stock,
    "reorder_threshold": Part.reorder_threshold,
    "unit_price": Part.unit_price,
}


@router.get("", response_model=PaginatedParts)
def list_parts(
    q: str | None = None,
    supplier_id: int | None = None,
    low_stock: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    sort: str | None = Query(default=None, description="e.g. name or -unit_price"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Part)
    if q:
        like = f"%{q}%"
        query = query.filter((Part.name.ilike(like)) | (Part.sku.ilike(like)))
    if supplier_id is not None:
        query = query.filter(Part.supplier_id == supplier_id)
    if low_stock:
        query = query.filter(Part.current_stock <= Part.reorder_threshold)

    total = query.count()
    order_col = Part.id
    if sort:
        field = sort.lstrip("-")
        col = SORTABLE_FIELDS.get(field)
        if col is not None:
            order_col = col.desc() if sort.startswith("-") else col.asc()
    items = query.order_by(order_col).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedParts(items=[_to_out(p) for p in items], total=total, page=page, page_size=page_size)


@router.post("", response_model=PartOut, status_code=status.HTTP_201_CREATED)
def create_part(payload: PartCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    existing = db.query(Part).filter(Part.sku == payload.sku).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "SKU_TAKEN", "message": "SKU already exists", "details": []}},
        )
    part = Part(**payload.model_dump())
    db.add(part)
    db.commit()
    db.refresh(part)
    return _to_out(part)


@router.patch("/{part_id}", response_model=PartOut)
def update_part(part_id: int, payload: PartUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    part = db.get(Part, part_id)
    if part is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Part not found", "details": []}},
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(part, field, value)
    db.commit()
    db.refresh(part)
    return _to_out(part)


@router.delete("/{part_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_part(part_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    part = db.get(Part, part_id)
    if part is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Part not found", "details": []}},
        )
    db.delete(part)
    db.commit()


@router.post("/{part_id}/stock-adjustment", response_model=PartOut)
def adjust_stock(
    part_id: int, payload: StockAdjustment, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    part = db.get(Part, part_id)
    if part is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Part not found", "details": []}},
        )
    new_stock = part.current_stock + payload.delta
    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "NEGATIVE_STOCK", "message": "Adjustment would make stock negative", "details": []}},
        )
    part.current_stock = new_stock
    db.commit()
    db.refresh(part)
    return _to_out(part)
