import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Landmark,
  FileText, UserCog, Bell, UserCircle, LogOut, Menu, X, Building2, ChevronDown, Lock,
  PackageSearch, Receipt
} from "lucide-react";
import Logo from "../components/ui/Logo";
import NotificationBell from "../components/partner/NotificationBell";
import { usePartnerAuth } from "../context/PartnerAuthContext";
import api from "../services/api";

// `locked: true` items require full KYC + bank verification — mirrors the
// requireVerifiedPartner backend gate on these route groups.
//
// Resellers purchase licenses from SPOTX and manage their own customer
// allocations and billing from this panel.
const NAV_ITEMS = [
  { to: "/partner/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { to: "/partner/reseller/customers", label: "Customers", icon: Building2, permission: "reseller:customers:manage", locked: true, resellerOnly: true },
  { to: "/partner/reseller/inventory", label: "Software Licenses", icon: PackageSearch, permission: "reseller:inventory:view", locked: true, resellerOnly: true },
  { to: "/partner/reseller/billing", label: "Billing", icon: Receipt, permission: "reseller:billing:view", locked: true, resellerOnly: true },

  { to: "/partner/documents", label: "Documents", icon: FileText, permission: "documents:view" },
  { to: "/partner/bank", label: "Bank Account", icon: Landmark, permission: "bank:view" },
  { to: "/partner/team", label: "Team", icon: UserCog, permission: "team:view", locked: true },
  { to: "/partner/notifications", label: "Notifications", icon: Bell, permission: "notifications:view" },
  { to: "/partner/profile", label: "Profile", icon: UserCircle, permission: "profile:view" }
];

export default function PartnerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { partner, user, hasPermission, logout } = usePartnerAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(partner?.status === "active");

  // This layout stays mounted across every /partner/* navigation, so a
  // one-time fetch on mount would go stale the moment an admin verifies the
  // partner mid-session — the lock icons would never clear without a full
  // page reload. Re-checking on every navigation and whenever the tab
  // regains focus keeps it honest without needing a hard refresh.
  useEffect(() => {
    api.get("/partner/profile")
      .then((res) => setIsVerified(res.data.data.partner.status === "active"))
      .catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const onFocus = () => {
      api.get("/partner/profile")
        .then((res) => setIsVerified(res.data.data.partner.status === "active"))
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/partner/login", { replace: true });
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
          {NAV_ITEMS.filter((item) =>
            hasPermission(item.permission) &&
            (!item.resellerOnly || partner?.partnerType === "reseller")
          ).map((item) => (
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
              {item.locked && !isVerified && <Lock size={13} className="text-slate-400 shrink-0" />}
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
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{partner?.businessName}</p>
            <p className="text-xs text-slate-400">{partner?.partnerCode}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <NotificationBell />

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1.5">
                    <Link
                      to="/partner/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <UserCircle size={16} />
                      Edit Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
