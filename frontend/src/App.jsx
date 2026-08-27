import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { PartnerAuthProvider } from "./context/PartnerAuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";

import PartnerLayout from "./layouts/PartnerLayout";
import AdminLayout from "./layouts/AdminLayout";
import CustomerLayout from "./layouts/CustomerLayout";
import VerifiedGate from "./components/partner/VerifiedGate";

import Landing from "./pages/Landing";
import CustomerRegister from "./pages/CustomerRegister";
import CustomerLogin from "./pages/CustomerLogin";

// Customer app pages
import CustomerDashboard from "./pages/customer/Dashboard";
import CustomerProfile from "./pages/customer/Profile";
import CustomerBilling from "./pages/customer/Billing";
import CustomerScreens from "./pages/customer/Screens";
import CustomerSubscription from "./pages/customer/Subscription";

// Partner auth pages
import PartnerRegister from "./pages/Partnerregister";
import PartnerLogin from "./pages/Partnerlogin";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CustomerForgotPassword from "./pages/CustomerForgotPassword";
import CustomerResetPassword from "./pages/CustomerResetPassword";

// Partner app pages
import Dashboard from "./pages/partner/Dashboard";
import Referrals from "./pages/partner/Referrals";
import Customers from "./pages/partner/Customers";
import Opportunities from "./pages/partner/Opportunities";
import Commissions from "./pages/partner/Commissions";
import Settlements from "./pages/partner/Settlements";
import Documents from "./pages/partner/Documents";
import Bank from "./pages/partner/Bank";
import Team from "./pages/partner/Team";
import Notifications from "./pages/partner/Notifications";
import Profile from "./pages/partner/Profile";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPartners from "./pages/admin/AdminPartners";
import AdminPartnerDetail from "./pages/admin/AdminPartnerDetail";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminBank from "./pages/admin/AdminBank";
import AdminOpportunities from "./pages/admin/AdminOpportunities";
import AdminCommissions from "./pages/admin/AdminCommissions";
import AdminSettlements from "./pages/admin/AdminSettlements";
import AdminConfig from "./pages/admin/AdminConfig";

// ======================================================
// PARTNER ROUTE GUARDS
// ======================================================

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("partnerToken");
  if (!token) return <Navigate to="/partner/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem("partnerToken");
  if (token) return <Navigate to="/partner/dashboard" replace />;
  return children;
}

// ======================================================
// ADMIN ROUTE GUARDS
// ======================================================

function AdminProtectedRoute({ children }) {
  const token = localStorage.getItem("adminToken");
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

function AdminPublicRoute({ children }) {
  const token = localStorage.getItem("adminToken");
  if (token) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

// ======================================================
// CUSTOMER ROUTE GUARDS
// ======================================================

function CustomerProtectedRoute({ children }) {
  const token = localStorage.getItem("customerToken");
  if (!token) return <Navigate to="/customer/login" replace />;
  return children;
}

function CustomerPublicRoute({ children }) {
  const token = localStorage.getItem("customerToken");
  if (token) return <Navigate to="/customer/dashboard" replace />;
  return children;
}

// ======================================================
// APP
// ======================================================

function App() {
  return (
    <PartnerAuthProvider>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/customer/register" element={<CustomerRegister />} />

            {/* CUSTOMER AUTH */}
            <Route path="/customer/login" element={<CustomerPublicRoute><CustomerLogin /></CustomerPublicRoute>} />
            <Route path="/customer/forgot-password" element={<CustomerPublicRoute><CustomerForgotPassword /></CustomerPublicRoute>} />
            <Route path="/customer/reset-password/:token" element={<CustomerPublicRoute><CustomerResetPassword /></CustomerPublicRoute>} />

            {/* CUSTOMER APP */}
            <Route path="/customer" element={<CustomerProtectedRoute><CustomerLayout /></CustomerProtectedRoute>}>
              <Route path="dashboard" element={<CustomerDashboard />} />
              <Route path="screens" element={<CustomerScreens />} />
              <Route path="subscription" element={<CustomerSubscription />} />
              <Route path="billing" element={<CustomerBilling />} />
              <Route path="profile" element={<CustomerProfile />} />
            </Route>

            {/* PARTNER AUTH */}
            <Route path="/partner/register" element={<PublicRoute><PartnerRegister /></PublicRoute>} />
            <Route path="/partner/login" element={<PublicRoute><PartnerLogin /></PublicRoute>} />
            <Route path="/partner/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/partner/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />

            {/* PARTNER APP */}
            <Route path="/partner" element={<ProtectedRoute><PartnerLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="referrals" element={<VerifiedGate><Referrals /></VerifiedGate>} />
              <Route path="customers" element={<VerifiedGate><Customers /></VerifiedGate>} />
              <Route path="opportunities" element={<VerifiedGate><Opportunities /></VerifiedGate>} />
              <Route path="commissions" element={<VerifiedGate><Commissions /></VerifiedGate>} />
              <Route path="settlements" element={<VerifiedGate><Settlements /></VerifiedGate>} />
              <Route path="documents" element={<Documents />} />
              <Route path="bank" element={<Bank />} />
              <Route path="team" element={<VerifiedGate><Team /></VerifiedGate>} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
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
              <Route path="opportunities" element={<AdminOpportunities />} />
              <Route path="commissions" element={<AdminCommissions />} />
              <Route path="settlements" element={<AdminSettlements />} />
              <Route path="config" element={<AdminConfig />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </BrowserRouter>
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </PartnerAuthProvider>
  );
}

export default App;
