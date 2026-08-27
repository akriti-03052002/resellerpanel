import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const EMPTY_FORM = { expectedRevenue: "", expectedScreenCount: "", expectedCloseDate: "" };

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.get("/partner/opportunities").then((res) => setOpportunities(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post("/partner/opportunities", {
        expectedRevenue: Number(form.expectedRevenue) || 0,
        expectedScreenCount: Number(form.expectedScreenCount) || 0,
        expectedCloseDate: form.expectedCloseDate || undefined
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Opportunities</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Register Deal</span>
        </Button>
      </div>

      <p className="text-sm text-slate-500 -mt-4">
        Deals move through the pipeline as SPOTX works them. When one is marked won, your commission is generated automatically.
      </p>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Expected Revenue (₹)" type="number" name="expectedRevenue" value={form.expectedRevenue} onChange={handleChange} />
            <Input label="Expected Screen Count" type="number" name="expectedScreenCount" value={form.expectedScreenCount} onChange={handleChange} />
            <Input label="Expected Close Date" type="date" name="expectedCloseDate" value={form.expectedCloseDate} onChange={handleChange} />
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" loading={submitting}>Create Opportunity</Button>
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
              { key: "stage", header: "Stage", render: (r) => <Badge status={r.stage} /> },
              { key: "revenue", header: "Expected Revenue", render: (r) => `₹${(r.expectedRevenue || 0).toLocaleString()}` },
              { key: "screens", header: "Screens", render: (r) => r.expectedScreenCount || 0 },
              { key: "result", header: "Result", render: (r) => <Badge status={r.result.status} /> },
              { key: "date", header: "Created", render: (r) => new Date(r.createdAt).toLocaleDateString() }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
