import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Card from "../ui/Card";

// Wraps any route that presumes a fully-verified partner (referrals,
// opportunities, commissions, settlements, team, customers). Always
// re-checks against the server instead of trusting the partner snapshot
// cached at login, since verification can complete mid-session.
export default function VerifiedGate({ children }) {
  const [status, setStatus] = useState("checking"); // checking | locked | unlocked

  useEffect(() => {
    api.get("/partner/profile")
      .then((res) => setStatus(res.data.data.partner.status === "active" ? "unlocked" : "locked"))
      .catch(() => {
        toast.error("Couldn't verify your account status.");
        setStatus("locked");
      });
  }, []);

  if (status === "checking") {
    return <p className="text-slate-400 text-sm">Loading...</p>;
  }

  if (status === "locked") {
    return (
      <Card className="p-6 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
          <Lock size={16} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">This feature is locked</p>
          <p className="text-sm text-slate-500 mt-1">
            It unlocks automatically once SPOTX verifies your{" "}
            <Link to="/partner/documents" className="font-medium text-brand-red hover:underline">KYC documents</Link>{" "}
            and{" "}
            <Link to="/partner/bank" className="font-medium text-brand-red hover:underline">bank account</Link>.
            No extra step needed — check back once both show as verified on your Dashboard.
          </p>
        </div>
      </Card>
    );
  }

  return children;
}
