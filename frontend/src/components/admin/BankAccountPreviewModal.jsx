import { useEffect, useState } from "react";
import { X } from "lucide-react";
import adminApi from "../../services/adminApi";
import Button from "../ui/Button";

// Reveals full account number/IFSC (finance-role only, audit-logged server
// side) so an admin can actually check the entered details before deciding
// — mirrors DocumentPreviewModal's "preview, then decide" flow.
export default function BankAccountPreviewModal({ account, onClose, onVerify, onReject }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    adminApi.get(`/admin/bank/${account.id || account._id}/reveal`)
      .then((res) => { if (!cancelled) setDetails(res.data.data); })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || "Couldn't load bank details.");
      });

    return () => { cancelled = true; };
  }, [account]);

  const handleVerify = async () => {
    setBusy(true);
    try {
      await onVerify(account._id || account.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt("Reason for rejecting this bank account?");
    if (reason === null) return;
    setBusy(true);
    try {
      await onReject(account._id || account.id, reason);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <p className="text-sm font-semibold text-slate-900">Bank Account Details</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-brand-black" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-5">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && !details && <p className="text-sm text-slate-400">Loading...</p>}
          {details && (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-slate-400">Account Holder</dt>
                <dd className="text-sm font-medium text-slate-900">{details.accountHolderName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Bank Name</dt>
                <dd className="text-sm font-medium text-slate-900">{details.bankName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Account Number</dt>
                <dd className="text-sm font-mono font-medium text-slate-900">{details.accountNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">IFSC</dt>
                <dd className="text-sm font-mono font-medium text-slate-900">{details.ifsc}</dd>
              </div>
            </dl>
          )}
        </div>

        {account.verification?.status === "pending" && (onVerify || onReject) && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
            <Button variant="danger" onClick={handleReject} loading={busy}>Reject</Button>
            <Button onClick={handleVerify} loading={busy}>Verify</Button>
          </div>
        )}
      </div>
    </div>
  );
}
