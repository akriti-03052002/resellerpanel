const VARIANTS = {
  primary: "bg-brand-black text-white hover:bg-charcoal",
  danger: "bg-brand-red text-white hover:opacity-90",
  outline: "border border-slate-200 text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100"
};

export default function Button({ variant = "primary", loading = false, className = "", children, disabled, ...props }) {
  return (
    <button
      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
