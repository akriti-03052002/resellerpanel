import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import customerApi from "../services/customerApi.js";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import Logo from "../components/ui/Logo";
import { COUNTRIES } from "../data/countries";
import { INDIAN_STATES } from "../data/indianStates";
import { CITIES_BY_STATE } from "../data/indiaCitiesByState";
import { COUNTRY_CODES } from "../data/countryCodes";

const inputClass =
  "w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition";

export default function CustomerRegister() {
  const navigate = useNavigate();
  const { setSession } = useCustomerAuth();
  const [searchParams] = useSearchParams();
  const codeFromLink = searchParams.get("ref") || "";

  const [vendorName, setVendorName] = useState("");
  const [codeStatus, setCodeStatus] = useState(""); // "" | "checking" | "valid" | "invalid"
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    referralCode: codeFromLink,
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    country: "India",
    state: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
    pincode: "",
    password: "",
    confirmPassword: ""
  });

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Same phone-with-country-code pattern as Partnerregister.jsx — a
  // datalist-backed dial-code picker plus a plain number field, composed
  // into one `phone` string on submit.
  const phoneDialLabel = (c) => `${c.name} (${c.dial})`;

  const [phoneDial, setPhoneDial] = useState("+91");
  const [phoneDialInput, setPhoneDialInput] = useState(phoneDialLabel(COUNTRY_CODES[0]));
  const [phoneNumber, setPhoneNumber] = useState("");

  const handlePhoneDialInputChange = (e) => {
    const label = e.target.value;
    setPhoneDialInput(label);

    const match = COUNTRY_CODES.find((c) => phoneDialLabel(c) === label);
    if (!match) return;

    setPhoneDial(match.dial);
    setForm((prev) => ({ ...prev, phone: phoneNumber ? `${match.dial} ${phoneNumber}` : "" }));
  };

  const handlePhoneNumberChange = (e) => {
    const num = e.target.value.replace(/[^\d\s]/g, "");
    setPhoneNumber(num);
    setForm((prev) => ({ ...prev, phone: num ? `${phoneDial} ${num}` : "" }));
  };

  const [pincodeStatus, setPincodeStatus] = useState(""); // "" | "loading" | "found" | "not-found"
  const [cityOptions, setCityOptions] = useState([]); // localities returned for the entered pincode (takes priority)
  const [cityIsCustom, setCityIsCustom] = useState(false); // user opted to type a city not in the menu

  // Pincode-derived localities are more precise; fall back to the state's
  // major-cities list so picking a state alone still gives a menu.
  const cityMenuOptions = cityOptions.length > 0 ? cityOptions : (CITIES_BY_STATE[form.state] || []);

  // India Post's public pincode API — no key needed. Only meaningful for
  // India, so it's skipped whenever the country field has been changed.
  useEffect(() => {
    const pincode = form.pincode;
    const country = form.country;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      if (country !== "India" || !/^\d{6}$/.test(pincode)) {
        setPincodeStatus("");
        setCityOptions([]);
        return;
      }

      setPincodeStatus("loading");

      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await res.json();
        const offices = data?.[0]?.Status === "Success" ? data[0].PostOffice : null;

        if (cancelled) return;

        if (offices && offices.length > 0) {
          const localities = [...new Set(offices.map((o) => o.Name).filter(Boolean))];

          setCityOptions(localities);
          setCityIsCustom(false);
          setForm((prev) => ({
            ...prev,
            country: "India",
            state: offices[0].State || prev.state,
            city: localities.includes(prev.city) ? prev.city : (offices[0].District || localities[0] || prev.city)
          }));
          setPincodeStatus("found");
        } else {
          setCityOptions([]);
          setPincodeStatus("not-found");
        }
      } catch {
        if (!cancelled) {
          setCityOptions([]);
          setPincodeStatus("not-found");
        }
      }
    }, 500);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.pincode, form.country]);

  useEffect(() => {
    const code = form.referralCode.trim();
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      if (!code) {
        setCodeStatus("");
        setVendorName("");
        return;
      }

      setCodeStatus("checking");

      try {
        const res = await customerApi.get(`/public/customers/referral/${code}`);
        if (cancelled) return;
        setVendorName(res.data.data.businessName);
        setCodeStatus("valid");
      } catch {
        if (!cancelled) {
          setVendorName("");
          setCodeStatus("invalid");
        }
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.referralCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      const res = await customerApi.post("/public/customers/register", {
        referralCode: form.referralCode.trim(),
        companyName: form.companyName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        country: form.country,
        state: form.state,
        city: form.city,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        pincode: form.pincode,
        password: form.password
      });
      setSuccess(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong during registration.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
          <CheckCircle2 size={40} className="text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">You're all set, {success.customer.companyName}</h2>
          <p className="text-sm text-slate-500">
            Your 30-day free trial has started and ends on{" "}
            <span className="font-semibold text-slate-700">{new Date(success.customer.trialEndsAt).toLocaleDateString()}</span>.
          </p>
          <p className="text-sm text-slate-500 mt-4">Your vendor will be in touch to help set up your screens.</p>
          <button
            type="button"
            onClick={() => {
              setSession(success);
              navigate("/customer/dashboard", { replace: true });
            }}
            className="w-full mt-6 bg-brand-black text-white py-3.5 rounded-xl font-semibold hover:bg-charcoal transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size="lg" /></div>
          <p className="text-slate-500 mt-2">Start your free 30-day trial</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Customer Registration</h2>
            <p className="text-sm text-slate-500 mt-2">Register with your vendor's referral code to begin.</p>
          </div>

          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Referral Code *</label>
              <div className="relative">
                <input
                  type="text"
                  name="referralCode"
                  value={form.referralCode}
                  onChange={handleChange}
                  placeholder="4-digit code from your vendor"
                  maxLength={4}
                  className={`${inputClass} ${codeFromLink ? "bg-slate-50 text-slate-600 cursor-not-allowed pr-10" : ""}`}
                  readOnly={Boolean(codeFromLink)}
                  required
                />
                {codeFromLink && (
                  <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                )}
              </div>
              {codeStatus === "checking" && <p className="text-xs text-slate-400 mt-1">Checking code...</p>}
              {codeStatus === "valid" && (
                <p className="text-xs text-green-600 mt-1">
                  {codeFromLink ? `Locked to your referral link — registering under ${vendorName}` : `Registering under ${vendorName}`}
                </p>
              )}
              {codeStatus === "invalid" && <p className="text-xs text-red-600 mt-1">This code isn't valid or is no longer active.</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Company Name *</label>
              <input type="text" name="companyName" value={form.companyName} onChange={handleChange} className={inputClass} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contact Name</label>
              <input type="text" name="contactName" value={form.contactName} onChange={handleChange} className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@company.com" className={inputClass} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
              <div className="flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition">
                <input
                  type="text"
                  list="customer-phone-country-codes"
                  value={phoneDialInput}
                  onChange={handlePhoneDialInputChange}
                  placeholder="Search country"
                  className="shrink-0 w-[42%] px-3 py-3 bg-slate-50 border-r border-slate-200 outline-none text-sm text-slate-700"
                />
                <datalist id="customer-phone-country-codes">
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
                />
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                  <select name="country" value={form.country} onChange={handleChange} className={inputClass}>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pincode</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="pincode"
                      value={form.pincode}
                      onChange={handleChange}
                      placeholder="6-digit pincode"
                      maxLength={6}
                      className={inputClass}
                    />
                    {pincodeStatus === "loading" && (
                      <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                    )}
                  </div>
                  {pincodeStatus === "found" && (
                    <p className="text-xs text-green-600 mt-1">State and city detected from pincode.</p>
                  )}
                  {pincodeStatus === "not-found" && (
                    <p className="text-xs text-amber-600 mt-1">Couldn't detect this pincode — enter state/city manually.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                  {form.country === "India" ? (
                    <select
                      name="state"
                      value={form.state}
                      onChange={(e) => { handleChange(e); setCityIsCustom(false); }}
                      className={inputClass}
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input type="text" name="state" value={form.state} onChange={handleChange} placeholder="State" className={inputClass} />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                  {cityMenuOptions.length > 0 && !cityIsCustom ? (
                    <select
                      name="city"
                      value={form.city}
                      onChange={(e) => {
                        if (e.target.value === "__other__") {
                          setCityIsCustom(true);
                          setForm((prev) => ({ ...prev, city: "" }));
                        } else {
                          handleChange(e);
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="">Select city</option>
                      {!cityMenuOptions.includes(form.city) && form.city && (
                        <option value={form.city}>{form.city}</option>
                      )}
                      {cityMenuOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="__other__">Other (type manually)</option>
                    </select>
                  ) : (
                    <div>
                      <input type="text" name="city" value={form.city} onChange={handleChange} placeholder="City" className={inputClass} />
                      {cityMenuOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCityIsCustom(false)}
                          className="text-xs text-brand-red font-medium mt-1 hover:underline"
                        >
                          Choose from list instead
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address Line 1</label>
                  <input type="text" name="addressLine1" value={form.addressLine1} onChange={handleChange} placeholder="Street address" className={inputClass} />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Address Line 2</label>
                  <input type="text" name="addressLine2" value={form.addressLine2} onChange={handleChange} placeholder="Building / Area / Landmark" className={inputClass} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password *</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Minimum 8 characters" className={inputClass} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password *</label>
              <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} className={inputClass} required />
            </div>

            <button
              type="submit"
              disabled={loading || codeStatus !== "valid"}
              className="w-full bg-brand-black text-white py-3.5 rounded-xl font-semibold hover:bg-charcoal transition disabled:opacity-50"
            >
              {loading ? "Registering..." : "Start Free Trial"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already registered?{" "}
            <Link to="/customer/login" className="font-semibold text-slate-900 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
