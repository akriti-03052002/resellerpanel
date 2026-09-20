import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { PartnerAuthProvider, usePartnerAuth } from "./context/PartnerAuthContext";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";

import PartnerLayout from "./layouts/PartnerLayout";
import AdminLayout from "./layouts/AdminLayout";
import CustomerLayout from "./layouts/CustomerLayout";
import VerifiedGate from "./components/partner/VerifiedGate";
import ErrorBoundary from "./components/ErrorBoundary";

import Landing from "./pages/Landing";
import CustomerReferralRegister from "./pages/CustomerReferralRegister";
import CustomerVerifyAndSetPassword from "./pages/CustomerVerifyAndSetPassword";
import CustomerPortalLogin from "./pages/CustomerPortalLogin";
import CustomerPortalDashboard from "./pages/CustomerPortalDashboard";
import CustomerScreens from "./pages/CustomerScreens";

// Partner auth pages
import PartnerRegister from "./pages/Partnerregister";
import PartnerLogin from "./pages/Partnerlogin";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// Partner app pages
import ResellerDashboard from "./pages/partner/reseller/ResellerDashboard";
import Documents from "./pages/partner/Documents";
import Bank from "./pages/partner/Bank";
import Team from "./pages/partner/Team";
import Notifications from "./pages/partner/Notifications";
import Profile from "./pages/partner/Profile";
import ResellerInventory from "./pages/partner/reseller/ResellerInventory";
import ResellerBuyLicenses from "./pages/partner/reseller/ResellerBuyLicenses";
import ResellerCustomers from "./pages/partner/reseller/ResellerCustomers";
import ResellerBilling from "./pages/partner/reseller/ResellerBilling";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPartners from "./pages/admin/AdminPartners";
import AdminPartnerDetail from "./pages/admin/AdminPartnerDetail";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminBank from "./pages/admin/AdminBank";
import AdminResellerDashboard from "./pages/admin/AdminResellerDashboard";

// ======================================================
// PARTNER ROUTE GUARDS
// ======================================================

function ProtectedRoute({ children }) {
  const { user } = usePartnerAuth();
  if (!user) return <Navigate to="/partner/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = usePartnerAuth();
  if (user) return <Navigate to="/partner/dashboard" replace />;
  return children;
}

// ======================================================
// ADMIN ROUTE GUARDS
// ======================================================

function AdminProtectedRoute({ children }) {
  const { user } = useAdminAuth();
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

function AdminPublicRoute({ children }) {
  const { user } = useAdminAuth();
  if (user) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

// ======================================================
// CUSTOMER PORTAL ROUTE GUARD
// ======================================================

function CustomerPortalProtectedRoute({ children }) {
  const token = localStorage.getItem("customerPortalToken");
  if (!token) return <Navigate to="/customer/login" replace />;
  return children;
}

// ======================================================
// APP
// ======================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PartnerAuthProvider>
        <AdminAuthProvider>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
                <Route path="/customer/register" element={<CustomerReferralRegister />} />
                <Route path="/customer/verify/:token" element={<CustomerVerifyAndSetPassword />} />
                <Route path="/customer/login" element={<CustomerPortalLogin />} />
                <Route path="/customer" element={<CustomerPortalProtectedRoute><CustomerLayout /></CustomerPortalProtectedRoute>}>
                  <Route path="dashboard" element={<CustomerPortalDashboard />} />
                  <Route path="screens" element={<CustomerScreens />} />
                </Route>

                {/* PARTNER AUTH */}
                <Route path="/partner/register" element={<PublicRoute><PartnerRegister /></PublicRoute>} />
                <Route path="/partner/login" element={<PublicRoute><PartnerLogin /></PublicRoute>} />
                <Route path="/partner/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                <Route path="/partner/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />

                {/* PARTNER APP */}
                <Route path="/partner" element={<ProtectedRoute><PartnerLayout /></ProtectedRoute>}>
                  <Route path="dashboard" element={<ResellerDashboard />} />
                  <Route path="documents" element={<Documents />} />
                  <Route path="bank" element={<Bank />} />
                  <Route path="team" element={<VerifiedGate><Team /></VerifiedGate>} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="profile" element={<Profile />} />

                  {/* Reseller-only — see PartnerLayout's resellerOnly nav items */}
                  <Route path="reseller/inventory" element={<VerifiedGate><ResellerInventory /></VerifiedGate>} />
                  <Route path="reseller/buy" element={<VerifiedGate><ResellerBuyLicenses /></VerifiedGate>} />
                  <Route path="reseller/customers" element={<VerifiedGate><ResellerCustomers /></VerifiedGate>} />
                  <Route path="reseller/billing" element={<VerifiedGate><ResellerBilling /></VerifiedGate>} />
                </Route>

                {/* ADMIN AUTH */}
                <Route path="/admin/login" element={<AdminPublicRoute><AdminLogin /></AdminPublicRoute>} />

                {/* ADMIN APP */}
                <Route path="/admin" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="partners" element={<AdminPartners />} />
                  <Route path="partners/:id" element={<AdminPartnerDetail />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="documents" element={<AdminDocuments />} />
                  <Route path="bank" element={<AdminBank />} />
                  <Route path="reseller" element={<AdminResellerDashboard />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </AdminAuthProvider>
      </PartnerAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
