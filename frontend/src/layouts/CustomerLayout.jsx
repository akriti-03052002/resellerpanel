import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Monitor, LogOut, Menu, X } from "lucide-react";
import Logo from "../components/ui/Logo";
import customerPortalApi from "../services/customerPortalApi";

// Same sidebar shell as PartnerLayout/AdminLayout, scoped down to what a
// read-only customer portal actually needs — no permission system, no
// verification lock icons, just the two pages this portal has.
const NAV_ITEMS = [
  { to: "/customer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customer/screens", label: "Your Screens", icon: Monitor }
];

export default function CustomerLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["customerPortal", "me"],
    queryFn: () => customerPortalApi.get("/customer-portal/me").then((res) => res.data.data)
  });

  const handleLogout = () => {
    localStorage.removeItem("customerPortalToken");
    navigate("/customer/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-light-grey">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
          <Logo size="sm" />
          <button className="lg:hidden text-slate-500 hover:text-brand-black" onClick={() => setSidebarOpen(false)}>
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
                  isActive ? "bg-brand-black text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 gap-3">
          <button className="lg:hidden text-slate-500 hover:text-brand-black shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="ml-auto min-w-0 text-right">
            <p className="text-sm font-semibold text-slate-900 truncate">{data?.companyName}</p>
            <p className="text-xs text-slate-400">With {data?.resellerName}</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
