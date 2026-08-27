import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import api from "../services/api.js"
import { usePartnerAuth } from "../context/PartnerAuthContext";
import Logo from "../components/ui/Logo";
import { COUNTRY_CODES } from "../data/countryCodes";

export default function PartnerRegister() {
  const navigate = useNavigate();
  const { setSession } = usePartnerAuth();
  const [searchParams] = useSearchParams();
  const programIdFromLink = searchParams.get("program");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [joinedProgram, setJoinedProgram] = useState(null);
  const [programNotice, setProgramNotice] = useState("");

  const [formData, setFormData] = useState({
    partnerType: "vendor",
    programId: "",

    contactName: "",
    email: "",
    phone: "",

    password: "",
    confirmPassword: "",
  });

  const phoneDialLabel = (c) => `${c.name} (${c.dial})`;

  const [phoneDial, setPhoneDial] = useState("+91");
  const [phoneDialInput, setPhoneDialInput] = useState(phoneDialLabel(COUNTRY_CODES[0]));
  const [phoneNumber, setPhoneNumber] = useState("");

  // A datalist-backed input: clicking it (with nothing typed) shows the
  // full list to pick from, typing filters it live by name or dial code —
  // either way of choosing lands here once the typed/picked text matches
  // an exact option.
  const handlePhoneDialInputChange = (e) => {
    const label = e.target.value;
    setPhoneDialInput(label);

    const match = COUNTRY_CODES.find((c) => phoneDialLabel(c) === label);
    if (!match) return;

    setPhoneDial(match.dial);
    setFormData((prev) => ({ ...prev, phone: phoneNumber ? `${match.dial} ${phoneNumber}` : "" }));
  };

  const handlePhoneNumberChange = (e) => {
    const num = e.target.value.replace(/[^\d\s]/g, "");
    setPhoneNumber(num);
    setFormData((prev) => ({ ...prev, phone: num ? `${phoneDial} ${num}` : "" }));
  };

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email OTP verification — the box to enter the code only appears once
  // an OTP has actually been sent, and re-editing the email after
  // verifying resets it since the verification is tied to that address.
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState("");

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

  const handleEmailChange = (e) => {
    handleChange(e);
    setEmailVerified(false);
    setEmailVerificationToken("");
    setOtpSent(false);
    setOtpValue("");
    setOtpError("");
    setOtpMessage("");
  };

  const handleSendOtp = async () => {
    setOtpError("");
    setOtpMessage("");
    setOtpSending(true);

    try {
      await api.post("/partner/auth/send-otp", { email: formData.email });
      setOtpSent(true);
      setOtpMessage(`OTP sent to ${formData.email}.`);
    } catch (err) {
      setOtpError(err.response?.data?.message || "Couldn't send the OTP. Try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    setOtpVerifying(true);

    try {
      const res = await api.post("/partner/auth/verify-otp", { email: formData.email, otp: otpValue });
      setEmailVerified(true);
      setEmailVerificationToken(res.data.verificationToken);
      setOtpMessage("Email verified.");
    } catch (err) {
      setOtpError(err.response?.data?.message || "Incorrect OTP. Try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  useEffect(() => {
    if (!programIdFromLink) return;

    api.get("/partner/programs/active").then((res) => {
      const program = res.data.data.find((p) => p._id === programIdFromLink);

      if (!program) {
        setProgramNotice("This program link has expired or is no longer active — you can still register normally below.");
        return;
      }

      setJoinedProgram(program);
      setFormData((prev) => ({ ...prev, programId: program._id, partnerType: program.type }));
    }).catch(() => {});
  }, [programIdFromLink]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!emailVerified) {
      setError("Please verify your email with the OTP before continuing.");
      return;
    }

    if (!formData.phone) {
      setError("Phone number is required.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);

      // Don't send confirmPassword to backend
      const {
        confirmPassword, // eslint-disable-line no-unused-vars
        ...payload
      } = formData;

      const response = await api.post(
        "/partner/auth/register",
        { ...payload, emailVerificationToken }
      );

      const data = response.data;

      setSession(data);

      setSuccess(
        "Registration successful. Redirecting..."
      );

      // Directly go to dashboard
      setTimeout(() => {
        navigate("/partner/dashboard", {
          replace: true,
        });
      }, 500);

    } catch (err) {
      console.error(
        "Registration error:",
        err
      );

      setError(
        err.response?.data?.message ||
        "Registration failed. Please try again."
      );

    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 border border-slate-200 rounded-xl " +
    "outline-none focus:border-slate-400 focus:ring-2 " +
    "focus:ring-slate-100 transition";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">

      <div className="w-full max-w-xl">

        {/* Header */}

        <div className="text-center mb-8">

          <div className="flex justify-center">
            <Logo size="lg" />
          </div>

          <p className="text-slate-500 mt-2">
            Become a Partner
          </p>

        </div>

        {/* Form */}

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8"
        >

          {/* Joined-via-program banner */}

          {joinedProgram && (
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-brand-red/5 to-brand-yellow/5 border border-brand-red/20">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-red uppercase tracking-wide mb-1">
                <Sparkles size={14} />
                Joining via {joinedProgram.bannerHeadline || joinedProgram.name}
              </div>
              <p className="text-sm text-slate-700">
                {joinedProgram.incentive?.description || `Special terms apply for ${joinedProgram.type} partners joining through this program.`}
              </p>
            </div>
          )}

          {programNotice && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {programNotice}
            </div>
          )}

          {/* Error */}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success */}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
              {success}
            </div>
          )}

          <p className="text-sm text-slate-500 mb-6">
            Just the basics for now — you'll fill in your business details, address and KYC documents from your profile after logging in.
          </p>

          {/* Partner Information */}

          <section className="mb-8">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="block text-sm font-medium mb-2">
                  Partner Type
                </label>

                <select
                  name="partnerType"
                  value={formData.partnerType}
                  onChange={handleChange}
                  disabled={Boolean(joinedProgram)}
                  className={`${inputClass} ${joinedProgram ? "bg-slate-50 text-slate-500" : ""}`}
                >
                  <option value="vendor">
                    Vendor
                  </option>

                  <option value="affiliate">
                    Affiliate
                  </option>

                  <option value="referral">
                    Referral
                  </option>

                  <option value="agency">
                    Agency
                  </option>

                  <option value="reseller">
                    Reseller
                  </option>

                  <option value="technology">
                    Technology
                  </option>

                  <option value="strategic">
                    Strategic
                  </option>

                  <option value="influencer">
                    Influencer
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name *
                </label>

                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="Full name"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Email *
                </label>

                <div className="flex gap-2">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleEmailChange}
                    placeholder="name@company.com"
                    className={`${inputClass} flex-1`}
                    disabled={emailVerified}
                    required
                  />

                  {emailVerified ? (
                    <span className="flex items-center gap-1 text-sm font-medium text-green-600 shrink-0 px-2">
                      <CheckCircle2 size={18} /> Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={!emailLooksValid || otpSending}
                      className="shrink-0 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                    >
                      {otpSending ? "Sending..." : otpSent ? "Resend OTP" : "Generate OTP"}
                    </button>
                  )}
                </div>

                {otpError && <p className="text-xs text-brand-red mt-1.5">{otpError}</p>}
                {!otpError && otpMessage && <p className="text-xs text-green-600 mt-1.5">{otpMessage}</p>}

                {otpSent && !emailVerified && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit OTP"
                      className={`${inputClass} flex-1 tracking-widest`}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otpValue.length !== 6 || otpVerifying}
                      className="shrink-0 px-4 py-3 rounded-xl bg-brand-black text-white text-sm font-semibold hover:bg-charcoal disabled:opacity-50 transition"
                    >
                      {otpVerifying ? "Verifying..." : "Verify OTP"}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Phone *
                </label>

                <div className="flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition">
                  <input
                    type="text"
                    list="phone-country-codes"
                    value={phoneDialInput}
                    onChange={handlePhoneDialInputChange}
                    placeholder="Search country"
                    className="shrink-0 w-[42%] px-3 py-3 bg-slate-50 border-r border-slate-200 outline-none text-sm text-slate-700"
                  />
                  <datalist id="phone-country-codes">
                    {COUNTRY_CODES.map((c) => (
                      <option key={`${c.name}-${c.dial}`} value={phoneDialLabel(c)} />
                    ))}
                  </datalist>

                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    placeholder="XXXXX XXXXX"
                    className="flex-1 min-w-0 px-4 py-3 outline-none"
                    required
                  />
                </div>
              </div>

            </div>

          </section>

          {/* Account Security */}

          <section className="mb-8">

            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Account Security
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <div>
                <label className="block text-sm font-medium mb-2">
                  Password *
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 8 characters"
                    className={`${inputClass} pr-11`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Confirm Password *
                </label>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                    className={`${inputClass} pr-11`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

            </div>

          </section>

          {/* Submit */}

          <button
            type="submit"
            disabled={loading || !emailVerified}
            className="w-full bg-brand-black text-white py-3.5 rounded-xl font-semibold hover:bg-charcoal transition disabled:opacity-50"
          >
            {loading
              ? "Creating Account..."
              : emailVerified
              ? "Create Partner Account"
              : "Verify your email to continue"}
          </button>

          {/* Login */}

          <p className="text-center text-sm text-slate-500 mt-6">

            Already have an account?{" "}

            <Link
              to="/partner/login"
              className="font-semibold text-slate-900 hover:underline"
            >
              Login
            </Link>

          </p>

        </form>

      </div>

    </div>
  );
}
