import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, Wallet, ShieldCheck, ArrowRight, Sparkles,
  Monitor, MapPin, Activity, Radio, Check, ShoppingBag, Users2, X
} from "lucide-react";
import toast from "react-hot-toast";
import Logo from "../components/ui/Logo";
import api from "../services/api";

// What the reseller panel gives partners: license inventory, customer
// allocations, purchasing, and billing in one place.
const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "One Dashboard for Your Partnership",
    description: "License inventory, customer allocations, purchasing, and billing — everything about how you work with SPOTX lives in one panel."
  },
  {
    icon: Users2,
    title: "Built Around Reselling",
    description: "Buy SPOTX licenses in bulk and resell them to your own customers, on your own pricing."
  },
  {
    icon: Wallet,
    title: "Transparent Money, Either Direction",
    description: "See exactly what you owe SPOTX and when — no surprises either way."
  },
  {
    icon: ShieldCheck,
    title: "Verified & Secure",
    description: "KYC and bank details are encrypted and reviewed by SPOTX before any money moves in either direction."
  }
];

const STATS = [
  { icon: Monitor, value: "1,521+", label: "Screens managed" },
  { icon: MapPin, value: "70+", label: "Business locations" },
  { icon: Activity, value: "99.9%", label: "Platform uptime" },
  { icon: Radio, value: "24/7", label: "Network monitoring" }
];

const PARTNER_TYPES = [
  {
    name: "Reseller",
    icon: ShoppingBag,
    direction: "You pay SPOTX",
    blurb: "Buy SPOTX licenses in bulk, resell with your own hardware.",
    details: [
      "You buy SPOTX screen software licenses from SPOTX in bulk, in advance of having a customer lined up.",
      "You sell each customer a screen and SPOTX software together as one bundled product — you source the hardware, SPOTX only sells you the license.",
      "You're billed for every license you've purchased (monthly, quarterly, or yearly, per your agreement) — regardless of how many are allocated or in active use.",
      "You set your own resale price to your customers — SPOTX has no visibility into that side of your business at all."
    ]
  }
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
  const [activeType, setActiveType] = useState(null);

  useEffect(() => {
    api.get("/partner/programs/active").then((res) => setPrograms(res.data.data)).catch(() => toast.error("Failed to load partner programs."));
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
          One panel to manage <br className="hidden sm:block" />
          your partnership with SPOTX
        </h1>

        <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto">
          SPOTX is an enterprise-grade digital signage platform — businesses use it to manage
          content, monitor screens, and run campaigns across every location from one dashboard.
          The Partner Panel is where <strong className="text-slate-700 font-semibold">you</strong> manage your side of that
          relationship as a SPOTX reseller: buy licenses in bulk and resell them to your own
          customers.
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

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="font-heading text-2xl font-bold text-brand-black mb-2">How the Reseller relationship works</h2>
          <p className="text-sm text-slate-500">
            One partnership model, built around buying and reselling SPOTX licenses. Here's the shape of it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
          {PARTNER_TYPES.map((type) => (
            <button
              key={type.name}
              type="button"
              onClick={() => setActiveType(type)}
              className="text-left bg-white rounded-2xl border border-slate-200 p-5 flex flex-col hover:border-brand-red hover:shadow-md transition cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center mb-3">
                <type.icon size={18} />
              </div>
              <h3 className="font-heading font-bold text-brand-black text-sm mb-1">{type.name}</h3>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{type.direction}</span>
              <p className="text-xs text-slate-500 leading-relaxed">{type.blurb}</p>
              <span className="text-xs font-semibold text-brand-red mt-3">See how it works →</span>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Click the card above to see how it works.
        </p>
      </section>

      {activeType && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setActiveType(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0">
                  <activeType.icon size={18} />
                </div>
                <div>
                  <p className="font-heading font-bold text-brand-black">{activeType.name}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{activeType.direction}</span>
                </div>
              </div>
              <button type="button" onClick={() => setActiveType(null)} className="text-slate-400 hover:text-brand-black shrink-0" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-6">
              <ul className="space-y-3">
                {activeType.details.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check size={15} className="text-brand-red mt-0.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

            </div>

            <div className="px-6 py-4 border-t border-slate-100 shrink-0">
              <Link
                to="/partner/register"
                className="inline-flex items-center justify-center gap-2 w-full bg-brand-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-charcoal transition"
              >
                Register as a {activeType.name}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

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

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center">
        <p className="text-sm font-medium text-brand-black mb-1">Join a growing digital signage ecosystem.</p>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} SPOTX. Partner Program.</p>
      </footer>
    </div>
  );
}
