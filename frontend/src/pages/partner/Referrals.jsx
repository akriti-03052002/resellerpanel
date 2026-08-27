import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const EMPTY_FORM = { companyName: "", contactName: "", email: "", phone: "", screenCount: "", estimatedValue: "", notes: "" };

export default function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.get("/partner/referrals").then((res) => setReferrals(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api.post("/partner/referrals", {
        customer: { companyName: form.companyName, contactName: form.contactName, email: form.email, phone: form.phone },
        requirement: { screenCount: Number(form.screenCount) || 0, estimatedValue: Number(form.estimatedValue) || 0, notes: form.notes }
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong submitting the lead.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvert = async (id) => {
    await api.post(`/partner/referrals/${id}/convert`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Referrals</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          <span className="flex items-center gap-2"><Plus size={16} /> New Lead</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Company Name *" name="companyName" value={form.companyName} onChange={handleChange} required />
            <Input label="Contact Name" name="contactName" value={form.contactName} onChange={handleChange} />
            <Input label="Email" type="email" name="email" value={form.email} onChange={handleChange} />
            <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
            <Input label="Screen Count" type="number" name="screenCount" value={form.screenCount} onChange={handleChange} />
            <Input label="Estimated Value (₹)" type="number" name="estimatedValue" value={form.estimatedValue} onChange={handleChange} />
            <div className="md:col-span-2">
              <Input label="Notes" name="notes" value={form.notes} onChange={handleChange} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" loading={submitting}>Submit Lead</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No leads submitted yet."
            rows={referrals}
            columns={[
              { key: "company", header: "Company", render: (r) => r.customer.companyName },
              { key: "contact", header: "Contact", render: (r) => r.customer.contactName || "—" },
              { key: "screens", header: "Screens", render: (r) => r.requirement?.screenCount || 0 },
              { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
              { key: "date", header: "Submitted", render: (r) => new Date(r.createdAt).toLocaleDateString() },
              {
                key: "actions",
                header: "",
                render: (r) =>
                  ["new", "contacted"].includes(r.status) ? (
                    <button onClick={() => handleConvert(r._id)} className="text-xs font-semibold text-brand-red hover:underline">
                      Convert to Opportunity
                    </button>
                  ) : null
              }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
