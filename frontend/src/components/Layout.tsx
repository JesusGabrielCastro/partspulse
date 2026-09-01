import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-bold text-lg">PartsPulse</span>
            <Link to="/dashboard" className="hover:text-slate-300 text-sm">Dashboard</Link>
            <Link to="/parts" className="hover:text-slate-300 text-sm">Parts</Link>
            <Link to="/suppliers" className="hover:text-slate-300 text-sm">Suppliers</Link>
            <Link to="/purchase-orders" className="hover:text-slate-300 text-sm">Purchase Orders</Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-300">{user?.email} ({user?.role})</span>
            <button onClick={handleLogout} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
