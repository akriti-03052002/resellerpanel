import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Handshake, TrendingUp, Wallet, ShieldCheck, ArrowRight, Sparkles,
  Monitor, MapPin, Activity, Radio, Check
} from "lucide-react";
import Logo from "../components/ui/Logo";
import api from "../services/api";

const FEATURES = [
  {
    icon: Handshake,
    title: "Refer & Earn",
    description: "Submit leads for SPOTX's digital signage platform and turn them into deals — no cap on how many you bring in."
  },
  {
    icon: TrendingUp,
    title: "Tiered Commissions",
    description: "Climb through partner tiers as you close more deals — higher tiers unlock better commission rates automatically."
  },
  {
    icon: Wallet,
    title: "Transparent Payouts",
    description: "Track every commission from pending to paid in real time, with clear settlement history — no chasing finance."
  },
  {
    icon: ShieldCheck,
    title: "Verified & Secure",
    description: "KYC and bank details are encrypted and reviewed by SPOTX before your first payout goes out."
  }
];

const STATS = [
  { icon: Monitor, value: "1,521+", label: "Screens managed" },
  { icon: MapPin, value: "70+", label: "Business locations" },
  { icon: Activity, value: "99.9%", label: "Platform uptime" },
  { icon: Radio, value: "24/7", label: "Network monitoring" }
];

const TIERS = [
  { name: "Registered", requirement: "New / low-volume", rate: "10%", perks: ["Partner pricing", "Sales kit"] },
  { name: "Certified", requirement: "1,000+ screens", rate: "15%", perks: ["Training", "Demo account", "Lead sharing"] },
  { name: "Gold", requirement: "5,000+ screens", rate: "20%", perks: ["Dedicated support", "Co-marketing"] },
  { name: "Strategic", requirement: "15,000+ screens", rate: "25%+", perks: ["White-label", "Territory rights"] }
];

const PARTNER_TYPES = [
  { name: "Vendor", blurb: "Install and manage screens — earn recurring commission every month, for as long as they stay active." },
  { name: "Reseller", blurb: "Buy at wholesale, set your own pricing, and keep the margin on every unit you move." },
  { name: "Affiliate", blurb: "Send us qualified leads — earn a one-time fee, with an optional recurring add-on." },
  { name: "Influencer", blurb: "Drive awareness through your audience — earn per campaign, with an optional recurring add-on." },
  { name: "Referral", blurb: "Make a warm introduction — earn a flat thank-you fee when it closes." }
];

const formatWindow = (program) => {
  if (!program.endDate) return "Ongoing";

  const daysLeft = Math.ceil((new Date(program.endDate) - new Date()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) return "Ends today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
};

export default function Landing() {
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    api.get("/partner/programs/active").then((res) => setPrograms(res.data.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <Link to="/partner/login" className="text-sm font-semibold text-slate-700 hover:text-brand-black transition">
            Partner Sign In
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-red/10 text-brand-red text-xs font-semibold tracking-wide uppercase mb-6">
          SPOTX Partner Program
        </span>

        <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-brand-black tracking-tight leading-tight">
          Grow your business by <br className="hidden sm:block" />
          partnering with SPOTX
        </h1>

        <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto">
          SPOTX is an enterprise-grade digital signage platform that lets businesses manage
          content, monitor screens and run campaigns across every location from one
          dashboard. Refer screen opportunities, close deals through our sales team, and
          earn commission on every one that wins.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          <Link
            to="/partner/register"
            className="inline-flex items-center justify-center gap-2 bg-brand-black text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-charcoal transition"
          >
            Become a Partner
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/partner/login"
            className="inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-slate-50 transition"
          >
            Sign In
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-brand-black">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon size={20} className="mx-auto mb-2 text-brand-yellow" />
              <div className="font-heading text-2xl font-extrabold text-white">{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {programs.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <h2 className="font-heading text-xl font-bold text-brand-black mb-1">Active Partner Programs</h2>
          <p className="text-sm text-slate-500 mb-6">Limited-time — join while one of these is running for extra perks on top of your normal tier.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {programs.map((program) => (
              <div key={program._id} className="relative overflow-hidden rounded-2xl border border-brand-red/20 bg-gradient-to-br from-brand-red/5 to-brand-yellow/5 p-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-red uppercase tracking-wide mb-3">
                  <Sparkles size={14} />
                  {formatWindow(program)}
                </div>

                <h3 className="font-heading text-lg font-bold text-brand-black mb-2">
                  {program.bannerHeadline || program.name}
                </h3>

                <p className="text-sm text-slate-600 mb-5">
                  {program.incentive?.description || program.description || `A limited-time program for ${program.type} partners.`}
                </p>

                <Link
                  to={`/partner/register?program=${program._id}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-black hover:underline"
                >
                  Join This Program
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-light-grey border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-11 h-11 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center mb-4">
                <f.icon size={20} />
              </div>
              <h3 className="font-heading font-bold text-brand-black mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="font-heading text-2xl font-bold text-brand-black mb-2">Grow through the tiers</h2>
          <p className="text-sm text-slate-500">
            Every partner starts at Registered. Commission rates and perks scale up automatically as you grow —
            no renegotiating.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TIERS.map((tier, i) => (
            <div
              key={tier.name}
              className={`rounded-2xl border p-6 ${
                i === TIERS.length - 1
                  ? "border-brand-black bg-brand-black text-white"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className={`text-xs font-semibold uppercase tracking-wide mb-3 ${i === TIERS.length - 1 ? "text-brand-yellow" : "text-brand-red"}`}>
                Tier {i + 1}
              </div>
              <h3 className="font-heading text-lg font-bold mb-1">{tier.name}</h3>
              <p className={`text-xs mb-4 ${i === TIERS.length - 1 ? "text-slate-300" : "text-slate-500"}`}>{tier.requirement}</p>
              <div className="font-heading text-3xl font-extrabold mb-4">{tier.rate}</div>
              <ul className="space-y-1.5">
                {tier.perks.map((perk) => (
                  <li key={perk} className={`flex items-center gap-1.5 text-xs ${i === TIERS.length - 1 ? "text-slate-200" : "text-slate-600"}`}>
                    <Check size={13} className={i === TIERS.length - 1 ? "text-brand-yellow" : "text-brand-red"} />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-light-grey border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="font-heading text-2xl font-bold text-brand-black mb-2">Every kind of partner</h2>
            <p className="text-sm text-slate-500">Pick the relationship that fits how you work with SPOTX — each has its own payout structure.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PARTNER_TYPES.map((type) => (
              <div key={type.name} className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-heading font-bold text-brand-black text-sm mb-2">{type.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{type.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center">
        <p className="text-sm font-medium text-brand-black mb-1">Join a growing digital signage ecosystem.</p>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} SPOTX. Partner Program.</p>
      </footer>
    </div>
  );
}
