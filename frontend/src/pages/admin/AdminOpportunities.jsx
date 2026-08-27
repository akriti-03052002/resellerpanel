import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

export default function AdminOpportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [winTarget, setWinTarget] = useState(null);
  const [revenue, setRevenue] = useState("");
  const [screenCount, setScreenCount] = useState("");
  const [applyAddOn, setApplyAddOn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.get("/admin/opportunities").then((res) => setOpportunities(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const markLost = async (id) => {
    await adminApi.patch(`/admin/opportunities/${id}/lose`, {});
    load();
  };

  const submitWin = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      await adminApi.patch(`/admin/opportunities/${winTarget}/win`, {
        revenue: Number(revenue),
        screenCount: Number(screenCount) || 0,
        applyAddOn
      });
      setWinTarget(null);
      setRevenue("");
      setScreenCount("");
      setApplyAddOn(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong marking the deal won.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Opportunity Pipeline</h1>

      {winTarget && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={submitWin} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">Final Revenue (₹)</label>
                <input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} required className="w-full px-4 py-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">Screen Count</label>
                <input type="number" value={screenCount} onChange={(e) => setScreenCount(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={applyAddOn} onChange={(e) => setApplyAddOn(e.target.checked)} />
              Apply optional recurring add-on (Affiliate/Influencer only — ignored otherwise)
            </label>

            <div className="flex gap-3">
              <Button type="submit" loading={busy}>Confirm Won — Generate Commission</Button>
              <Button type="button" variant="outline" onClick={() => setWinTarget(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No opportunities yet."
            rows={opportunities}
            columns={[
              { key: "partner", header: "Partner", render: (o) => o.partnerId?.legalEntity?.businessName || "—" },
              { key: "stage", header: "Stage", render: (o) => <Badge status={o.stage} /> },
              { key: "revenue", header: "Expected Revenue", render: (o) => `₹${(o.expectedRevenue || 0).toLocaleString()}` },
              { key: "result", header: "Result", render: (o) => <Badge status={o.result.status} /> },
              {
                key: "actions",
                header: "",
                render: (o) =>
                  o.result.status === "open" ? (
                    <div className="flex gap-3">
                      <button onClick={() => setWinTarget(o._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Mark Won</button>
                      <button onClick={() => markLost(o._id)} className="text-xs font-semibold text-brand-red hover:underline">Mark Lost</button>
                    </div>
                  ) : null
              }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
