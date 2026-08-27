import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Select, Input } from "../../components/ui/Input";

const STATUSES = ["", "draft", "pending_verification", "under_review", "active", "suspended", "rejected", "inactive"];
const PARTNER_TYPES = ["vendor", "affiliate", "referral", "agency", "reseller", "technology", "strategic", "influencer"];

// Only the fields needed to invite someone in — business name, legal
// details, address, KYC docs and bank all get filled in later by the
// partner themselves from their Profile page.
const EMPTY_FORM = { partnerType: "vendor", contactName: "", email: "", phone: "", password: "" };

export default function AdminPartners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const load = () => {
    adminApi.get("/admin/partners", { params: { status: status || undefined, search: search || undefined } })
      .then((res) => setPartners(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      const res = await adminApi.post("/admin/partners", form);
      setSuccessMessage(res.data.message);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong creating the partner.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Partners</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Create Partner</span>
        </Button>
      </div>

      {successMessage && (
        <Card className="p-5 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-800">{successMessage}</p>
          <button type="button" onClick={() => setSuccessMessage("")} className="text-xs text-emerald-700 hover:underline mt-2">
            Dismiss
          </button>
        </Card>
      )}

      {showForm && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <p className="text-sm text-slate-500 mb-4">
            Set a login password for the partner yourself — they log in with this email and password directly, no activation link. Business details, address and KYC come later from their Profile.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Partner Type" name="partnerType" value={form.partnerType} onChange={handleChange}>
                {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </Select>
              <Input label="Full Name *" name="contactName" value={form.contactName} onChange={handleChange} required />
              <Input label="Email *" type="email" name="email" value={form.email} onChange={handleChange} required />
              <Input label="Phone *" name="phone" value={form.phone} onChange={handleChange} required />
              <Input label="Password *" type="password" name="password" value={form.password} onChange={handleChange} required minLength={8} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={submitting}>Create Partner</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search by name, code or email" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-56">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
        </Select>
      </Card>

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No partners found."
            rows={partners}
            columns={[
              { key: "code", header: "Code", render: (p) => p.partnerCode },
              {
                key: "name",
                header: "Business",
                render: (p) => p.legalEntity.businessName || <span className="text-slate-400 italic">Incomplete profile</span>
              },
              { key: "type", header: "Type", render: (p) => <Badge tone="neutral">{p.partnerType}</Badge> },
              { key: "status", header: "Status", render: (p) => <Badge status={p.status} /> },
              { key: "verification", header: "Verification", render: (p) => <Badge status={p.verification.overallStatus} /> },
              { key: "actions", header: "", render: (p) => <Link to={`/admin/partners/${p._id}`} className="text-xs font-semibold text-brand-red hover:underline">View</Link> }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
