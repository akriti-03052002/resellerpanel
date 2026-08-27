export function Input({ label, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <input
        className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
        {...props}
      />
      {error && <p className="text-xs text-brand-red mt-1">{error}</p>}
    </div>
  );
}

export function Select({ label, className = "", children, ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <select
        className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition bg-white"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
