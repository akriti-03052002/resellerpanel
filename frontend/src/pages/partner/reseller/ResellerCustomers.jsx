import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, ChevronDown, ChevronUp, X } from "lucide-react";
import api from "../../../services/api";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import PromptModal from "../../../components/ui/PromptModal";
import { COUNTRY_CODES } from "../../../data/countryCodes";

const EMPTY_CUSTOMER_FORM = { companyName: "", name: "", email: "", phone: "", screens: "" };

export default function ResellerCustomers() {
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["reseller", "customers"],
    queryFn: () => api.get("/partner/reseller/customers").then((res) => res.data.data)
  });
  const { data: allocations = [], isLoading: allocationsLoading } = useQuery({
    queryKey: ["reseller", "allocations"],
    queryFn: () => api.get("/partner/reseller/allocations").then((res) => res.data.data)
  });
  const { data: inventory = null, isLoading: inventoryLoading } = useQuery({
    queryKey: ["reseller", "inventory"],
    queryFn: () => api.get("/partner/reseller/inventory").then((res) => res.data.data)
  });
  const { data: prepayment = null, isLoading: prepaymentLoading } = useQuery({
    queryKey: ["reseller", "prepayment"],
    queryFn: () => api.get("/partner/reseller/prepayment").then((res) => res.data.data)
  });

  const loading = customersLoading || allocationsLoading || inventoryLoading || prepaymentLoading;

  const load = () => {
    queryClient.invalidateQueries({ queryKey: ["reseller", "customers"] });
    queryClient.invalidateQueries({ queryKey: ["reseller", "allocations"] });
    queryClient.invalidateQueries({ queryKey: ["reseller", "inventory"] });
    queryClient.invalidateQueries({ queryKey: ["reseller", "prepayment"] });
  };

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_CUSTOMER_FORM);
  const [phoneDial, setPhoneDial] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null); // customerId
  const [insufficientPopup, setInsufficientPopup] = useState(null); // { max, onReduce } | null

  const prepaymentDone = prepayment?.status === "done";

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePhoneNumberChange = (e) => {
    const num = e.target.value.replace(/[^\d\s]/g, "");
    setPhoneNumber(num);
    setForm((prev) => ({ ...prev, phone: num ? `${phoneDial} ${num}` : "" }));
  };

  const handlePhoneDialChange = (e) => {
    const dial = e.target.value;
    setPhoneDial(dial);
    setForm((prev) => ({ ...prev, phone: phoneNumber ? `${dial} ${phoneNumber}` : "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const requestedScreens = parseInt(form.screens, 10) || 0;
    if (requestedScreens > available) {
      setInsufficientPopup({
        max: available,
        onReduce: () => setForm((prev) => ({ ...prev, screens: String(available) }))
      });
      return;
    }

    setSubmitting(true);
    try {
      const { screens, ...customerFields } = form;
      const res = await api.post("/partner/reseller/customers", customerFields);
      const quantity = parseInt(screens, 10);

      // Allocation is a separate step from creating the customer — if it
      // fails (e.g. not enough available inventory), the customer is
      // still created; the reseller just needs to allocate afterward from
      // the customer's own row instead of it silently vanishing.
      if (quantity > 0) {
        try {
          await api.post("/partner/reseller/allocations", { customerId: res.data.data._id, screens: quantity });
        } catch (allocErr) {
          setError(
            (allocErr.response?.data?.message || "Something went wrong allocating screens.") +
            " The customer was still added — allocate screens to them from the list below once you have enough available."
          );
          setForm(EMPTY_CUSTOMER_FORM);
          setPhoneNumber("");
          setPhoneDial("+91");
          setShowForm(false);
          load();
          return;
        }
      }

      setForm(EMPTY_CUSTOMER_FORM);
      setPhoneNumber("");
      setPhoneDial("+91");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong adding the customer.");
    } finally {
      setSubmitting(false);
    }
  };

  const available = Math.max(0, (inventory?.totalPurchasedLicenses || 0) - (inventory?.totalAllocatedLicenses || 0));

  const allocationFor = (customerId) => allocations.find((a) => a.customerId?._id === customerId || a.customerId === customerId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <Button onClick={() => setShowForm((v) => !v)} disabled={!loading && !prepaymentDone}>
          <span className="flex items-center gap-2"><Plus size={16} /> Add Customer</span>
        </Button>
      </div>

      {!loading && !prepaymentDone && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            {prepayment?.status === "awaiting_payment"
              ? <>Complete your one-time prepayment from the <Link to="/partner/reseller/buy" className="font-semibold underline">Buy Licenses</Link> page before adding customers.</>
              : "SPOTX needs to set up your one-time prepayment before you can add customers. Contact SPOTX to get started."}
          </p>
        </Card>
      )}

      <p className="text-sm text-slate-500 -mt-4">
        Available licenses to allocate: <strong className="text-slate-900">{available}</strong>
      </p>

      {showForm && prepaymentDone && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Company Name *" name="companyName" value={form.companyName} onChange={handleChange} required />
            <Input label="Contact Name" name="name" value={form.name} onChange={handleChange} />
            <Input label="Email" type="email" name="email" value={form.email} onChange={handleChange} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
              <div className="flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition">
                <select
                  value={phoneDial}
                  onChange={handlePhoneDialChange}
                  className="shrink-0 w-[38%] px-2 py-3 bg-slate-50 border-r border-slate-200 outline-none text-sm text-slate-700"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={`${c.name}-${c.dial}`} value={c.dial}>{c.name} ({c.dial})</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  placeholder="XXXXX XXXXX"
                  className="flex-1 min-w-0 px-4 py-3 outline-none"
                />
              </div>
            </div>
            <Input
              label="Screens to Allocate"
              type="number"
              min="0"
              name="screens"
              value={form.screens}
              onChange={handleChange}
              placeholder={`Up to ${available} available`}
            />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" loading={submitting}>Add Customer</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : customers.length === 0 ? (
          <p className="text-center py-16 text-slate-400 text-sm">No customers yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {customers.map((c) => (
              <CustomerRow
                key={c._id}
                customer={c}
                allocation={allocationFor(c._id)}
                available={available}
                expanded={expanded === c._id}
                onToggle={() => setExpanded(expanded === c._id ? null : c._id)}
                onChanged={load}
                onInsufficient={setInsufficientPopup}
              />
            ))}
          </div>
        )}
      </Card>

      {insufficientPopup && (
        <InsufficientLicensesModal
          max={insufficientPopup.max}
          onReduce={() => { insufficientPopup.onReduce(); setInsufficientPopup(null); }}
          onClose={() => setInsufficientPopup(null)}
        />
      )}
    </div>
  );
}

function InsufficientLicensesModal({ max, onReduce, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-slate-900">Not enough licenses available</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-brand-black shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          You have <strong className="text-slate-900">{max}</strong> license{max === 1 ? "" : "s"} available right now.
          Buy more licenses, or reduce the number to what you have.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onReduce}>Reduce to {max}</Button>
          <Link to="/partner/reseller/buy">
            <Button>Buy More Licenses</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function CustomerRow({ customer, allocation, available, expanded, onToggle, onChanged, onInsufficient }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allocateQty, setAllocateQty] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    setEditForm({
      companyName: customer.businessDetails.companyName || "",
      name: customer.contactDetails.name || "",
      email: customer.contactDetails.email || "",
      phone: customer.contactDetails.phone || ""
    });
    setEditing(true);
  };

  const saveEdit = () => {
    setError("");
    setBusy(true);
    api.patch(`/partner/reseller/customers/${customer._id}`, editForm)
      .then(() => {
        setEditing(false);
        onChanged();
      })
      .catch((err) => setError(err.response?.data?.message || "Something went wrong updating this customer."))
      .finally(() => setBusy(false));
  };

  // Allocating only grants capacity — the customer registers and activates
  // their own screens from the customer portal, one at a time, up to this
  // amount (see backend/controller/partnerAllocationController.js).
  const allocate = () => {
    const quantity = parseInt(allocateQty, 10);
    if (quantity > available) {
      onInsufficient({ max: available, onReduce: () => setAllocateQty(String(available)) });
      return;
    }
    run(() => api.post("/partner/reseller/allocations", { customerId: customer._id, screens: quantity }));
  };
  const suspend = () => run(() => api.post(`/partner/reseller/allocations/${allocation._id}/suspend`, {}));
  const reactivate = () => run(() => api.post(`/partner/reseller/allocations/${allocation._id}/reactivate`, {}));
  const cancel = () => setConfirmingCancel(true);
  const confirmCancel = () => {
    setConfirmingCancel(false);
    run(() => api.post(`/partner/reseller/allocations/${allocation._id}/cancel`, {}));
  };

  return (
    <div className="p-4">
      <button className="w-full flex items-center justify-between text-left" onClick={onToggle}>
        <div>
          <p className="text-sm font-semibold text-slate-900">{customer.businessDetails.companyName}</p>
          <p className="text-xs text-slate-400">{customer.contactDetails.email || customer.contactDetails.name || "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge status={customer.status} />
          {allocation && (
            <span className="text-xs text-slate-500 hidden sm:inline">
              {allocation.allocatedLicenses} allocated · {allocation.activeScreens} active
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

          {editing ? (
            <div className="p-4 bg-slate-50 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Company Name" value={editForm.companyName} onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))} />
                <Input label="Contact Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                <Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="!text-xs !py-1.5" onClick={() => setEditing(false)}>Cancel</Button>
                <Button className="!text-xs !py-1.5" loading={busy} onClick={saveEdit}>Save Changes</Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={startEdit} className="text-xs font-semibold text-brand-red hover:underline">
              Edit Customer Details
            </button>
          )}

          {allocation && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <MiniStat label="Allocated" value={allocation.allocatedLicenses} />
              <MiniStat label="Registered" value={allocation.registeredScreens} />
              <MiniStat label="Active" value={allocation.activeScreens} />
              <MiniStat label="Suspended" value={allocation.suspendedScreens} />
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <QtyAction
              label="Allocate screens"
              placeholder={`Up to ${available}`}
              max={available}
              value={allocateQty}
              onChange={setAllocateQty}
              onSubmit={allocate}
              busy={busy}
              buttonLabel="Allocate"
            />
          </div>

          {allocation && allocation.status !== "cancelled" && (
            <div className="flex flex-wrap gap-2 pt-2">
              {allocation.status === "suspended" ? (
                <Button variant="outline" className="!text-xs !py-1.5" loading={busy} onClick={reactivate}>Reactivate</Button>
              ) : (
                <Button variant="outline" className="!text-xs !py-1.5" loading={busy} onClick={suspend} disabled={!allocation.activeScreens}>
                  Suspend (customer stopped paying)
                </Button>
              )}
              <Button variant="danger" className="!text-xs !py-1.5" loading={busy} onClick={cancel}>Cancel Allocation</Button>
            </div>
          )}
        </div>
      )}

      <PromptModal
        open={confirmingCancel}
        hideInput
        title="Cancel this allocation?"
        message="All their licenses return to your available inventory."
        confirmLabel="Cancel Allocation"
        onConfirm={confirmCancel}
        onCancel={() => setConfirmingCancel(false)}
      />
    </div>
  );
}

function QtyAction({ label, placeholder, max, value, onChange, onSubmit, busy, buttonLabel }) {
  // The submit handler (allocate/register/activate) is responsible for
  // checking `value` against `max` and deciding what to do about it
  // (popup with a Buy Licenses link, or an inline error) — this input
  // just disables once there's clearly nothing left to act on at all.
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400"
        />
        <Button className="!px-3 !py-1.5 !text-xs" loading={busy} onClick={onSubmit} disabled={!value || max === 0}>{buttonLabel}</Button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
