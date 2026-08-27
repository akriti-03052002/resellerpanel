import { useEffect, useState } from "react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";

export default function Commissions() {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/partner/commissions").then((res) => setCommissions(res.data.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No commissions earned yet."
            rows={commissions}
            columns={[
              { key: "type", header: "Type", render: (r) => <Badge tone="neutral">{r.calculation.commissionType.replace(/_/g, " ")}</Badge> },
              { key: "revenue", header: "Deal Revenue", render: (r) => `₹${(r.transaction.revenue || 0).toLocaleString()}` },
              { key: "net", header: "Net Commission", render: (r) => `₹${r.calculation.netCommission.toLocaleString()}` },
              { key: "status", header: "Status", render: (r) => <Badge status={r.settlement.status} /> },
              { key: "date", header: "Earned", render: (r) => new Date(r.createdAt).toLocaleDateString() }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
