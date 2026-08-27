import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";

const EMPTY_FORM = { name: "", email: "", phone: "", role: "sales" };
const ROLES = ["admin", "sales", "finance", "viewer"];

export default function Team() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const load = () => api.get("/partner/team").then((res) => setTeam(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      const res = await api.post("/partner/team", form);
      setSuccessMessage(res.data.message);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong inviting the team member.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (member) => {
    const status = member.status === "blocked" ? "active" : "blocked";
    await api.patch(`/partner/team/${member._id}`, { status });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          <span className="flex items-center gap-2"><Plus size={16} /> Invite Teammate</span>
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
            An invite email is sent to this address so they can set their own password and log in.
          </p>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" name="name" value={form.name} onChange={handleChange} required />
            <Input label="Email" type="email" name="email" value={form.email} onChange={handleChange} required />
            <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
            <Select label="Role" name="role" value={form.role} onChange={handleChange}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" loading={submitting}>Send Invite</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No teammates yet."
            rows={team}
            columns={[
              { key: "name", header: "Name" },
              { key: "email", header: "Email" },
              { key: "role", header: "Role", render: (m) => <Badge tone="neutral">{m.role}</Badge> },
              { key: "status", header: "Status", render: (m) => <Badge status={m.status} /> },
              {
                key: "actions",
                header: "",
                render: (m) =>
                  m.role === "owner" ? null : (
                    <button onClick={() => toggleStatus(m)} className="text-xs font-semibold text-brand-red hover:underline">
                      {m.status === "blocked" ? "Unblock" : "Block"}
                    </button>
                  )
              }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
