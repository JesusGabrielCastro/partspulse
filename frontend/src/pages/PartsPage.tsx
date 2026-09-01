import { useEffect, useState } from "react";
import { getParts, getSuppliers, createPart, createPurchaseOrder, updatePart } from "../api/endpoints";
import { extractErrorMessage } from "../api/client";
import type { Part, Supplier } from "../types";
import { useAuth } from "../auth/AuthContext";

const PAGE_SIZE = 10;

export default function PartsPage() {
  const { user } = useAuth();
  const [parts, setParts] = useState<Part[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => {
    const handle = setTimeout(load, 350); // debounce
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, supplierId, lowStockOnly, page]);

  function load() {
    setLoading(true);
    setError(null);
    getParts({
      q: q || undefined,
      supplier_id: supplierId ? Number(supplierId) : undefined,
      low_stock: lowStockOnly || undefined,
      page,
      page_size: PAGE_SIZE,
    })
      .then((data) => {
        setParts(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  async function handleRequestPO(partId: number) {
    const qty = prompt("Quantity to request?");
    if (!qty || Number(qty) <= 0) return;
    try {
      await createPurchaseOrder(partId, Number(qty));
      alert("Purchase order requested.");
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Parts</h1>
        {user?.role === "admin" && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm"
          >
            {showForm ? "Cancel" : "+ New Part"}
          </button>
        )}
      </div>

      {showForm && (
        <NewPartForm
          suppliers={suppliers}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {editingPart && (
        <EditPartForm
          part={editingPart}
          onDone={() => {
            setEditingPart(null);
            load();
          }}
          onCancel={() => setEditingPart(null)}
        />
      )}

      <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-lg shadow">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-[180px]"
        />
        <select
          value={supplierId}
          onChange={(e) => {
            setPage(1);
            setSupplierId(e.target.value);
          }}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              setPage(1);
              setLowStockOnly(e.target.checked);
            }}
          />
          Low stock only
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error} <button onClick={load} className="underline font-medium">Retry</button>
        </div>
      )}

      {!error && loading && <div className="bg-white rounded-lg shadow p-6 animate-pulse h-40" />}

      {!error && !loading && parts.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          No parts match this filter right now.
        </div>
      )}

      {!error && !loading && parts.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Threshold</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id} className={`border-t ${p.is_low_stock ? "bg-red-50" : ""}`}>
                  <td className="p-3 font-medium text-slate-800">
                    {p.name}
                    {p.is_low_stock && (
                      <span className="ml-2 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">low stock</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500">{p.sku}</td>
                  <td className="p-3">{p.current_stock}</td>
                  <td className="p-3">{p.reorder_threshold}</td>
                  <td className="p-3">${Number(p.unit_price).toFixed(2)}</td>
                  <td className="p-3 text-right space-x-2">
                    {user?.role === "admin" && (
                      <button
                        onClick={() => setEditingPart(p)}
                        className="text-slate-700 hover:underline text-xs"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleRequestPO(p.id)}
                      className="text-slate-700 hover:underline text-xs"
                    >
                      Request PO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Page {page} of {totalPages} ({total} parts)</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditPartForm({ part, onDone, onCancel }: { part: Part; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: part.name,
    reorder_threshold: String(part.reorder_threshold),
    unit_price: String(part.unit_price),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await updatePart(part.id, {
        name: form.name,
        reorder_threshold: Number(form.reorder_threshold),
        unit_price: form.unit_price as any,
      });
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 grid gap-3 sm:grid-cols-4 ring-1 ring-slate-300">
      <p className="sm:col-span-4 text-sm font-medium text-slate-600">Editing: {part.sku}</p>
      <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
      <input type="number" placeholder="Reorder threshold" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
      <input type="number" step="0.01" placeholder="Unit price" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
      <div className="flex gap-2">
        <button disabled={saving} className="flex-1 bg-slate-800 text-white rounded py-1.5 text-sm disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 border rounded py-1.5 text-sm">
          Cancel
        </button>
      </div>
      {error && <p className="text-red-600 text-sm sm:col-span-4">{error}</p>}
    </form>
  );
}

function NewPartForm({ suppliers, onCreated }: { suppliers: Supplier[]; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", sku: "", current_stock: "0", reorder_threshold: "0", unit_price: "", supplier_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.sku || !form.unit_price || !form.supplier_id) {
      setError("Name, SKU, unit price and supplier are required.");
      return;
    }
    setSaving(true);
    try {
      await createPart({
        name: form.name,
        sku: form.sku,
        current_stock: Number(form.current_stock),
        reorder_threshold: Number(form.reorder_threshold),
        unit_price: form.unit_price,
        supplier_id: Number(form.supplier_id),
      });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 grid gap-3 sm:grid-cols-3">
      <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
      <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
      <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="border rounded px-3 py-1.5 text-sm">
        <option value="">Supplier...</option>
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input type="number" placeholder="Current stock" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
      <input type="number" placeholder="Reorder threshold" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
      <input type="number" step="0.01" placeholder="Unit price" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
      {error && <p className="text-red-600 text-sm sm:col-span-3">{error}</p>}
      <button disabled={saving} className="sm:col-span-3 bg-slate-800 text-white rounded py-1.5 text-sm disabled:opacity-50">
        {saving ? "Saving..." : "Save Part"}
      </button>
    </form>
  );
}
