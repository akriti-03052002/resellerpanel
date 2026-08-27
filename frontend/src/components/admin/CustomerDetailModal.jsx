import { X } from "lucide-react";
import Badge from "../ui/Badge";

const formatAddress = (address) => {
  if (!address) return "—";
  const { addressLine1, addressLine2, city, state, pincode, country } = address;
  const parts = [addressLine1, addressLine2, city, state, pincode, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
};

export default function CustomerDetailModal({ customer, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <p className="text-sm font-semibold text-slate-900">{customer.companyName}</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-brand-black" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-5">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-400">Vendor</dt>
              <dd className="text-sm font-medium text-slate-900">{customer.partnerId?.legalEntity?.businessName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Contact Name</dt>
              <dd className="text-sm font-medium text-slate-900">{customer.contactName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Email</dt>
              <dd className="text-sm font-medium text-slate-900">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Phone</dt>
              <dd className="text-sm font-medium text-slate-900">{customer.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Address</dt>
              <dd className="text-sm font-medium text-slate-900">{formatAddress(customer.address)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Subscription</dt>
              <dd className="mt-1">
                {customer.subscription.status === "trial" && customer.trialExpired
                  ? <Badge tone="danger">Trial expired</Badge>
                  : <Badge status={customer.subscription.status} />}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Screens</dt>
              <dd className="text-sm font-medium text-slate-900">{customer.subscription.screenCount || 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Registered</dt>
              <dd className="text-sm font-medium text-slate-900">{new Date(customer.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
