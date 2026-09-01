from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

from app.models import PurchaseOrderStatus, UserRole


# ---------- Auth / Users ----------
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    role: UserRole = UserRole.staff


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Suppliers ----------
class SupplierBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    currency_code: str = Field(min_length=3, max_length=3)
    contact_email: EmailStr | None = None
    contact_phone: str | None = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    currency_code: str | None = Field(default=None, min_length=3, max_length=3)
    contact_email: EmailStr | None = None
    contact_phone: str | None = None


class SupplierOut(SupplierBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Parts ----------
class PartBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sku: str = Field(min_length=1, max_length=100)
    current_stock: int = Field(ge=0)
    reorder_threshold: int = Field(ge=0)
    unit_price: Decimal = Field(gt=0)
    supplier_id: int


class PartCreate(PartBase):
    pass


class PartUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    reorder_threshold: int | None = Field(default=None, ge=0)
    unit_price: Decimal | None = Field(default=None, gt=0)
    supplier_id: int | None = None


class PartOut(PartBase):
    id: int
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockAdjustment(BaseModel):
    delta: int
    reason: str = Field(min_length=1, max_length=255)


class PaginatedParts(BaseModel):
    items: list[PartOut]
    total: int
    page: int
    page_size: int


# ---------- Purchase Orders ----------
class PurchaseOrderCreate(BaseModel):
    part_id: int
    quantity: int = Field(gt=0)


class PurchaseOrderOut(BaseModel):
    id: int
    part_id: int
    requested_by: int
    approved_by: int | None
    quantity: int
    status: PurchaseOrderStatus
    unit_price_at_request: Decimal
    currency_code: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedPurchaseOrders(BaseModel):
    items: list[PurchaseOrderOut]
    total: int
    page: int
    page_size: int


# ---------- Dashboard ----------
class DashboardSummary(BaseModel):
    total_parts: int
    low_stock_count: int
    pending_approvals: int | None = None
    total_open_po_value: Decimal
    base_currency: str
    conversion_status: str
    rates_updated_at: datetime | None
    spend_by_supplier: list[dict]


# ---------- Error envelope ----------
class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list = []


class ErrorResponse(BaseModel):
    error: ErrorDetail
