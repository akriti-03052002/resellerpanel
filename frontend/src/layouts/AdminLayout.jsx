import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, FileCheck, Landmark,
  LogOut, Menu, X, PackageSearch, ChevronDown, Users
} from "lucide-react";
import Logo from "../components/ui/Logo";
import { useAdminAuth } from "../context/AdminAuthContext";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Partners",
    icon: Building2,
    // Only one partner type exists (reseller) — this isn't a separate
    // section of the app, just a different view of the same partners, so
    // it lives as a sub-item here instead of its own top-level nav entry.
    children: [
      { to: "/admin/partners", label: "All Partners" },
      { to: "/admin/reseller", label: "Reseller", icon: PackageSearch }
    ]
  },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/documents", label: "KYC Review", icon: FileCheck },
  { to: "/admin/bank", label: "Bank Review", icon: Landmark }
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(
    NAV_ITEMS.find((item) => item.children?.some((c) => location.pathname.startsWith(c.to)))?.label || null
  );

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
          {NAV_ITEMS.map((item) => {
            if (item.children) {
              const isExpanded = expandedGroup === item.label;
              const isGroupActive = item.children.some((c) => location.pathname.startsWith(c.to));

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => setExpandedGroup(isExpanded ? null : item.label)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      isGroupActive ? "text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown size={14} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="ml-4 pl-4 border-l border-white/10 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                              isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                            }`
                          }
                        >
                          {child.icon && <child.icon size={16} />}
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
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
            );
          })}
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
