import { useState } from "react";
import { Controller } from "react-hook-form";
import { COUNTRY_CODES } from "../../data/countryCodes";

const phoneDialLabel = (c) => `${c.name} (${c.dial})`;

// Composite dial-code + number field. Backed by a single "phone" form
// value (e.g. "+91 98765 43210") via react-hook-form's Controller, since
// react-hook-form only tracks one field but the UI needs two inputs.
export default function PhoneInput({ control, name = "phone", error }) {
  const [phoneDial, setPhoneDial] = useState("+91");
  const [phoneDialInput, setPhoneDialInput] = useState(phoneDialLabel(COUNTRY_CODES[0]));
  const [phoneNumber, setPhoneNumber] = useState("");

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange } }) => {
        // A datalist-backed input: clicking it (with nothing typed) shows
        // the full list to pick from, typing filters it live by name or
        // dial code — either way of choosing lands here once the
        // typed/picked text matches an exact option.
        const handlePhoneDialInputChange = (e) => {
          const label = e.target.value;
          setPhoneDialInput(label);

          const match = COUNTRY_CODES.find((c) => phoneDialLabel(c) === label);
          if (!match) return;

          setPhoneDial(match.dial);
          onChange(phoneNumber ? `${match.dial} ${phoneNumber}` : "");
        };

        const handlePhoneNumberChange = (e) => {
          const num = e.target.value.replace(/[^\d\s]/g, "");
          setPhoneNumber(num);
          onChange(num ? `${phoneDial} ${num}` : "");
        };

        return (
          <div>
            <label className="block text-sm font-medium mb-2">Phone *</label>

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
              />
            </div>

            {error && <p className="text-xs text-brand-red mt-1.5">{error.message}</p>}
          </div>
        );
      }}
    />
  );
}
