import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import { Select, Input } from "../../components/ui/Input";
import CustomerDetailModal from "../../components/admin/CustomerDetailModal";

const STATUSES = ["", "trial", "active", "expired", "cancelled"];

const subscriptionBadge = (customer) => {
  if (customer.subscription.status === "trial" && customer.trialExpired) {
    return <Badge tone="danger">Trial expired</Badge>;
  }
  return <Badge status={customer.subscription.status} />;
};

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [markPaidId, setMarkPaidId] = useState(null);
  const [revenue, setRevenue] = useState("");
  const [screenCount, setScreenCount] = useState("");
  const [plan, setPlan] = useState("basic");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [viewCustomer, setViewCustomer] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const load = () => {
    adminApi.get("/admin/customers", { params: { status: status || undefined, partnerId: vendorId || undefined } })
      .then((res) => setCustomers(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every customer belongs to a Vendor partner (see customerPublicController
  // — registration only accepts a vendor's referral code), so the filter
  // only ever needs to list vendors, not every partner type.
  useEffect(() => {
    adminApi.get("/admin/partners", { params: { partnerType: "vendor" } })
      .then((res) => setVendors(res.data.data));
  }, []);

  const startMarkPaid = (id) => {
    setMarkPaidId(id);
    setError("");
    setRevenue("");
    setScreenCount("");
    setPlan("basic");
  };

  const submitMarkPaid = async (id) => {
    setError("");
    setBusyId(id);
    try {
      await adminApi.patch(`/admin/customers/${id}/mark-paid`, {
        revenue: Number(revenue) || 0,
        screenCount: screenCount === "" ? undefined : Number(screenCount),
        plan
      });
      setMarkPaidId(null);
      setRevenue("");
      setScreenCount("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong recording payment.");
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id) => {
    setBusyId(id);
    try {
      await adminApi.patch(`/admin/customers/${id}/cancel`);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const expire = async (id) => {
    setBusyId(id);
    try {
      await adminApi.patch(`/admin/customers/${id}/expire`);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const resetCredentials = async (id) => {
    setResettingId(id);
    setError("");
    setSuccessMessage("");
    try {
      const res = await adminApi.post(`/admin/customers/${id}/reset-credentials`);
      setSuccessMessage(res.data.message);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't send the set-password email. Try again.");
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <div className="flex gap-3">
          <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-64">
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v._id} value={v._id}>{v.legalEntity.businessName} ({v.partnerCode})</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-56">
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : "All statuses"}</option>)}
          </Select>
        </div>
      </div>
      <p className="text-sm text-slate-500 -mt-4">
        Vendor partners' end customers, across all vendors. No live payment gateway yet — "Mark Paid" records the payment manually and generates the vendor's commission for this cycle.
      </p>

      {successMessage && (
        <Card className="p-5 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">{successMessage}</p>
          <button type="button" onClick={() => setSuccessMessage("")} className="text-xs text-emerald-700 hover:underline mt-2">
            Dismiss
          </button>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No customers found."
            rows={customers}
            columns={[
              {
                key: "company",
                header: "Company",
                render: (c) => (
                  <button type="button" onClick={() => setViewCustomer(c)} className="font-medium text-slate-900 hover:text-brand-red hover:underline text-left">
                    {c.companyName}
                  </button>
                )
              },
              { key: "vendor", header: "Vendor", render: (c) => c.partnerId?.legalEntity?.businessName || "—" },
              { key: "email", header: "Email", render: (c) => c.email },
              { key: "status", header: "Subscription", render: (c) => subscriptionBadge(c) },
              { key: "plan", header: "Plan", render: (c) => c.subscription.plan ? <Badge tone="neutral">{c.subscription.plan}</Badge> : "—" },
              { key: "trial", header: "Trial Ends", render: (c) => c.trial?.endsAt ? new Date(c.trial.endsAt).toLocaleDateString() : "—" },
              { key: "date", header: "Registered", render: (c) => new Date(c.createdAt).toLocaleDateString() },
              {
                key: "actions",
                header: "",
                render: (c) =>
                  markPaidId === c._id ? (
                    <div className="flex items-center gap-2">
                      <Select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-28">
                        <option value="basic">Basic</option>
                        <option value="premium">Premium</option>
                      </Select>
                      <Input placeholder="Revenue ₹" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} className="w-24" />
                      <Input placeholder="Screens" type="number" value={screenCount} onChange={(e) => setScreenCount(e.target.value)} className="w-20" />
                      <button onClick={() => submitMarkPaid(c._id)} disabled={busyId === c._id} className="text-xs font-semibold text-emerald-600 hover:underline disabled:opacity-50">Save</button>
                      <button onClick={() => setMarkPaidId(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {["trial", "expired"].includes(c.subscription.status) && (
                        <button onClick={() => startMarkPaid(c._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Mark Paid</button>
                      )}
                      {c.subscription.status === "active" && (
                        <button onClick={() => expire(c._id)} disabled={busyId === c._id} className="text-xs font-semibold text-amber-600 hover:underline disabled:opacity-50">Expire</button>
                      )}
                      {c.subscription.status !== "cancelled" && (
                        <button onClick={() => cancel(c._id)} disabled={busyId === c._id} className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50">Cancel</button>
                      )}
                      {!c.auth?.hasPassword && (
                        <button
                          type="button"
                          onClick={() => resetCredentials(c._id)}
                          disabled={resettingId === c._id}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:underline disabled:opacity-50"
                        >
                          <KeyRound size={13} /> Reset Login
                        </button>
                      )}
                    </div>
                  )
              }
            ]}
          />
        )}
      </Card>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {viewCustomer && <CustomerDetailModal customer={viewCustomer} onClose={() => setViewCustomer(null)} />}
    </div>
  );
}
