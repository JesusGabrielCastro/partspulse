from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models import Part, PurchaseOrder, PurchaseOrderStatus, User
from app.schemas import PaginatedPurchaseOrders, PurchaseOrderCreate, PurchaseOrderOut
from app.services.purchase_order_service import IllegalTransitionError, validate_transition

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


def _get_po_or_404(db: Session, po_id: int) -> PurchaseOrder:
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Purchase order not found", "details": []}},
        )
    return po


def _transition(db: Session, po: PurchaseOrder, target: PurchaseOrderStatus) -> PurchaseOrder:
    try:
        validate_transition(po.status, target)
    except IllegalTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "ILLEGAL_TRANSITION",
                    "message": f"Cannot move purchase order from {exc.current.value} to {exc.target.value}",
                    "details": [],
                }
            },
        )
    po.status = target
    return po


@router.get("", response_model=PaginatedPurchaseOrders)
def list_purchase_orders(
    status_filter: PurchaseOrderStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(PurchaseOrder)
    if status_filter is not None:
        query = query.filter(PurchaseOrder.status == status_filter)
    total = query.count()
    items = query.order_by(PurchaseOrder.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedPurchaseOrders(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    part = db.get(Part, payload.part_id)
    if part is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Part not found", "details": []}},
        )
    po = PurchaseOrder(
        part_id=part.id,
        requested_by=current_user.id,
        quantity=payload.quantity,
        status=PurchaseOrderStatus.REQUESTED,
        unit_price_at_request=part.unit_price,
        currency_code=part.supplier.currency_code,
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@router.post("/{po_id}/approve", response_model=PurchaseOrderOut)
def approve_purchase_order(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    po = _get_po_or_404(db, po_id)
    if po.requested_by == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "SELF_APPROVAL_FORBIDDEN",
                    "message": "You cannot approve your own purchase order request",
                    "details": [],
                }
            },
        )
    po = _transition(db, po, PurchaseOrderStatus.APPROVED)
    po.approved_by = current_user.id
    db.commit()
    db.refresh(po)
    return po


@router.post("/{po_id}/reject", response_model=PurchaseOrderOut)
def reject_purchase_order(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    po = _get_po_or_404(db, po_id)
    po = _transition(db, po, PurchaseOrderStatus.REJECTED)
    po.approved_by = current_user.id
    db.commit()
    db.refresh(po)
    return po


@router.post("/{po_id}/order", response_model=PurchaseOrderOut)
def order_purchase_order(po_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    po = _get_po_or_404(db, po_id)
    po = _transition(db, po, PurchaseOrderStatus.ORDERED)
    db.commit()
    db.refresh(po)
    return po


@router.post("/{po_id}/receive", response_model=PurchaseOrderOut)
def receive_purchase_order(po_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    po = _get_po_or_404(db, po_id)
    po = _transition(db, po, PurchaseOrderStatus.RECEIVED)
    part = db.get(Part, po.part_id)
    part.current_stock += po.quantity
    db.commit()
    db.refresh(po)
    return po
