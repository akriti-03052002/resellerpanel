import { useState } from "react";
import Button from "./Button";

// In-app replacement for window.prompt()/window.confirm() — some embedding
// environments (e.g. this app's preview iframe) don't support native
// prompt()/alert()/confirm() dialogs at all, and a styled in-page modal is
// better UX regardless. Renders nothing until `open` is true; caller owns
// that state. Pass `hideInput` for a plain yes/no confirmation (no textarea) —
// onConfirm is then called with no argument.
export default function PromptModal({ open, title, message, placeholder, confirmLabel = "Confirm", requireValue = true, hideInput = false, error, onConfirm, onCancel }) {
  const [value, setValue] = useState("");

  if (!open) return null;

  const handleConfirm = () => {
    if (hideInput) {
      onConfirm();
      return;
    }
    if (requireValue && !value.trim()) return;
    onConfirm(value.trim());
    setValue("");
  };

  const handleCancel = () => {
    setValue("");
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={handleCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-slate-900 mb-1.5">{title}</p>
        {message && <p className="text-sm text-slate-500 mb-3">{message}</p>}
        {!hideInput && (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red"
          />
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!hideInput && requireValue && !value.trim()}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
