import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import Logo from "../components/ui/Logo";

export default function CustomerVerifyAndSetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/public/reseller-customers/verify", { token, password });
      localStorage.setItem("customerPortalToken", res.data.data.token);
      navigate("/customer/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong verifying your email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-grey flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full">
        <Logo size="sm" className="mb-6" />
        <h1 className="text-xl font-bold text-slate-900 mb-1">Verify Your Email</h1>
        <p className="text-sm text-slate-500 mb-6">Set a password to finish verifying your email and access your account.</p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-brand-black text-white hover:bg-charcoal transition disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Verify & Set Password"}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6">
          Already verified? <Link to="/customer/login" className="font-medium text-brand-red hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
