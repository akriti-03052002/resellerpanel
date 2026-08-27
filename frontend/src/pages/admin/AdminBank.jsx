import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";

export default function AdminBank() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState({});

  const load = () => adminApi.get("/admin/bank/pending").then((res) => setAccounts(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const verify = async (id, status) => {
    await adminApi.patch(`/admin/bank/${id}/verify`, { status });
    load();
  };

  const reveal = async (id) => {
    const res = await adminApi.get(`/admin/bank/${id}/reveal`);
    setRevealed((prev) => ({ ...prev, [id]: res.data.data }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Bank Account Review</h1>
      <p className="text-sm text-slate-500 -mt-4">Revealing full account details is restricted to finance admins and is audit-logged on every access.</p>

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No bank accounts waiting for review."
            rows={accounts}
            columns={[
              { key: "partner", header: "Partner", render: (a) => a.partnerId?.legalEntity?.businessName || "—" },
              { key: "bank", header: "Bank", render: (a) => a.bankName },
              { key: "acct", header: "Account", render: (a) => revealed[a._id] ? `${revealed[a._id].accountNumber} / ${revealed[a._id].ifsc}` : `•••• ${a.accountNumberLast4}` },
              {
                key: "actions",
                header: "",
                render: (a) => (
                  <div className="flex gap-3">
                    {!revealed[a._id] && (
                      <button onClick={() => reveal(a._id)} className="text-xs font-semibold text-slate-500 hover:underline">Reveal</button>
                    )}
                    <button onClick={() => verify(a._id, "verified")} className="text-xs font-semibold text-emerald-600 hover:underline">Verify</button>
                    <button onClick={() => verify(a._id, "rejected")} className="text-xs font-semibold text-brand-red hover:underline">Reject</button>
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
