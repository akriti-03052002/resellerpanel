import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import { Select } from "../../components/ui/Input";

const STATUSES = ["", "pending", "approved", "eligible", "settled", "cancelled"];

export default function AdminCommissions() {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");

  const load = () => {
    adminApi.get("/admin/commissions", { params: { status: status || undefined } })
      .then((res) => setCommissions(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (id) => {
    await adminApi.patch(`/admin/commissions/${id}/approve`);
    load();
  };

  const hold = async (id) => {
    const reason = window.prompt("Reason for putting this commission on hold?") || "";
    await adminApi.patch(`/admin/commissions/${id}/hold`, { reason });
    load();
  };

  const reverse = async (id) => {
    const reason = window.prompt("Reason for reversing this commission (e.g. customer refunded)?");
    if (reason === null) return;
    try {
      await adminApi.patch(`/admin/commissions/${id}/reverse`, { reason });
      load();
    } catch (err) {
      window.alert(err.response?.data?.message || "Couldn't reverse this commission.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-56">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s : "All statuses"}</option>)}
        </Select>
      </div>

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No commissions found."
            rows={commissions}
            columns={[
              { key: "partner", header: "Partner", render: (c) => c.partnerId?.legalEntity?.businessName || "—" },
              { key: "net", header: "Net Commission", render: (c) => `₹${c.calculation.netCommission.toLocaleString()}` },
              { key: "status", header: "Status", render: (c) => <Badge status={c.settlement.status} /> },
              { key: "date", header: "Earned", render: (c) => new Date(c.createdAt).toLocaleDateString() },
              {
                key: "actions",
                header: "",
                render: (c) => (
                  <div className="flex items-center gap-3">
                    {c.settlement.status === "pending" && (
                      <button onClick={() => approve(c._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>
                    )}
                    {c.settlement.status === "approved" && (
                      <button onClick={() => hold(c._id)} className="text-xs font-semibold text-amber-600 hover:underline">Hold</button>
                    )}
                    {!["cancelled", "eligible"].includes(c.settlement.status) && (
                      <button onClick={() => reverse(c._id)} className="text-xs font-semibold text-brand-red hover:underline">Reverse</button>
                    )}
                  </div>
                )
              }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
