import { useEffect, useState } from "react";
import { Monitor, Trash2 } from "lucide-react";
import customerApi from "../../services/customerApi";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function Screens() {
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    customerApi.get("/customer/screens").then((res) => setScreens(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await customerApi.post("/customer/screens", { name, location });
      setName("");
      setLocation("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong registering the screen.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    setDeletingId(id);
    try {
      await customerApi.delete(`/customer/screens/${id}`);
      load();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Screens</h1>
      <p className="text-sm text-slate-500 -mt-4">
        Register the screens you're running. The count here is what defaults your Subscription page.
      </p>

      <Card className="p-6">
        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <Input label="Screen name *" placeholder="e.g. Lobby Display" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Location" placeholder="e.g. Ground floor" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Button type="submit" loading={submitting}>Add Screen</Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : screens.length === 0 ? (
          <div className="p-10 text-center">
            <Monitor size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No screens registered yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium">Location</th>
                <th className="text-left px-5 py-3 font-medium">Added</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {screens.map((screen) => (
                <tr key={screen._id}>
                  <td className="px-5 py-3 font-medium text-slate-900">{screen.name}</td>
                  <td className="px-5 py-3 text-slate-600">{screen.location || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{new Date(screen.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(screen._id)}
                      disabled={deletingId === screen._id}
                      className="text-slate-400 hover:text-brand-red disabled:opacity-50"
                      aria-label="Remove screen"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
