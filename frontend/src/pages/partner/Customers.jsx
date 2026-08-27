import { useEffect, useState } from "react";
import { Plus, Copy, Check, Loader2 } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { COUNTRIES } from "../../data/countries";
import { INDIAN_STATES } from "../../data/indianStates";
import { CITIES_BY_STATE } from "../../data/indiaCitiesByState";
import { COUNTRY_CODES } from "../../data/countryCodes";

const EMPTY_FORM = {
  companyName: "", contactName: "", email: "", phone: "",
  country: "India", state: "", city: "", addressLine1: "", addressLine2: "", pincode: ""
};

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button type="button" onClick={copy} className="text-slate-400 hover:text-brand-black shrink-0" aria-label="Copy">
      {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
    </button>
  );
}

const subscriptionBadge = (customer) => {
  if (customer.subscription.status === "trial" && customer.trialExpired) {
    return <Badge tone="danger">Trial expired</Badge>;
  }
  return <Badge status={customer.subscription.status} />;
};

export default function Customers() {
  const [partner, setPartner] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    Promise.all([
      api.get("/partner/profile").then((res) => setPartner(res.data.data.partner)),
      api.get("/partner/customers").then((res) => setCustomers(res.data.data))
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Same phone-with-country-code + pincode-autofill pattern used on
  // CustomerRegister.jsx / Partnerregister.jsx — kept consistent everywhere
  // a phone/address pair is collected in this app.
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
  const [cityOptions, setCityOptions] = useState([]);
  const [cityIsCustom, setCityIsCustom] = useState(false);

  const cityMenuOptions = cityOptions.length > 0 ? cityOptions : (CITIES_BY_STATE[form.state] || []);

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

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setPhoneDial("+91");
    setPhoneDialInput(phoneDialLabel(COUNTRY_CODES[0]));
    setPhoneNumber("");
    setPincodeStatus("");
    setCityOptions([]);
    setCityIsCustom(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api.post("/partner/customers", form);
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong registering the customer.");
    } finally {
      setSubmitting(false);
    }
  };

  const isVendor = partner?.partnerType === "vendor";
  // VerifiedGate (wrapping this route) already guarantees the partner is
  // fully verified before this page ever renders.
  const referralCode = partner?.referral?.referralCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        {isVendor && (
          <Button onClick={() => setShowForm((v) => !v)}>
            <span className="flex items-center gap-2"><Plus size={16} /> Register Customer</span>
          </Button>
        )}
      </div>

      {isVendor && referralCode && (
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your customer referral code</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading text-2xl font-extrabold text-brand-black tracking-widest">{referralCode}</span>
            <CopyButton value={referralCode} />
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-sm text-slate-500 truncate">{partner.referral.referralLink}</span>
            <CopyButton value={partner.referral.referralLink} />
          </div>
          <p className="text-xs text-slate-400 mt-2">Share this with customers — anyone who registers with it is automatically mapped to you.</p>
        </Card>
      )}

      {!isVendor && (
        <Card className="p-5">
          <p className="text-sm text-slate-500">Customer registration is available for Vendor partners.</p>
        </Card>
      )}

      {showForm && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Company Name *" name="companyName" value={form.companyName} onChange={handleChange} required />
            <Input label="Contact Name" name="contactName" value={form.contactName} onChange={handleChange} />
            <Input label="Email *" type="email" name="email" value={form.email} onChange={handleChange} required />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
              <div className="flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition">
                <input
                  type="text"
                  list="register-customer-phone-country-codes"
                  value={phoneDialInput}
                  onChange={handlePhoneDialInputChange}
                  placeholder="Search country"
                  className="shrink-0 w-[42%] px-3 py-3 bg-slate-50 border-r border-slate-200 outline-none text-sm text-slate-700"
                />
                <datalist id="register-customer-phone-country-codes">
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

            <div className="md:col-span-2 pt-2">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Country" name="country" value={form.country} onChange={handleChange}>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pincode</label>
                  <div className="relative">
                    <Input name="pincode" value={form.pincode} onChange={handleChange} placeholder="6-digit pincode" maxLength={6} />
                    {pincodeStatus === "loading" && (
                      <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                    )}
                  </div>
                  {pincodeStatus === "found" && <p className="text-xs text-green-600 mt-1">State and city detected from pincode.</p>}
                  {pincodeStatus === "not-found" && <p className="text-xs text-amber-600 mt-1">Couldn't detect this pincode — enter state/city manually.</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                  {form.country === "India" ? (
                    <Select
                      name="state"
                      value={form.state}
                      onChange={(e) => { handleChange(e); setCityIsCustom(false); }}
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  ) : (
                    <Input name="state" value={form.state} onChange={handleChange} placeholder="State" />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                  {cityMenuOptions.length > 0 && !cityIsCustom ? (
                    <Select
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
                    >
                      <option value="">Select city</option>
                      {!cityMenuOptions.includes(form.city) && form.city && (
                        <option value={form.city}>{form.city}</option>
                      )}
                      {cityMenuOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="__other__">Other (type manually)</option>
                    </Select>
                  ) : (
                    <div>
                      <Input name="city" value={form.city} onChange={handleChange} placeholder="City" />
                      {cityMenuOptions.length > 0 && (
                        <button type="button" onClick={() => setCityIsCustom(false)} className="text-xs text-brand-red font-medium mt-1 hover:underline">
                          Choose from list instead
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <Input label="Address Line 1" name="addressLine1" value={form.addressLine1} onChange={handleChange} placeholder="Street address" className="md:col-span-2" />
                <Input label="Address Line 2" name="addressLine2" value={form.addressLine2} onChange={handleChange} placeholder="Building / Area / Landmark" className="md:col-span-2" />
              </div>
            </div>

            <p className="text-xs text-slate-500 md:col-span-2">
              The customer will receive an email to set their own password — you won't see or set it here.
            </p>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" loading={submitting}>Register Customer</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No customers yet."
            rows={customers}
            columns={[
              { key: "company", header: "Company", render: (c) => c.companyName },
              { key: "contact", header: "Contact", render: (c) => c.contactName || "—" },
              { key: "email", header: "Email", render: (c) => c.email },
              { key: "source", header: "Source", render: (c) => <Badge tone="neutral">{c.registrationSource === "referral_code" ? "Referral code" : "Registered by you"}</Badge> },
              { key: "status", header: "Subscription", render: (c) => subscriptionBadge(c) },
              { key: "trial", header: "Trial Ends", render: (c) => c.trial?.endsAt ? new Date(c.trial.endsAt).toLocaleDateString() : "—" },
              { key: "date", header: "Registered", render: (c) => new Date(c.createdAt).toLocaleDateString() }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
