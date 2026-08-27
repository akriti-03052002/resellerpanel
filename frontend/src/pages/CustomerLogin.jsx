import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import customerApi from "../services/customerApi.js";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import Logo from "../components/ui/Logo";

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { setSession } = useCustomerAuth();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const response = await customerApi.post("/public/customers/login", {
        email: formData.email,
        password: formData.password
      });

      setSession(response.data.data);
      navigate("/customer/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size="lg" /></div>
          <p className="text-slate-500 mt-2">Customer Portal</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
            <p className="text-sm text-slate-500 mt-2">Sign in to your customer account</p>
          </div>

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@company.com"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                required
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <Link to="/customer/forgot-password" className="text-xs text-slate-500 hover:text-slate-900">
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-black text-white py-3.5 rounded-xl font-semibold hover:bg-charcoal transition disabled:opacity-50"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <Link to="/customer/register" className="font-semibold text-slate-900 hover:underline">
                Start free trial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
