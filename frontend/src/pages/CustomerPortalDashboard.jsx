import { useQuery } from "@tanstack/react-query";
import customerPortalApi from "../services/customerPortalApi";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

// Minimal, read-only — this customer can see their own company info,
// which reseller they're with, and their current screen counts. Nothing
// editable, no payment/price info anywhere (see
// backend/controller/publicResellerCustomerController.js).
export default function CustomerPortalDashboard() {
  const { data, isError } = useQuery({
    queryKey: ["customerPortal", "me"],
    queryFn: () => customerPortalApi.get("/customer-portal/me").then((res) => res.data.data)
  });
  const error = isError ? "Something went wrong loading your account." : "";

  return (
    <div className="max-w-2xl space-y-6">
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {!data && !error && <p className="text-slate-400 text-sm">Loading...</p>}

      {data && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{data.companyName}</h1>
            <p className="text-sm text-slate-500 mt-1">With {data.resellerName}</p>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-900">Account Status</p>
              <Badge status={data.status} />
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Contact</dt><dd className="font-medium text-slate-900">{data.contactName || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-medium text-slate-900">{data.email}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="font-medium text-slate-900">{data.phone || "—"}</dd></div>
            </dl>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold text-slate-900 mb-4">Your Screens</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-slate-900">{data.screens.allocated}</p>
                <p className="text-xs text-slate-500 mt-1">Allocated</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-brand-red">{data.screens.active}</p>
                <p className="text-xs text-slate-500 mt-1">Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{data.screens.suspended}</p>
                <p className="text-xs text-slate-500 mt-1">Suspended</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">
              Questions about your screens or billing? Contact {data.resellerName} directly.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
