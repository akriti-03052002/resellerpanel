import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";

export default function AdminSettlements() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState("");
  const [approvedCommissions, setApprovedCommissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = () => adminApi.get("/admin/settlements").then((res) => setSettlements(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (showCreate) adminApi.get("/admin/partners", { params: { status: "active" } }).then((res) => setPartners(res.data.data));
  }, [showCreate]);

  useEffect(() => {
    // No else branch needed: the JSX below only renders approvedCommissions
    // when partnerId is truthy, so stale data from a previous selection is
    // simply never shown once the partner is cleared.
    if (partnerId) {
      adminApi.get("/admin/commissions", { params: { status: "approved", partnerId } })
        .then((res) => { setApprovedCommissions(res.data.data); setSelectedIds([]); });
    }
  }, [partnerId]);

  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const createBatch = async () => {
    setError("");
    if (selectedIds.length === 0) { setError("Select at least one approved commission."); return; }
    setCreating(true);

    try {
      await adminApi.post("/admin/settlements", { partnerId, commissionIds: selectedIds });
      setShowCreate(false);
      setPartnerId("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong creating the settlement.");
    } finally {
      setCreating(false);
    }
  };

  const approve = async (id) => {
    await adminApi.patch(`/admin/settlements/${id}/approve`);
    load();
  };

  const markPaid = async (id) => {
    const transactionId = window.prompt("Transaction ID (optional):") || "";
    await adminApi.patch(`/admin/settlements/${id}/mark-paid`, { method: "bank_transfer", transactionId });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Settlements</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>New Settlement Batch</Button>
      </div>

      {showCreate && (
        <Card className="p-6 space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

          <Select label="Partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Select a partner</option>
            {partners.map((p) => <option key={p._id} value={p._id}>{p.legalEntity.businessName || `${p.partnerCode} (incomplete profile)`}</option>)}
          </Select>

          {partnerId && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Approved commissions available</p>
              {approvedCommissions.length === 0 ? (
                <p className="text-sm text-slate-400">No approved commissions for this partner.</p>
              ) : (
                <div className="space-y-2">
                  {approvedCommissions.map((c) => (
                    <label key={c._id} className="flex items-center gap-3 text-sm border border-slate-100 rounded-xl p-3">
                      <input type="checkbox" checked={selectedIds.includes(c._id)} onChange={() => toggleSelect(c._id)} />
                      ₹{c.calculation.netCommission.toLocaleString()} — earned {new Date(c.createdAt).toLocaleDateString()}
                    </label>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-4">
                <Button onClick={createBatch} loading={creating}>Create Batch</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No settlements yet."
            rows={settlements}
            columns={[
              { key: "number", header: "Settlement #", render: (s) => s.settlementNumber },
              { key: "partner", header: "Partner", render: (s) => s.partnerId?.legalEntity?.businessName || "—" },
              { key: "net", header: "Net Amount", render: (s) => `₹${s.amount.net.toLocaleString()}` },
              { key: "status", header: "Status", render: (s) => <Badge status={s.status} /> },
              {
                key: "actions",
                header: "",
                render: (s) => (
                  <div className="flex gap-3">
                    {["draft", "pending_approval"].includes(s.status) && (
                      <button onClick={() => approve(s._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>
                    )}
                    {s.status === "approved" && (
                      <button onClick={() => markPaid(s._id)} className="text-xs font-semibold text-brand-red hover:underline">Mark Paid</button>
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
