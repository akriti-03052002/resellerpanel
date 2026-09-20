import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCog, Loader2 } from "lucide-react";
import { Country, State } from "country-state-city";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { usePartnerAuth } from "../../context/PartnerAuthContext";
import { CITIES_BY_STATE } from "../../data/indiaCitiesByState";

const ENTITY_TYPES = ["proprietorship", "partnership", "llp", "private_limited", "public_limited", "individual", "other"];

// country-state-city gives real, ISO-linked state/province lists for all
// 250 countries — used instead of a hand-maintained country list + the
// Zippopotam.us postal lookup that used to drive this (Zippopotam only
// covers a limited set of countries, so state/city auto-fill silently did
// nothing for anything outside it — that was the actual "not working" bug).
// India first since it's the default and the only one with pincode auto-fill.
const ALL_COUNTRIES = (() => {
  const all = Country.getAllCountries();
  const india = all.find((c) => c.name === "India");
  const rest = all.filter((c) => c.name !== "India").sort((a, b) => a.name.localeCompare(b.name));
  return india ? [india, ...rest] : all;
})();

export default function Profile() {
  const navigate = useNavigate();
  const { user } = usePartnerAuth();
  const [form, setForm] = useState(null);
  const [profileComplete, setProfileComplete] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [pincodeStatus, setPincodeStatus] = useState(""); // "" | "loading" | "found" | "not-found"
  const [pincodeTouched, setPincodeTouched] = useState(false); // only auto-lookup once the partner edits it, not on initial load
  const [cityOptions, setCityOptions] = useState([]); // localities returned for the entered pincode (takes priority)
  const [cityIsCustom, setCityIsCustom] = useState(false); // partner opted to type a city not in the menu

  useEffect(() => {
    api.get("/partner/profile").then((res) => {
      const { partner, profileComplete } = res.data.data;
      setProfileComplete(profileComplete);
      setForm({
        businessName: partner.legalEntity.businessName,
        legalName: partner.legalEntity.legalName,
        entityType: partner.legalEntity.entityType || "",
        website: partner.legalEntity.website,
        industry: partner.legalEntity.industry,
        contactName: partner.primaryContact.name,
        phone: partner.primaryContact.phone,
        designation: partner.primaryContact.designation,
        country: partner.address.country || "India",
        state: partner.address.state,
        city: partner.address.city,
        addressLine1: partner.address.addressLine1,
        addressLine2: partner.address.addressLine2,
        pincode: partner.address.pincode
      });
    });
  }, []);

  // Pincode-derived localities are more precise; fall back to the state's
  // major-cities list so picking a state alone still gives a menu.
  const cityMenuOptions = cityOptions.length > 0 ? cityOptions : (CITIES_BY_STATE[form?.state] || []);

  // States/provinces for whichever country is selected — independent of
  // any postal-code lookup succeeding, which is what actually broke for
  // non-India before. Some small countries have no subdivisions in the
  // dataset, in which case the State field falls back to free text.
  const statesForCountry = useMemo(() => {
    const country = ALL_COUNTRIES.find((c) => c.name === form?.country);
    return country ? State.getStatesOfCountry(country.isoCode) : [];
  }, [form?.country]);

  // India Post's public pincode API — no key needed, and only meaningful
  // for India (there's no reliable free equivalent with good coverage for
  // every other country, so non-India postal codes are just free text).
  // Skipped until the partner actually edits the pincode, so loading an
  // already-saved profile doesn't silently overwrite a manually-picked city.
  useEffect(() => {
    if (!form || !pincodeTouched || form.country !== "India") return;

    const pincode = form.pincode.trim();
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;

      if (!/^\d{6}$/.test(pincode)) {
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
          // Several post-office localities can share one pincode — offer
          // them as a menu instead of guessing which one is the right city.
          const localities = [...new Set(offices.map((o) => o.Name).filter(Boolean))];

          setCityOptions(localities);
          setCityIsCustom(false);
          setForm((prev) => ({
            ...prev,
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
  }, [form?.pincode, form?.country, pincodeTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePincodeChange = (e) => {
    setPincodeTouched(true);
    handleChange(e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await api.patch("/partner/profile", form);
      navigate("/partner/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong saving your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <p className="text-slate-400 text-sm">Loading...</p>;

  const canEdit = user?.role === "owner" || user?.permissions?.includes("profile:update");

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>

      {!profileComplete && (
        <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <UserCog size={16} className="shrink-0 mt-0.5" />
          <span>Your profile is incomplete. At minimum, add your business name below so SPOTX can move you toward verification.</span>
        </div>
      )}

      <Card className="p-6">
        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Business Name *" name="businessName" value={form.businessName} onChange={handleChange} disabled={!canEdit} />
          <Input label="Legal Name" name="legalName" value={form.legalName} onChange={handleChange} disabled={!canEdit} />

          <Select label="Entity Type" name="entityType" value={form.entityType} onChange={handleChange} disabled={!canEdit}>
            <option value="">Select entity type</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
          </Select>

          <Input label="Website" name="website" value={form.website} onChange={handleChange} disabled={!canEdit} />
          <Input label="Industry" name="industry" value={form.industry} onChange={handleChange} disabled={!canEdit} />
          <Input label="Contact Name" name="contactName" value={form.contactName} onChange={handleChange} disabled={!canEdit} />
          <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} disabled={!canEdit} />
          <Input label="Designation" name="designation" value={form.designation} onChange={handleChange} disabled={!canEdit} />

          <Select
            label="Country"
            name="country"
            value={form.country}
            onChange={(e) => {
              // Changing country invalidates the previously selected
              // state/province — it belongs to a different country's list.
              setForm((prev) => ({ ...prev, country: e.target.value, state: "" }));
              setCityIsCustom(false);
              setCityOptions([]);
              setPincodeStatus("");
            }}
            disabled={!canEdit}
          >
            {ALL_COUNTRIES.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
          </Select>

          {statesForCountry.length > 0 ? (
            <Select
              label="State / Province"
              name="state"
              value={form.state}
              onChange={(e) => { handleChange(e); setCityIsCustom(false); }}
              disabled={!canEdit}
            >
              <option value="">Select state</option>
              {statesForCountry.map((s) => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
            </Select>
          ) : (
            <Input label="State / Province" name="state" value={form.state} onChange={handleChange} disabled={!canEdit} />
          )}

          <div>
            {form.country === "India" && cityMenuOptions.length > 0 && !cityIsCustom ? (
              <Select label="City" name="city" value={form.city} onChange={(e) => {
                if (e.target.value === "__other__") {
                  setCityIsCustom(true);
                  setForm((prev) => ({ ...prev, city: "" }));
                } else {
                  handleChange(e);
                }
              }} disabled={!canEdit}>
                <option value="">Select city</option>
                {!cityMenuOptions.includes(form.city) && form.city && (
                  <option value={form.city}>{form.city}</option>
                )}
                {cityMenuOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__other__">Other (type manually)</option>
              </Select>
            ) : (
              <div>
                <Input label="City" name="city" value={form.city} onChange={handleChange} disabled={!canEdit} />
                {cityMenuOptions.length > 0 && canEdit && (
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

          <div>
            <div className="relative">
              <Input
                label={form.country === "India" ? "Pincode" : "Postal / ZIP Code"}
                name="pincode"
                value={form.pincode}
                onChange={handlePincodeChange}
                maxLength={form.country === "India" ? 6 : 12}
                placeholder={form.country === "India" ? "6-digit pincode" : "Postal / ZIP code"}
                disabled={!canEdit}
              />
              {pincodeStatus === "loading" && (
                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
              )}
            </div>
            {/* pincodeStatus only ever gets set on the India branch above */}
            {pincodeStatus === "found" && (
              <p className="text-xs text-green-600 mt-1">State and city detected from pincode.</p>
            )}
            {pincodeStatus === "not-found" && (
              <p className="text-xs text-amber-600 mt-1">Couldn't detect this pincode — enter state/city manually.</p>
            )}
          </div>

          <Input label="Address Line 1" name="addressLine1" value={form.addressLine1} onChange={handleChange} disabled={!canEdit} className="md:col-span-2" />
          <Input label="Address Line 2" name="addressLine2" value={form.addressLine2} onChange={handleChange} disabled={!canEdit} className="md:col-span-2" />

          {canEdit && (
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" loading={saving}>Save Changes</Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
