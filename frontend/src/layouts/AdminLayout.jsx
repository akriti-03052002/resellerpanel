import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, FileCheck, Landmark, Briefcase,
  SlidersHorizontal, Wallet, LogOut, Menu, X, Users
} from "lucide-react";
import Logo from "../components/ui/Logo";
import { useAdminAuth } from "../context/AdminAuthContext";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/partners", label: "Partners", icon: Building2 },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/documents", label: "KYC Review", icon: FileCheck },
  { to: "/admin/bank", label: "Bank Review", icon: Landmark },
  { to: "/admin/opportunities", label: "Opportunities", icon: Briefcase },
  { to: "/admin/commissions", label: "Commissions", icon: Wallet },
  { to: "/admin/settlements", label: "Settlements", icon: Landmark },
  { to: "/admin/config", label: "Programs & Tiers", icon: SlidersHorizontal }
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-light-grey">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-brand-black text-white flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center">
            <Logo size="sm" dark />
            <span className="ml-2 text-xs uppercase tracking-wide text-white/50">Admin</span>
          </div>
          <button className="lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
          <button className="lg:hidden text-slate-500 hover:text-brand-black" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="text-right ml-auto">
            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role?.replace(/_/g, " ")}</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
