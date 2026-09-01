from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.clients.exchange_rate_client import ConversionStatus, exchange_rate_client
from app.core.config import get_settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Part, PurchaseOrder, PurchaseOrderStatus, Supplier, User, UserRole
from app.schemas import DashboardSummary
from app.services.inventory_service import is_low_stock

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
settings = get_settings()

OPEN_PO_STATUSES = {PurchaseOrderStatus.REQUESTED, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.ORDERED}


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    parts = db.query(Part).all()
    total_parts = len(parts)
    low_stock_count = sum(1 for p in parts if is_low_stock(p))

    open_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_(OPEN_PO_STATUSES)).all()

    total_open_po_value = Decimal("0")
    spend_by_supplier: dict[str, Decimal] = {}
    overall_status = ConversionStatus.LIVE
    rates_updated_at: datetime | None = None

    part_by_id = {p.id: p for p in parts}

    for po in open_pos:
        line_total = po.unit_price_at_request * po.quantity
        result = exchange_rate_client.get_rate(po.currency_code, settings.base_currency)

        if result.status == ConversionStatus.UNAVAILABLE:
            overall_status = ConversionStatus.UNAVAILABLE
            continue
        if result.status == ConversionStatus.CACHED and overall_status == ConversionStatus.LIVE:
            overall_status = ConversionStatus.CACHED
        if result.updated_at:
            ts = datetime.fromtimestamp(result.updated_at, tz=timezone.utc)
            if rates_updated_at is None or ts > rates_updated_at:
                rates_updated_at = ts

        converted = line_total * result.rate
        total_open_po_value += converted

        part = part_by_id.get(po.part_id)
        supplier_name = part.supplier.name if part else "Unknown"
        spend_by_supplier[supplier_name] = spend_by_supplier.get(supplier_name, Decimal("0")) + converted

    pending_approvals = None
    if current_user.role == UserRole.admin:
        pending_approvals = (
            db.query(PurchaseOrder).filter(PurchaseOrder.status == PurchaseOrderStatus.REQUESTED).count()
        )

    return DashboardSummary(
        total_parts=total_parts,
        low_stock_count=low_stock_count,
        pending_approvals=pending_approvals,
        total_open_po_value=total_open_po_value,
        base_currency=settings.base_currency,
        conversion_status=overall_status.value,
        rates_updated_at=rates_updated_at,
        spend_by_supplier=[{"supplier": k, "amount": float(v)} for k, v in spend_by_supplier.items()],
    )
