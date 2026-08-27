import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock, Monitor, Tag, CreditCard, Receipt, UserCircle,
  AlertCircle, AlertTriangle, Info, ArrowRight, Plus
} from "lucide-react";
import customerApi from "../../services/customerApi";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";

const PLAN_LABEL = { basic: "Basic", premium: "Premium" };
const TRIAL_WARNING_DAYS = 5;

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN");

const QUICK_LINKS = [
  { to: "/customer/screens", label: "Manage Screens", description: "Register or remove screens", icon: Monitor },
  { to: "/customer/subscription", label: "Subscription", description: "Change plan or screen count", icon: CreditCard },
  { to: "/customer/billing", label: "Billing", description: "View invoices", icon: Receipt }
];

export default function Dashboard() {
  const [customer, setCustomer] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      customerApi.get("/customer/profile"),
      customerApi.get("/customer/subscription"),
      customerApi.get("/customer/screens")
    ])
      .then(([profileRes, subscriptionRes, screensRes]) => {
        setCustomer(profileRes.data.data.customer);
        setSubscriptionData(subscriptionRes.data.data);
        setScreens(screensRes.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Loading dashboard...</p>;
  if (!customer || !subscriptionData) return null;

  const { trial, trialExpired } = customer;
  const { subscription, registeredScreenCount } = subscriptionData;
  const trialDaysLeft = daysLeft(trial?.endsAt);
  const planLabel = subscription.plan ? PLAN_LABEL[subscription.plan] || subscription.plan : "None yet";
  const recentScreens = [...screens].slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-400">Subscription</span>
          <Badge status={trialExpired ? "expired" : subscription.status} />
        </div>
      </div>

      {subscription.status === "trial" && trialExpired && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            Your free trial has ended. <Link to="/customer/subscription" className="font-semibold underline">Subscribe now</Link> to keep your screens live.
          </span>
        </div>
      )}

      {subscription.status === "trial" && !trialExpired && trialDaysLeft !== null && trialDaysLeft <= TRIAL_WARNING_DAYS && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Your trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"}. <Link to="/customer/subscription" className="font-semibold underline">Subscribe now</Link> to avoid interruption.
          </span>
        </div>
      )}

      {subscription.scheduledChange?.plan && (
        <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl p-3.5">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>
            Switching to <strong className="capitalize">{subscription.scheduledChange.plan}</strong> ({subscription.scheduledChange.screenCount} screens) on {fmtDate(subscription.currentPeriodEnd)}.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={subscription.status === "trial" ? "Trial Days Left" : "Subscription Status"}
          value={subscription.status === "trial" ? (trialExpired ? "Expired" : trialDaysLeft) : subscription.status}
          icon={CalendarClock}
          tone="brand"
        />
        <StatCard label="Current Plan" value={planLabel} icon={Tag} />
        <StatCard label="Subscribed Screens" value={subscription.screenCount || 0} icon={CreditCard} />
        <StatCard label="Registered Screens" value={registeredScreenCount} icon={Monitor} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center gap-3 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 hover:border-slate-300 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <item.icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 text-sm">{item.label}</p>
              <p className="text-xs text-slate-400 truncate">{item.description}</p>
            </div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-slate-500 transition shrink-0" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <UserCircle size={16} className="text-slate-400" /> Account
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Company</dt><dd className="font-medium">{customer.companyName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Contact</dt><dd className="font-medium">{customer.contactName || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-medium">{customer.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="font-medium">{customer.phone || "—"}</dd></div>
            {trial?.startedAt && (
              <div className="flex justify-between"><dt className="text-slate-500">Trial Started</dt><dd className="font-medium">{fmtDate(trial.startedAt)}</dd></div>
            )}
            {trial?.endsAt && (
              <div className="flex justify-between"><dt className="text-slate-500">Trial Ends</dt><dd className="font-medium">{fmtDate(trial.endsAt)}</dd></div>
            )}
            {subscription.status === "active" && subscription.currentPeriodEnd && (
              <div className="flex justify-between"><dt className="text-slate-500">Renews</dt><dd className="font-medium">{fmtDate(subscription.currentPeriodEnd)}</dd></div>
            )}
          </dl>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Monitor size={16} className="text-slate-400" /> Recent Screens
            </h2>
            <Link to="/customer/screens" className="text-xs font-semibold text-brand-red hover:underline">View all</Link>
          </div>

          {recentScreens.length === 0 ? (
            <div className="py-6 text-center">
              <Monitor size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No screens registered yet.</p>
              <Link to="/customer/screens" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline mt-2">
                <Plus size={13} /> Register a screen
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentScreens.map((screen) => (
                <li key={screen._id} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{screen.name}</p>
                    {screen.location && <p className="text-xs text-slate-400 truncate">{screen.location}</p>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{fmtDate(screen.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
