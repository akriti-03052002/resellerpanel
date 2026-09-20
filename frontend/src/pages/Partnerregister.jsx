import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import api from "../services/api.js"
import { usePartnerAuth } from "../context/PartnerAuthContext";
import Logo from "../components/ui/Logo";
import PhoneInput from "../components/partner/PhoneInput";
import OtpVerification from "../components/partner/OtpVerification";
import PasswordField from "../components/partner/PasswordField";

const registerSchema = z
  .object({
    contactName: z.string().trim().min(1, "Full name is required."),
    email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
    phone: z.string().trim().min(1, "Phone number is required."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

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
  const [programId, setProgramId] = useState("");
  const [partnerType, setPartnerType] = useState("reseller");

  // Email OTP verification — re-editing the email after verifying resets
  // it since the verification is tied to that address.
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      contactName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const email = watch("email");
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");

  const handleEmailVerified = (token) => {
    setEmailVerified(true);
    setEmailVerificationToken(token);
  };

  useEffect(() => {
    setEmailVerified(false);
    setEmailVerificationToken("");
  }, [email]);

  useEffect(() => {
    if (!programIdFromLink) return;

    api.get("/partner/programs/active").then((res) => {
      const program = res.data.data.find((p) => p._id === programIdFromLink);

      if (!program) {
        setProgramNotice("This program link has expired or is no longer active — you can still register normally below.");
        return;
      }

      setJoinedProgram(program);
      setProgramId(program._id);
      setPartnerType(program.type);
    }).catch(() => {});
  }, [programIdFromLink]);

  const onSubmit = async (data) => {
    setError("");
    setSuccess("");

    if (!emailVerified) {
      setError("Please verify your email with the OTP before continuing.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        partnerType,
        programId,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        password: data.password,
      };

      const response = await api.post(
        "/partner/auth/register",
        { ...payload, emailVerificationToken }
      );

      const responseData = response.data;

      setSession(responseData);

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
          onSubmit={handleSubmit(onSubmit)}
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
                <label className="block text-sm font-medium mb-2">Partner Type</label>
                <div className={`${inputClass} bg-slate-50 text-slate-700`}>Reseller</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name *
                </label>

                <input
                  type="text"
                  placeholder="Full name"
                  className={inputClass}
                  {...register("contactName")}
                />
                {errors.contactName && <p className="text-xs text-brand-red mt-1.5">{errors.contactName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Email *
                </label>

                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="name@company.com"
                    className={`${inputClass} flex-1`}
                    disabled={emailVerified}
                    {...register("email")}
                  />

                  <OtpVerification
                    key={email}
                    email={email}
                    emailLooksValid={emailLooksValid}
                    verified={emailVerified}
                    onVerified={handleEmailVerified}
                  />
                </div>

                {errors.email && <p className="text-xs text-brand-red mt-1.5">{errors.email.message}</p>}
              </div>

              <PhoneInput control={control} name="phone" error={errors.phone} />

            </div>

          </section>

          {/* Account Security */}

          <section className="mb-8">

            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Account Security
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <PasswordField
                register={register}
                name="password"
                label="Password *"
                placeholder="Minimum 8 characters"
                error={errors.password}
              />

              <PasswordField
                register={register}
                name="confirmPassword"
                label="Confirm Password *"
                placeholder="Confirm password"
                error={errors.confirmPassword}
              />

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
