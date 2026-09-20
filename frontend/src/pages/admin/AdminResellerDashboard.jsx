import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import PromptModal from "../../components/ui/PromptModal";

export default function AdminResellerDashboard() {
  const queryClient = useQueryClient();

  const { data: summary = null, isLoading: summaryLoading } = useQuery({
    queryKey: ["admin", "reseller", "dashboard"],
    queryFn: () => adminApi.get("/admin/reseller/dashboard").then((res) => res.data.data)
  });
  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ["admin", "partners", { partnerType: "reseller" }],
    queryFn: () => adminApi.get("/admin/partners", { params: { partnerType: "reseller" } }).then((res) => res.data.data || [])
  });
  const { data: requestedOrders = [], isLoading: requestedOrdersLoading } = useQuery({
    queryKey: ["admin", "reseller", "license-orders", { status: "requested" }],
    queryFn: () =>
      adminApi.get("/admin/reseller/license-orders", { params: { status: "requested" } }).then((res) => res.data.data || [])
  });

  const loading = summaryLoading || partnersLoading || requestedOrdersLoading;

  const load = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "reseller", "dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "partners", { partnerType: "reseller" }] });
    queryClient.invalidateQueries({ queryKey: ["admin", "reseller", "license-orders"] });
  };

  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [reviewError, setReviewError] = useState("");

  const runBilling = async () => {
    setRunning(true);
    setMessage("");
    try {
      const res = await adminApi.post("/admin/reseller/run-billing");
      setMessage(`Billing run complete — ${res.data.data.results.length} partner(s) processed.`);
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || "Billing run failed.");
    } finally {
      setRunning(false);
    }
  };

  const checkNotifications = async () => {
    setChecking(true);
    setMessage("");
    try {
      const res = await adminApi.post("/admin/reseller/check-notifications");
      const d = res.data.data;
      setMessage(`Checks complete — ${d.overdueMarked} marked overdue, ${d.dueDateReminders} due-date reminders, ${d.lowInventoryAlerts} low-inventory alerts, ${d.agreementExpiringFlags} agreement-expiry flags.`);
    } catch (err) {
      setMessage(err.response?.data?.message || "Notification check failed.");
    } finally {
      setChecking(false);
    }
  };

  const acceptOrder = async (order) => {
    setReviewError("");
    try {
      await adminApi.patch(`/admin/reseller/license-orders/${order._id}/accept`);
      load();
    } catch (err) {
      setReviewError(err.response?.data?.message || "Something went wrong accepting this request.");
    }
  };

  const rejectOrder = async (reason) => {
    setReviewError("");
    try {
      await adminApi.patch(`/admin/reseller/license-orders/${rejectingOrderId}/reject`, { reason });
      setRejectingOrderId(null);
      load();
    } catch (err) {
      setReviewError(err.response?.data?.message || "Something went wrong rejecting this request.");
    }
  };

  if (loading) return <p className="text-slate-400 text-sm p-6">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Reseller Partners</h1>
        <div className="flex gap-2">
          <Button variant="outline" loading={checking} onClick={checkNotifications}>Check Notifications</Button>
          <Button loading={running} onClick={runBilling}>Run Reseller Billing Now</Button>
        </div>
      </div>

      {message && <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm">{message}</div>}
      {reviewError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{reviewError}</div>}

      {requestedOrders.length > 0 && (
        <Card>
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">License Requests Awaiting Approval</p>
          </div>
          <Table
            rows={requestedOrders}
            columns={[
              { key: "partner", header: "Partner", render: (o) => o.partnerId?.legalEntity?.businessName || o.partnerId?.partnerCode || "—" },
              { key: "code", header: "Order", render: (o) => o.orderCode },
              { key: "quantity", header: "Quantity", render: (o) => o.quantity },
              { key: "total", header: "Total", render: (o) => `₹${o.pricing.totalAmount.toLocaleString("en-IN")}` },
              { key: "date", header: "Requested", render: (o) => new Date(o.createdAt).toLocaleDateString() },
              {
                key: "actions",
                header: "",
                render: (o) => (
                  <div className="flex items-center gap-3">
                    <button onClick={() => acceptOrder(o)} className="text-xs font-semibold text-emerald-600 hover:underline">Accept</button>
                    <button onClick={() => setRejectingOrderId(o._id)} className="text-xs font-semibold text-brand-red hover:underline">Reject</button>
                  </div>
                )
              }
            ]}
          />
        </Card>
      )}

      <Card className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          <Stat label="Partners" value={summary?.totalPartners || 0} />
          <Stat label="Suspended" value={summary?.suspendedPartners || 0} />
          <Stat label="Purchased" value={summary?.totalPurchased || 0} />
          <Stat label="Allocated" value={summary?.totalAllocated || 0} />
          <Stat label="Active" value={summary?.totalActive || 0} />
          <Stat label="Pending Inv." value={summary?.pendingInvoices || 0} />
          <Stat label="Overdue Inv." value={summary?.overdueInvoices || 0} />
          <Stat label="Failed Inv." value={summary?.failedInvoices || 0} />
        </div>
      </Card>

      <Card>
        <Table
          empty="No Reseller partners yet."
          rows={partners}
          columns={[
            { key: "name", header: "Partner", render: (p) => p.legalEntity?.businessName || p.partnerCode },
            { key: "code", header: "Code", render: (p) => p.partnerCode },
            { key: "status", header: "Status", render: (p) => <Badge status={p.status} /> },
            { key: "view", header: "", render: (p) => <Link to={`/admin/partners/${p._id}`} className="text-brand-red text-sm font-medium hover:underline">View</Link> }
          ]}
        />
      </Card>

      <PromptModal
        open={Boolean(rejectingOrderId)}
        title="Reject this license request?"
        placeholder="Reason for rejecting..."
        confirmLabel="Reject"
        onConfirm={rejectOrder}
        onCancel={() => setRejectingOrderId(null)}
      />

    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
