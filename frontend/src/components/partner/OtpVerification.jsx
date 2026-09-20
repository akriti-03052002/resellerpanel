import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import api from "../../services/api.js";

// Email OTP verification — the box to enter the code only appears once
// an OTP has actually been sent. Fully self-contained: owns its own
// send/verify/resend state and only reports upward once verification
// actually succeeds (via onVerified), since that's the one fact the
// parent form needs before it'll allow submit.
export default function OtpVerification({ email, emailLooksValid, verified, onVerified }) {
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  const handleSendOtp = async () => {
    setOtpError("");
    setOtpMessage("");
    setOtpSending(true);

    try {
      await api.post("/partner/auth/send-otp", { email });
      setOtpSent(true);
      setOtpMessage(`OTP sent to ${email}.`);
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
      const res = await api.post("/partner/auth/verify-otp", { email, otp: otpValue });
      setOtpMessage("Email verified.");
      onVerified(res.data.verificationToken);
    } catch (err) {
      setOtpError(err.response?.data?.message || "Incorrect OTP. Try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  if (verified) {
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-green-600 shrink-0 px-2">
        <CheckCircle2 size={18} /> Verified
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSendOtp}
        disabled={!emailLooksValid || otpSending}
        className="shrink-0 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
      >
        {otpSending ? "Sending..." : otpSent ? "Resend OTP" : "Generate OTP"}
      </button>

      {otpError && <p className="text-xs text-brand-red mt-1.5">{otpError}</p>}
      {!otpError && otpMessage && <p className="text-xs text-green-600 mt-1.5">{otpMessage}</p>}

      {otpSent && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpValue}
            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter 6-digit OTP"
            className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition flex-1 tracking-widest"
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
    </>
  );
}
