import { useEffect, useMemo, useState } from "react";
import { CreditCard, Monitor, Tag, Check, X, AlertTriangle } from "lucide-react";
import customerApi from "../../services/customerApi";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const PLANS = [
  {
    id: "basic",
    label: "Basic",
    tagline: "Get your screens up and running.",
    features: [
      "Screen management dashboard",
      "Standard content scheduling",
      "Email support",
      "Basic usage reports"
    ]
  },
  {
    id: "premium",
    label: "Premium",
    tagline: "For teams that need more control.",
    features: [
      "Everything in Basic",
      "Priority support",
      "Advanced analytics & reporting",
      "Multi-user access for your team",
      "Early access to new features"
    ]
  }
];

const CYCLE_DAYS = 30;

const money = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN");

// Mirrors backend customerSubscriptionController.computeChange — a live
// preview before submitting. The server is authoritative on the actual
// charge (its own clock and DB state, recomputed on submit).
function computeChangePreview(subscription, plans, plan, screenCount) {
  const now = new Date();
  const newPricePerScreen = plans[plan] || 0;
  const fullAmount = screenCount * newPricePerScreen;

  const hasOpenCycle = subscription.status === "active"
    && subscription.currentPeriodEnd
    && now < new Date(subscription.currentPeriodEnd);

  if (!hasOpenCycle) {
    return {
      type: "immediate",
      amount: fullAmount,
      prorated: false,
      fullAmount,
      periodEnd: new Date(now.getTime() + CYCLE_DAYS * 24 * 60 * 60 * 1000)
    };
  }

  const currentPricePerScreen = plans[subscription.plan] || 0;
  const currentTotal = currentPricePerScreen * (subscription.screenCount || 0);
  const periodEnd = new Date(subscription.currentPeriodEnd);

  if (fullAmount < currentTotal) {
    // Downgrade — deferred to periodEnd, nothing charged now.
    return { type: "deferred", amount: 0, prorated: false, fullAmount, periodEnd };
  }

  const periodStart = new Date(subscription.currentPeriodStart);
  const totalMs = periodEnd - periodStart;
  const remainingMs = periodEnd - now;
  const remainingFraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;

  const proratedDiff = Math.round((fullAmount - currentTotal) * remainingFraction * 100) / 100;

  return { type: "immediate", amount: Math.max(0, proratedDiff), prorated: true, fullAmount, periodEnd };
}

export default function Subscription() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screenCount, setScreenCount] = useState("");
  const [plan, setPlan] = useState("basic");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = () => {
    return customerApi.get("/customer/subscription").then((res) => {
      const { subscription, registeredScreenCount } = res.data.data;
      setData(res.data.data);
      // Once subscribed, default to the current subscribed count (not the
      // registered count) so opening this page and clicking Update without
      // touching the field can't silently shrink an existing subscription.
      const defaultCount = subscription.status === "active" && subscription.screenCount
        ? subscription.screenCount
        : (registeredScreenCount || 1);
      setScreenCount((prev) => prev || String(defaultCount));
      setPlan((prev) => subscription.plan || prev);
    });
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const count = Number(screenCount) || 0;

  const currentPlanLabel = useMemo(() => {
    if (!data?.subscription.plan) return null;
    return PLANS.find((p) => p.id === data.subscription.plan)?.label || data.subscription.plan;
  }, [data]);

  const charge = useMemo(() => {
    if (!data) return { type: "immediate", amount: 0, prorated: false, fullAmount: 0, periodEnd: null };
    return computeChangePreview(data.subscription, data.plans, plan, count);
  }, [data, plan, count]);

  const isChange = data && (data.subscription.plan !== plan || data.subscription.screenCount !== count);
  const currentTotal = data ? (data.plans[data.subscription.plan] || 0) * (data.subscription.screenCount || 0) : 0;

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>;
  if (!data) return null;

  const { subscription, trialExpired, registeredScreenCount, plans } = data;
  const pricePerScreen = plans[plan] || 0;

  const submit = async () => {
    setError("");
    setSuccessMessage("");
    setSubmitting(true);
    try {
      const res = await customerApi.post("/customer/subscription/subscribe", { screenCount: count, plan });
      setSuccessMessage(res.data.message);
      setConfirming(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong activating your subscription.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    if (!count || count < 1) return;
    setError("");
    setConfirming(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <Badge status={trialExpired ? "expired" : subscription.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Current Plan" value={currentPlanLabel || "None yet"} icon={Tag} tone="brand" />
        <StatCard label="Subscribed Screens" value={subscription.screenCount || 0} icon={CreditCard} />
        <StatCard label="Registered Screens" value={registeredScreenCount} icon={Monitor} />
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {successMessage && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{successMessage}</div>}

      {subscription.scheduledChange?.plan && (
        <Card className="p-4 border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-800">
            Switching to <strong className="capitalize">{subscription.scheduledChange.plan}</strong> ({subscription.scheduledChange.screenCount} screen{subscription.scheduledChange.screenCount === 1 ? "" : "s"}) on {fmtDate(subscription.currentPeriodEnd)}. You'll keep {currentPlanLabel} until then.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Choose your plan</h2>
            <p className="text-sm text-slate-500 mb-4">
              You can switch plans or change your screen count any time — even before your trial ends.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PLANS.map((p) => {
                const isCurrent = subscription.plan === p.id;
                const isSelected = plan === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    className={`relative text-left p-4 rounded-xl border-2 transition ${
                      isSelected ? "border-brand-red bg-brand-red/5" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{p.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{p.tagline}</p>
                      </div>
                      {isCurrent && <Badge tone="success">Current</Badge>}
                    </div>

                    <p className="text-lg font-bold text-slate-900 mt-3">
                      {money(plans[p.id])} <span className="text-xs font-normal text-slate-400">/ screen / month</span>
                    </p>

                    <ul className="mt-3 space-y-1.5">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                          <Check size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {isSelected && <Check size={16} className="absolute top-4 right-4 text-brand-red" />}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-1">Number of screens</h2>
            <p className="text-sm text-slate-500 mb-4">
              You have {registeredScreenCount} screen{registeredScreenCount === 1 ? "" : "s"} registered. Enter how many you want covered by this subscription.
            </p>
            <Input
              type="number"
              min={1}
              value={screenCount}
              onChange={(e) => setScreenCount(e.target.value)}
              className="max-w-xs"
              required
            />
          </Card>
        </div>

        <Card className="p-6 lg:sticky lg:top-6">
          <h2 className="font-semibold text-slate-900 mb-4">Order summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Plan</dt><dd className="font-medium text-slate-900">{PLANS.find((p) => p.id === plan)?.label}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Price / screen</dt><dd className="font-medium text-slate-900">{money(pricePerScreen)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Screens</dt><dd className="font-medium text-slate-900">{count || 0}</dd></div>
          </dl>

          <div className="pt-3 mt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {charge.type === "deferred" ? "Due now" : charge.prorated ? "Due now (prorated)" : "Total / month"}
              </span>
              <span className="text-xl font-bold text-slate-900">{money(charge.amount)}</span>
            </div>
            {charge.type === "deferred" && (
              <p className="text-xs text-slate-400 mt-1">
                Takes effect {fmtDate(charge.periodEnd)}, at {money(charge.fullAmount)}/month. You keep your current plan until then.
              </p>
            )}
            {charge.prorated && (
              <p className="text-xs text-slate-400 mt-1">
                For the rest of this cycle. Then {money(charge.fullAmount)}/month from {fmtDate(charge.periodEnd)}.
              </p>
            )}
          </div>

          {subscription.status === "active" && (
            <p className="text-xs text-slate-400 mt-3">
              Currently: {currentPlanLabel}, {subscription.screenCount} screen{subscription.screenCount === 1 ? "" : "s"} ({money(currentTotal)}/mo)
              {subscription.currentPeriodEnd && ` · renews ${fmtDate(subscription.currentPeriodEnd)}`}
            </p>
          )}

          <Button className="w-full mt-4" onClick={handleSubmitClick} disabled={!isChange && subscription.status === "active"}>
            {subscription.status === "active" ? "Update Subscription" : "Subscribe"}
          </Button>
        </Card>
      </div>

      {confirming && (
        <ConfirmDialog
          charge={charge}
          currentLabel={subscription.status === "active" ? `${currentPlanLabel}, ${subscription.screenCount} screen${subscription.screenCount === 1 ? "" : "s"} (${money(currentTotal)}/mo)` : null}
          newLabel={`${PLANS.find((p) => p.id === plan)?.label}, ${count} screen${count === 1 ? "" : "s"}`}
          submitting={submitting}
          onCancel={() => setConfirming(false)}
          onConfirm={submit}
        />
      )}
    </div>
  );
}

function ConfirmDialog({ charge, currentLabel, newLabel, submitting, onCancel, onConfirm }) {
  const isDeferred = charge.type === "deferred";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-slate-900">Confirm subscription change</p>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="space-y-2 text-sm mb-4">
          {currentLabel && (
            <div className="flex justify-between">
              <span className="text-slate-500">Currently</span>
              <span className="text-slate-900 text-right">{currentLabel}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">New</span>
            <span className="font-semibold text-slate-900 text-right">{newLabel}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-100">
            <span className="text-slate-500">Due now</span>
            <span className="font-semibold text-slate-900">{money(charge.amount)}</span>
          </div>
        </div>

        {isDeferred && (
          <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              You keep your current plan for the rest of this cycle — no charge, no refund. The new plan (and price) starts {fmtDate(charge.periodEnd)}.
            </span>
          </div>
        )}

        {charge.prorated && (
          <p className="text-xs text-slate-500 mb-4">
            This charges only the difference for the rest of your current cycle. From {fmtDate(charge.periodEnd)} you'll be billed {money(charge.fullAmount)}/month in full.
          </p>
        )}

        {!isDeferred && !charge.prorated && <p className="text-xs text-slate-400 mb-4">This takes effect immediately.</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1" loading={submitting} onClick={onConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}
