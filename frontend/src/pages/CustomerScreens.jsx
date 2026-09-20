import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, Plus } from "lucide-react";
import toast from "react-hot-toast";
import customerPortalApi from "../services/customerPortalApi";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PromptModal from "../components/ui/PromptModal";

// Lets the customer see the screens they've registered and register new
// ones (name + location) up to the license capacity their reseller has
// allocated them. Registering is the only thing that creates a Screen —
// allocation just grants capacity (see backend partnerAllocationController).
// Once registeredScreens hits allocatedLicenses, registering another screen
// is blocked and the customer is told to contact their reseller.
export default function CustomerScreens() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", location: "" });
  const [registering, setRegistering] = useState(false);
  const [registerForm, setRegisterForm] = useState({ name: "", location: "" });
  const [limitReachedOpen, setLimitReachedOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customerPortal", "screens"],
    queryFn: () => customerPortalApi.get("/customer-portal/screens").then((res) => res.data)
  });

  const screens = data?.data || [];
  const allocatedLicenses = data?.meta?.allocatedLicenses || 0;
  const registeredScreens = data?.meta?.registeredScreens || 0;
  const atCapacity = allocatedLicenses > 0 && registeredScreens >= allocatedLicenses;

  const updateMutation = useMutation({
    mutationFn: ({ id, name, location }) =>
      customerPortalApi.patch(`/customer-portal/screens/${id}`, { name, location }).then((res) => res.data.data),
    onSuccess: () => {
      toast.success("Screen updated.");
      queryClient.invalidateQueries({ queryKey: ["customerPortal", "screens"] });
      setEditingId(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Could not update screen.");
    }
  });

  const registerMutation = useMutation({
    mutationFn: ({ name, location }) =>
      customerPortalApi.post("/customer-portal/screens", { name, location }).then((res) => res.data),
    onSuccess: () => {
      toast.success("Screen registered.");
      queryClient.invalidateQueries({ queryKey: ["customerPortal", "screens"] });
      setRegistering(false);
      setRegisterForm({ name: "", location: "" });
    },
    onError: (err) => {
      if (err.response?.data?.code === "ALLOCATION_LIMIT_REACHED") {
        setRegistering(false);
        setLimitReachedOpen(true);
        queryClient.invalidateQueries({ queryKey: ["customerPortal", "screens"] });
        return;
      }
      toast.error(err.response?.data?.message || "Could not register screen.");
    }
  });

  const startEdit = (screen) => {
    setEditingId(screen._id);
    setForm({ name: screen.name || "", location: screen.location || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", location: "" });
  };

  const saveEdit = (id) => {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    updateMutation.mutate({ id, name: form.name.trim(), location: form.location.trim() });
  };

  const openRegister = () => {
    if (atCapacity) {
      setLimitReachedOpen(true);
      return;
    }
    setRegistering(true);
    setRegisterForm({ name: "", location: "" });
  };

  const submitRegister = () => {
    if (!registerForm.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    registerMutation.mutate({ name: registerForm.name.trim(), location: registerForm.location.trim() });
  };

  return (
    <div className="max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your Screens</h1>
            {allocatedLicenses > 0 && (
              <p className="text-sm text-slate-500 mt-1">
                {registeredScreens} of {allocatedLicenses} allocated screens registered
              </p>
            )}
          </div>
          {!registering && (
            <Button onClick={openRegister} className="inline-flex items-center gap-1.5 shrink-0">
              <Plus size={16} /> Register a screen
            </Button>
          )}
        </div>

        {isError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            Something went wrong loading your screens.
          </div>
        )}

        {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}

        {registering && (
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900 mb-3">Register a new screen</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Name</label>
                <input
                  type="text"
                  autoFocus
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                  placeholder="e.g. Lobby Screen"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Location</label>
                <input
                  type="text"
                  value={registerForm.location}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, location: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                  placeholder="e.g. Main entrance"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={submitRegister}
                  disabled={registerMutation.isPending}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-black text-white hover:opacity-90 transition disabled:opacity-50"
                >
                  <Check size={14} /> Register
                </button>
                <button
                  onClick={() => setRegistering(false)}
                  disabled={registerMutation.isPending}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          </Card>
        )}

        {!isLoading && !isError && screens.length === 0 && !registering && (
          <Card className="p-6">
            <p className="text-sm text-slate-500">
              {allocatedLicenses > 0
                ? "No screens registered yet — register your first one above."
                : "No screens have been allocated to you yet."}
            </p>
          </Card>
        )}

        <div className="space-y-3">
          {screens.map((screen) => (
            <Card key={screen._id} className="p-4">
              {editingId === screen._id ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                      placeholder="e.g. Lobby Screen"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Location</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                      placeholder="e.g. Main entrance"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(screen._id)}
                      disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-black text-white hover:opacity-90 transition disabled:opacity-50"
                    >
                      <Check size={14} /> Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{screen.name || "Unnamed screen"}</p>
                    <p className="text-xs text-slate-500 mt-1">{screen.location || "No location set"}</p>
                    <div className="mt-2">
                      <Badge status={screen.licenseStatus} />
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(screen)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-black transition shrink-0"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>

      <PromptModal
        open={limitReachedOpen}
        title="Screen limit reached"
        message="You've registered all the screens allocated to you. Contact your reseller to allocate more licenses before registering another screen."
        hideInput
        confirmLabel="OK"
        onConfirm={() => setLimitReachedOpen(false)}
        onCancel={() => setLimitReachedOpen(false)}
      />
    </div>
  );
}
