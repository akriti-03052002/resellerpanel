const TONES = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700"
};

const STATUS_TONE = {
  active: "success", verified: "success", won: "success", paid: "success", approved: "success", settled: "success", captured: "success",
  pending: "warning", pending_verification: "warning", under_review: "warning", invited: "warning", draft: "neutral", on_hold: "warning", authorized: "warning",
  suspended: "danger", rejected: "danger", lost: "danger", blocked: "danger", cancelled: "danger", failed: "danger", expired: "danger", refunded: "danger",
  not_submitted: "neutral", inactive: "neutral", new: "info", qualified: "info", processing: "info", trial: "info",
  completed: "success", requested: "info", awaiting_payment: "warning", awaiting_offline_reference: "warning",
  offline_reference_submitted: "info", payment_failed: "danger"
};

export default function Badge({ status, children, tone }) {
  const resolvedTone = tone || STATUS_TONE[status] || "neutral";

  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${TONES[resolvedTone]}`}>
      {children || String(status || "").replace(/_/g, " ")}
    </span>
  );
}
