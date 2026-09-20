import { useEffect, useState } from "react";
import { X } from "lucide-react";
import adminApi from "../../services/adminApi";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import PromptModal from "../ui/PromptModal";

// Reveals full account number/IFSC (finance-role only, audit-logged server
// side) so an admin can actually check the entered details before deciding
// — mirrors DocumentPreviewModal's "preview, then decide" flow.
export default function BankAccountPreviewModal({ account, onClose, onVerify, onReject }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [promptMode, setPromptMode] = useState(null); // "override" | "reject" | null

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

  const razorpayCheck = account.razorpayCheck;
  const razorpayPassed = razorpayCheck?.paymentStatus === "captured" && razorpayCheck?.nameMatchStatus === "matched";

  const submitVerify = async (overrideReason) => {
    setBusy(true);
    try {
      await onVerify(account._id || account.id, overrideReason);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = () => {
    if (!razorpayPassed) {
      setPromptMode("override");
      return;
    }
    submitVerify();
  };

  const handleReject = () => {
    setPromptMode("reject");
  };

  const submitReject = async (reason) => {
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

          {razorpayCheck && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Automated Razorpay check</p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge status={razorpayCheck.paymentStatus || "not_initiated"}>
                  Payment: {(razorpayCheck.paymentStatus || "not_initiated").replace(/_/g, " ")}
                </Badge>
                <Badge status={razorpayCheck.nameMatchStatus === "matched" ? "verified" : razorpayCheck.nameMatchStatus === "mismatched" ? "rejected" : "not_submitted"}>
                  Bank match: {(razorpayCheck.nameMatchStatus || "not_checked").replace(/_/g, " ")}
                </Badge>
              </div>
              {razorpayCheck.method && (
                <p className="text-xs text-slate-500">
                  Paid via <span className="font-medium text-slate-700">{razorpayCheck.method}</span>
                  {razorpayCheck.matchedBankName && <> — Razorpay recorded <span className="font-medium text-slate-700">{razorpayCheck.matchedBankName}</span></>}
                </p>
              )}
              {razorpayCheck.failureReason && (
                <p className="text-xs text-slate-500 mt-1">{razorpayCheck.failureReason}</p>
              )}
              {!razorpayPassed && (
                <p className="text-xs text-amber-700 mt-1.5">Verifying without a passed check requires an override reason.</p>
              )}
            </div>
          )}
        </div>

        {account.verification?.status === "pending" && (onVerify || onReject) && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
            <Button variant="danger" onClick={handleReject} loading={busy}>Reject</Button>
            <Button onClick={handleVerify} loading={busy}>Verify</Button>
          </div>
        )}
      </div>

      <PromptModal
        open={promptMode === "override"}
        title="Verify despite a failed Razorpay check?"
        message="The Razorpay bank check hasn't passed (payment not captured, or the name doesn't match). Enter a reason to verify anyway."
        placeholder="Reason for overriding the check..."
        confirmLabel="Verify Anyway"
        onConfirm={(reason) => { setPromptMode(null); submitVerify(reason); }}
        onCancel={() => setPromptMode(null)}
      />

      <PromptModal
        open={promptMode === "reject"}
        title="Reject this bank account?"
        placeholder="Reason for rejecting..."
        confirmLabel="Reject"
        onConfirm={(reason) => { setPromptMode(null); submitReject(reason); }}
        onCancel={() => setPromptMode(null)}
      />
    </div>
  );
}
