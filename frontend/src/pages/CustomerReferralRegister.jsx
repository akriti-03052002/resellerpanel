import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import api from "../services/api";
import Logo from "../components/ui/Logo";

/* ============================================================
   CUSTOMER SELF-REGISTRATION VIA RESELLER REFERRAL CODE
   A reseller's own end customer signs up here using the referral
   code the reseller shared with them. This is registration only —
   no payment, no plan, no price appears anywhere on this page. The
   customer pays the reseller directly for their bundled
   screen+software product, entirely outside SPOTX (see
   backend/controller/publicResellerCustomerController.js). The
   reseller sees them appear as a pending customer in their own
   Customers page and takes it from there.
============================================================ */
export default function CustomerReferralRegister() {
  const [searchParams] = useSearchParams();
  const codeFromLink = searchParams.get("ref") || "";

  const [referralCode, setReferralCode] = useState(codeFromLink);
  const [businessName, setBusinessName] = useState("");
  const [codeStatus, setCodeStatus] = useState(codeFromLink ? "checking" : "idle"); // idle | checking | valid | invalid
  const [form, setForm] = useState({ companyName: "", name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!codeFromLink) return;
    api.get(`/public/reseller-customers/lookup/${codeFromLink}`)
      .then((res) => {
        setBusinessName(res.data.data.businessName);
        setCodeStatus("valid");
      })
      .catch(() => setCodeStatus("invalid"));
  }, [codeFromLink]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!referralCode.trim()) {
      setError("Enter the referral code your reseller gave you.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/public/reseller-customers/register", { referralCode: referralCode.trim(), ...form });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong submitting your details.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-light-grey flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-sm text-slate-500">
            We sent a link to verify your email and set a password — once that's done you can log in to see your screens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-grey flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full">
        <Logo size="sm" className="mb-6" />
        <h1 className="text-xl font-bold text-slate-900 mb-1">Register as a Customer</h1>
        <p className="text-sm text-slate-500 mb-6">
          {codeStatus === "valid"
            ? <>You're signing up with <strong className="text-slate-700">{businessName}</strong>.</>
            : "Enter the referral code your reseller shared with you, along with your details."}
        </p>

        {codeStatus === "invalid" && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            That referral code doesn't look valid — double check it with your reseller.
          </div>
        )}
        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Referral Code *</label>
            <input
              value={referralCode}
              onChange={(e) => { setReferralCode(e.target.value); setCodeStatus("idle"); }}
              placeholder="e.g. 4821"
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Company Name *</label>
            <input
              name="companyName"
              value={form.companyName}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Contact Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-brand-black text-white hover:bg-charcoal transition disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Register"}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6">
          Are you a partner? <Link to="/partner/login" className="font-medium text-brand-red hover:underline">Log in here</Link>
        </p>
      </div>
    </div>
  );
}
