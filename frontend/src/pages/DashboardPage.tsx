import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getDashboardSummary, getParts } from "../api/endpoints";
import { extractErrorMessage } from "../api/client";
import type { DashboardSummary, Part } from "../types";
import { useAuth } from "../auth/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lowStockParts, setLowStockParts] = useState<Part[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([getDashboardSummary(), getParts({ low_stock: true, page_size: 10 })])
      .then(([summaryData, partsData]) => {
        setSummary(summaryData);
        setLowStockParts(partsData.items);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <SkeletonCards />;
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
        {error}{" "}
        <button onClick={load} className="underline font-medium">
          Retry
        </button>
      </div>
    );
  }
  if (!summary) return null;

  const badge =
    summary.conversion_status === "LIVE"
      ? null
      : summary.conversion_status === "CACHED"
      ? <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">rates cached</span>
      : <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">conversion not available</span>;

  return (
    <div className="space-y-6">
      <div className={`grid gap-4 ${user?.role === "admin" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
        <Card title="Total Parts" value={summary.total_parts} />
        <Card title="Low Stock" value={summary.low_stock_count} highlight={summary.low_stock_count > 0} />
        <Card
          title={`Open PO Value (${summary.base_currency})`}
          value={`$${Number(summary.total_open_po_value).toFixed(2)}`}
          extra={badge}
        />
        {user?.role === "admin" && <Card title="Pending Approvals" value={summary.pending_approvals ?? 0} />}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-700 mb-4">Open spend by supplier ({summary.base_currency})</h2>
        {summary.spend_by_supplier.length === 0 ? (
          <p className="text-gray-500 text-sm">No open purchase orders right now.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={summary.spend_by_supplier}>
              <XAxis dataKey="supplier" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="amount" fill="#334155" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-700 mb-4">Parts below reorder threshold</h2>
        {lowStockParts.length === 0 ? (
          <p className="text-gray-500 text-sm">No parts below threshold right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left text-gray-600">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {lowStockParts.map((p) => (
                  <tr key={p.id} className="border-t bg-red-50">
                    <td className="p-2 font-medium text-slate-800">{p.name}</td>
                    <td className="p-2 text-gray-500">{p.sku}</td>
                    <td className="p-2 text-red-600 font-semibold">{p.current_stock}</td>
                    <td className="p-2">{p.reorder_threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, highlight, extra }: { title: string; value: string | number; highlight?: boolean; extra?: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${highlight ? "ring-1 ring-red-300" : ""}`}>
      <p className="text-sm text-gray-500">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className={`text-2xl font-bold ${highlight ? "text-red-600" : "text-slate-800"}`}>{value}</p>
        {extra}
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse h-20" />
      ))}
    </div>
  );
}
