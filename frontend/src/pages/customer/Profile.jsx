import { useEffect, useState } from "react";
import customerApi from "../../services/customerApi";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function Profile() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    customerApi.get("/customer/profile").then((res) => {
      const { customer } = res.data.data;
      setForm({ contactName: customer.contactName || "", phone: customer.phone || "" });
    });
  }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await customerApi.patch("/customer/profile", form);
      setMessage("Profile updated.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e) => setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setChangingPassword(true);
      await customerApi.post("/customer/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordMessage("Password changed.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!form) return <p className="text-slate-400 text-sm">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Contact Details</h2>
        {message && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{message}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Contact Name" name="contactName" value={form.contactName} onChange={handleChange} />
          <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" loading={saving}>Save Changes</Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Change Password</h2>
        {passwordMessage && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">{passwordMessage}</div>}
        {passwordError && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{passwordError}</div>}

        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Current Password"
            type="password"
            name="currentPassword"
            value={passwordForm.currentPassword}
            onChange={handlePasswordChange}
            required
            className="md:col-span-2"
          />
          <Input
            label="New Password"
            type="password"
            name="newPassword"
            value={passwordForm.newPassword}
            onChange={handlePasswordChange}
            placeholder="Minimum 8 characters"
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            name="confirmPassword"
            value={passwordForm.confirmPassword}
            onChange={handlePasswordChange}
            required
          />

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" loading={changingPassword}>Change Password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
