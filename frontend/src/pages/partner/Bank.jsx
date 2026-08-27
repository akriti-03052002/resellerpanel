import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";

const EMPTY_FORM = { accountHolderName: "", bankName: "", accountNumber: "", ifsc: "", accountType: "current" };

export default function Bank() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api.get("/partner/bank").then((res) => {
      setAccount(res.data.data);
      if (!res.data.data) setEditing(true);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      await api.put("/partner/bank", form);
      setForm(EMPTY_FORM);
      setEditing(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong saving the bank account.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Bank Account</h1>
      <p className="text-sm text-slate-500 -mt-4">
        Only the partner owner can view or manage this. SPOTX verifies your account before settling any payout to it.
      </p>

      {!editing && account && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Badge status={account.verification.status} />
            <Button variant="outline" onClick={() => setEditing(true)}>Update</Button>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Account Holder</dt><dd className="font-medium">{account.accountHolderName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Bank</dt><dd className="font-medium">{account.bankName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Account Number</dt><dd className="font-medium">•••• {account.accountNumberLast4}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">IFSC</dt><dd className="font-medium">{account.ifscMasked}</dd></div>
          </dl>

          {account.verification.status === "rejected" && account.verification.rejectionReason && (
            <div className="flex items-start gap-2 mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{account.verification.rejectionReason}</span>
            </div>
          )}
        </Card>
      )}

      {editing && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Account Holder Name" name="accountHolderName" value={form.accountHolderName} onChange={handleChange} required />
            <Input label="Bank Name" name="bankName" value={form.bankName} onChange={handleChange} required />
            <Input label="Account Number" name="accountNumber" value={form.accountNumber} onChange={handleChange} required />
            <Input label="IFSC Code" name="ifsc" value={form.ifsc} onChange={handleChange} required />
            <Select label="Account Type" name="accountType" value={form.accountType} onChange={handleChange}>
              <option value="current">Current</option>
              <option value="savings">Savings</option>
              <option value="other">Other</option>
            </Select>
            <div className="flex justify-end gap-3">
              {account && <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>}
              <Button type="submit" loading={saving}>Save Bank Account</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
