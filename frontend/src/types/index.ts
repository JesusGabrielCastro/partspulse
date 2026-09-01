export type UserRole = "admin" | "staff";

export interface User {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  currency_code: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface Part {
  id: number;
  name: string;
  sku: string;
  current_stock: number;
  reorder_threshold: number;
  unit_price: string;
  supplier_id: number;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type PoStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "ORDERED" | "RECEIVED";

export interface PurchaseOrder {
  id: number;
  part_id: number;
  requested_by: number;
  approved_by: number | null;
  quantity: number;
  status: PoStatus;
  unit_price_at_request: string;
  currency_code: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  total_parts: number;
  low_stock_count: number;
  pending_approvals: number | null;
  total_open_po_value: string;
  base_currency: string;
  conversion_status: "LIVE" | "CACHED" | "UNAVAILABLE";
  rates_updated_at: string | null;
  spend_by_supplier: { supplier: string; amount: number }[];
}

export interface ApiError {
  error: { code: string; message: string; details: unknown[] };
}
