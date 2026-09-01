import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/parts", label: "Parts" },
    { to: "/suppliers", label: "Suppliers" },
    { to: "/purchase-orders", label: "Purchase Orders" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg">PartsPulse</span>
            <div className="hidden md:flex items-center gap-4">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="hover:text-slate-300 text-sm">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-sm">
            <span className="text-slate-300">{user?.email} ({user?.role})</span>
            <button onClick={handleLogout} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded">
              Logout
            </button>
          </div>

          <button
            className="md:hidden p-2"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="block w-6 h-0.5 bg-white mb-1.5" />
            <span className="block w-6 h-0.5 bg-white mb-1.5" />
            <span className="block w-6 h-0.5 bg-white" />
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-slate-700 px-4 py-3 space-y-2">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMenuOpen(false)}
                className="block text-sm text-slate-100 py-1"
              >
                {l.label}
              </Link>
            ))}
            <div className="border-t border-slate-600 pt-2 mt-2 text-sm text-slate-300">
              {user?.email} ({user?.role})
            </div>
            <button
              onClick={handleLogout}
              className="bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded w-full text-left text-sm"
            >
              Logout
            </button>
          </div>
        )}
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
