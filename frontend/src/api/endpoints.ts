import { apiClient } from "./client";
import type { DashboardSummary, Paginated, Part, PurchaseOrder, Supplier } from "../types";

export async function login(email: string, password: string) {
  const { data } = await apiClient.post("/api/auth/login", { email, password });
  return data as { access_token: string; user: any };
}

export async function register(email: string, password: string, role: "admin" | "staff") {
  const { data } = await apiClient.post("/api/auth/register", { email, password, role });
  return data as { access_token: string; user: any };
}

export async function getSuppliers(): Promise<Supplier[]> {
  const { data } = await apiClient.get("/api/suppliers");
  return data;
}

export async function createSupplier(payload: Partial<Supplier>): Promise<Supplier> {
  const { data } = await apiClient.post("/api/suppliers", payload);
  return data;
}

export async function getParts(params: {
  q?: string;
  supplier_id?: number;
  low_stock?: boolean;
  page?: number;
  page_size?: number;
}): Promise<Paginated<Part>> {
  const { data } = await apiClient.get("/api/parts", { params });
  return data;
}

export async function createPart(payload: any): Promise<Part> {
  const { data } = await apiClient.post("/api/parts", payload);
  return data;
}

export async function updatePart(id: number, payload: Partial<Part>): Promise<Part> {
  const { data } = await apiClient.patch(`/api/parts/${id}`, payload);
  return data;
}

export async function updateSupplier(id: number, payload: Partial<Supplier>): Promise<Supplier> {
  const { data } = await apiClient.patch(`/api/suppliers/${id}`, payload);
  return data;
}

export async function deleteSupplier(id: number): Promise<void> {
  await apiClient.delete(`/api/suppliers/${id}`);
}

export async function getPurchaseOrders(params: { status?: string; page?: number }): Promise<Paginated<PurchaseOrder>> {
  const { data } = await apiClient.get("/api/purchase-orders", { params });
  return data;
}

export async function createPurchaseOrder(part_id: number, quantity: number): Promise<PurchaseOrder> {
  const { data } = await apiClient.post("/api/purchase-orders", { part_id, quantity });
  return data;
}

export async function transitionPurchaseOrder(
  id: number,
  action: "approve" | "reject" | "order" | "receive"
): Promise<PurchaseOrder> {
  const { data } = await apiClient.post(`/api/purchase-orders/${id}/${action}`);
  return data;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get("/api/dashboard/summary");
  return data;
}
