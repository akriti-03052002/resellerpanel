import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Password input with a show/hide toggle. Plain register-based field —
// length/match validation lives in the parent's zod schema, this just
// renders the value + error it's handed.
export default function PasswordField({ register, name, label, placeholder, error }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition pr-11"
          {...register(name)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error && <p className="text-xs text-brand-red mt-1.5">{error.message}</p>}
    </div>
  );
}
