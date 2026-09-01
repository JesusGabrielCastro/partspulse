import { useEffect, useState } from "react";
import { getSuppliers, createSupplier } from "../api/endpoints";
import { extractErrorMessage } from "../api/client";
import type { Supplier } from "../types";
import { useAuth } from "../auth/AuthContext";

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", currency_code: "", contact_email: "" });
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    getSuppliers()
      .then(setSuppliers)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name || form.currency_code.length !== 3) {
      setFormError("Name and a 3-letter currency code are required.");
      return;
    }
    try {
      await createSupplier(form);
      setShowForm(false);
      setForm({ name: "", currency_code: "", contact_email: "" });
      load();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Suppliers</h1>
        {user?.role === "admin" && (
          <button onClick={() => setShowForm((v) => !v)} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm">
            {showForm ? "Cancel" : "+ New Supplier"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 grid gap-3 sm:grid-cols-3">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
          <input placeholder="Currency (e.g. USD)" value={form.currency_code} onChange={(e) => setForm({ ...form, currency_code: e.target.value.toUpperCase() })} maxLength={3} className="border rounded px-3 py-1.5 text-sm" />
          <input placeholder="Contact email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
          {formError && <p className="text-red-600 text-sm sm:col-span-3">{formError}</p>}
          <button className="sm:col-span-3 bg-slate-800 text-white rounded py-1.5 text-sm">Save Supplier</button>
        </form>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {error} <button onClick={load} className="underline font-medium">Retry</button>
        </div>
      )}
      {!error && loading && <div className="bg-white rounded-lg shadow p-6 animate-pulse h-40" />}
      {!error && !loading && suppliers.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No suppliers yet.</div>
      )}
      {!error && !loading && suppliers.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Currency</th>
                <th className="p-3">Contact</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-medium text-slate-800">{s.name}</td>
                  <td className="p-3">{s.currency_code}</td>
                  <td className="p-3 text-gray-500">{s.contact_email ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
