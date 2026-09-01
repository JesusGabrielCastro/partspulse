import { useEffect, useState } from "react";
import { getPurchaseOrders, transitionPurchaseOrder } from "../api/endpoints";
import { extractErrorMessage } from "../api/client";
import type { PoStatus, PurchaseOrder } from "../types";
import { useAuth } from "../auth/AuthContext";

const NEXT_ACTION: Partial<Record<PoStatus, { action: "approve" | "reject" | "order" | "receive"; label: string }[]>> = {
  REQUESTED: [
    { action: "approve", label: "Approve" },
    { action: "reject", label: "Reject" },
  ],
  APPROVED: [{ action: "order", label: "Mark Ordered" }],
  ORDERED: [{ action: "receive", label: "Receive" }],
};

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    getPurchaseOrders({ status: statusFilter || undefined })
      .then((data) => setOrders(data.items))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  async function handleAction(id: number, action: "approve" | "reject" | "order" | "receive") {
    try {
      await transitionPurchaseOrder(id, action);
      load();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Purchase Orders</h1>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {["REQUESTED", "APPROVED", "REJECTED", "ORDERED", "RECEIVED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error} <button onClick={load} className="underline font-medium">Retry</button>
        </div>
      )}
      {!error && loading && <div className="bg-white rounded-lg shadow p-6 animate-pulse h-40" />}
      {!error && !loading && orders.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No purchase orders found.</div>
      )}
      {!error && !loading && orders.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Part</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Status</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id} className="border-t">
                  <td className="p-3">#{po.id}</td>
                  <td className="p-3">Part {po.part_id}</td>
                  <td className="p-3">{po.quantity}</td>
                  <td className="p-3">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="p-3">{po.unit_price_at_request} {po.currency_code}</td>
                  <td className="p-3 text-right space-x-2">
                    {user?.role === "admin" &&
                      (NEXT_ACTION[po.status] ?? []).map((a) => (
                        <button
                          key={a.action}
                          onClick={() => handleAction(po.id, a.action)}
                          className="text-xs bg-slate-800 text-white px-2 py-1 rounded"
                        >
                          {a.label}
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: PoStatus }) {
  const colors: Record<PoStatus, string> = {
    REQUESTED: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-blue-100 text-blue-800",
    REJECTED: "bg-red-100 text-red-800",
    ORDERED: "bg-purple-100 text-purple-800",
    RECEIVED: "bg-green-100 text-green-800",
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${colors[status]}`}>{status}</span>;
}
