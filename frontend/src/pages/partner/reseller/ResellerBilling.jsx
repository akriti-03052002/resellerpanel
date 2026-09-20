import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../services/api";
import Card from "../../../components/ui/Card";
import Table from "../../../components/ui/Table";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { waitForRazorpay } from "../../../utils/razorpayCheckout";

export default function ResellerBilling() {
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["reseller", "invoices"],
    queryFn: () => api.get("/partner/reseller/invoices").then((res) => res.data.data)
  });
  const { data: estimate = null, isLoading: estimateLoading } = useQuery({
    queryKey: ["reseller", "invoices", "current-due"],
    queryFn: () => api.get("/partner/reseller/invoices/current-due").then((res) => res.data.data)
  });

  const loading = invoicesLoading || estimateLoading;

  const load = () => {
    queryClient.invalidateQueries({ queryKey: ["reseller", "invoices"] });
  };

  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [breakdownFor, setBreakdownFor] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  // The estimate already carries full per-order line items (see
  // estimateCurrentDue) — but list rows/the current-invoice summary don't,
  // so fetch the single-invoice endpoint (which reconstructs the same
  // detail from the underlying purchase orders) before opening the modal.
  const openInvoiceBreakdown = async (invoiceId) => {
    setBreakdownLoading(true);
    try {
      const res = await api.get(`/partner/reseller/invoices/${invoiceId}`);
      setBreakdownFor(res.data.data);
    } finally {
      setBreakdownLoading(false);
    }
  };

  // Razorpay's own payment-lookup can lag a signature that already proved
  // success by a few minutes (see verifyInvoicePayment) — poll in the
  // background instead of leaving the partner stuck on a scary error, and
  // stop as soon as this invoice shows paid or the window runs out.
  const pollUntilPaid = (invoiceId) => {
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        clearInterval(interval);
        return;
      }
      const res = await api.get("/partner/reseller/invoices");
      queryClient.setQueryData(["reseller", "invoices"], res.data.data);
      const updated = res.data.data.find((i) => i._id === invoiceId);
      if (updated?.paymentStatus === "paid") {
        clearInterval(interval);
        setInfo("");
      }
    }, 20000);
  };

  const [requestingOnline, setRequestingOnline] = useState(false);

  const requestOnline = async (invoice) => {
    setError("");
    setRequestingOnline(true);
    try {
      await api.post(`/partner/reseller/invoices/${invoice._id}/request-online`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong sending this request.");
    } finally {
      setRequestingOnline(false);
    }
  };

  const handlePay = async (invoice) => {
    setError("");
    setPayingId(invoice._id);

    try {
      const res = await api.post(`/partner/reseller/invoices/${invoice._id}/pay`, {});
      const { razorpayOrderId, amount, currency, keyId } = res.data.data;

      const Razorpay = await waitForRazorpay();

      const rzp = new Razorpay({
        key: keyId,
        amount,
        currency,
        name: "SPOTX",
        description: `Invoice ${invoice.invoiceNumber}`,
        order_id: razorpayOrderId,
        theme: { color: "#E11D2E" },
        config: {
          display: {
            blocks: {
              upi: { name: "Pay via UPI", instruments: [{ method: "upi" }] },
              other: {
                name: "Other payment modes",
                instruments: [{ method: "card" }, { method: "netbanking" }, { method: "wallet" }]
              }
            },
            sequence: ["block.upi", "block.other"],
            preferences: { show_default_blocks: false }
          }
        },
        modal: { ondismiss: () => setPayingId(null) },
        handler: async (response) => {
          try {
            const verifyRes = await api.post(`/partner/reseller/invoices/${invoice._id}/verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            if (verifyRes.data.pending) {
              setInfo(verifyRes.data.message);
              pollUntilPaid(invoice._id);
            } else {
              setInfo("");
            }
            load();
          } catch (err) {
            setError(err.response?.data?.message || "We couldn't confirm your payment. If any amount was debited, contact support with your payment ID.");
          } finally {
            setPayingId(null);
          }
        }
      });

      rzp.on("payment.failed", () => {
        setError("Payment failed. You can try again.");
        setPayingId(null);
      });

      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong starting the payment.");
      setPayingId(null);
    }
  };

  const current = invoices.find((i) => i.paymentStatus !== "paid");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Billing</h1>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {info && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">{info}</div>}

      {current && (
        <Card className="p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Current Invoice</p>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-lg font-bold text-slate-900">{current.invoiceNumber}</p>
              <p className="text-sm text-slate-500">
                {new Date(current.billingPeriodStart).toLocaleDateString()} – {new Date(current.billingPeriodEnd).toLocaleDateString()} · {current.billingCycle}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {current.purchasedLicenseSnapshot} purchased licenses{current.proratedLicenseCount > 0 && ` + ${current.proratedLicenseCount} added mid-cycle`} — see full breakdown for per-batch pricing
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">₹{current.total.toLocaleString("en-IN")}</p>
              <Badge status={current.paymentStatus} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-400">Due {new Date(current.dueDate).toLocaleDateString()}</p>
              <button type="button" disabled={breakdownLoading} onClick={() => openInvoiceBreakdown(current._id)} className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50">
                View full breakdown
              </button>
            </div>

            {current.canPayNow ? (
              <Button loading={payingId === current._id} onClick={() => handlePay(current)}>Pay Now</Button>
            ) : current.paymentMode === "online" ? (
              <p className="text-xs text-slate-400">Online payment opens {new Date(current.paymentWindowOpensAt).toLocaleDateString()}</p>
            ) : current.onlineRequested ? (
              <p className="text-xs text-amber-600 font-medium">Online payment requested — awaiting SPOTX</p>
            ) : (
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">SPOTX will collect this payment offline</p>
                <button type="button" disabled={requestingOnline} onClick={() => requestOnline(current)} className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50">
                  Request to pay online instead
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {!current && estimate && (
        <Card className="p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Amount Due This Cycle</p>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-slate-500">
                {new Date(estimate.billingPeriodStart).toLocaleDateString()} – {new Date(estimate.billingPeriodEnd).toLocaleDateString()} · {estimate.billingCycle}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {estimate.purchasedLicenseSnapshot} purchased licenses from earlier cycles (₹{estimate.baseAmount.toFixed(2)})
                {estimate.proratedLicenseCount > 0 && ` + ${estimate.proratedLicenseCount} added mid-cycle (₹${estimate.proratedAmount.toFixed(2)})`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">₹{estimate.total.toLocaleString("en-IN")}</p>
              <Badge tone="neutral">not yet invoiced</Badge>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              This is a running estimate — SPOTX will generate your invoice for this amount at the end of the cycle,
              due {new Date(estimate.dueDate).toLocaleDateString()}.
            </p>
            <button type="button" onClick={() => setBreakdownFor(estimate)} className="text-xs font-semibold text-brand-red hover:underline whitespace-nowrap ml-4">
              View full breakdown
            </button>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Invoice History</p>
        </div>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No invoices yet."
            rows={invoices}
            columns={[
              { key: "number", header: "Invoice", render: (i) => i.invoiceNumber },
              { key: "period", header: "Period", render: (i) => `${new Date(i.billingPeriodStart).toLocaleDateString()} – ${new Date(i.billingPeriodEnd).toLocaleDateString()}` },
              { key: "licenses", header: "Purchased Licenses", render: (i) => i.purchasedLicenseSnapshot + (i.proratedLicenseCount || 0) },
              { key: "total", header: "Total", render: (i) => `₹${i.total.toLocaleString("en-IN")}` },
              { key: "status", header: "Status", render: (i) => <Badge status={i.paymentStatus} /> },
              { key: "due", header: "Due", render: (i) => new Date(i.dueDate).toLocaleDateString() },
              { key: "txn", header: "Transaction ID", render: (i) => i.razorpay?.paymentId || "—" },
              {
                key: "details",
                header: "",
                render: (i) => (
                  <button type="button" disabled={breakdownLoading} onClick={() => openInvoiceBreakdown(i._id)} className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50">
                    View details
                  </button>
                )
              }
            ]}
          />
        )}
      </Card>

      {breakdownFor && <BillingBreakdownModal data={breakdownFor} onClose={() => setBreakdownFor(null)} />}
    </div>
  );
}

// Shared by the current invoice, the running estimate, and any row in
// Invoice History — all three share the same field names (see
// resellerBilling.js's generateInvoiceForPartner / estimateCurrentDue /
// getInvoiceLineItems), so one modal covers "what would I owe" and "what
// did I pay" alike, right down to which individual purchase order
// contributed what.
const CYCLE_LABEL = { 1: "monthly", 3: "quarterly", 12: "yearly" };

function BillingBreakdownModal({ data, onClose }) {
  const baseAmount = data.baseAmount ?? data.purchasedLicenseSnapshot * data.unitPriceSnapshot * data.cycleMultiplier;
  const cycleLabel = CYCLE_LABEL[data.cycleMultiplier] || data.billingCycle;

  const pricingLine = (() => {
    if (data.pricingModeSnapshot === "fixed_price" && data.fixedUnitPriceSnapshot != null) {
      return `Fixed price of ₹${data.fixedUnitPriceSnapshot}/screen`;
    }
    if (data.pricingModeSnapshot === "discount_percent" && data.wholesaleDiscountPercentSnapshot != null) {
      return `${data.wholesaleDiscountPercentSnapshot}% discount off ₹${data.standardUnitPriceSnapshot}/screen standard rate`;
    }
    return null;
  })();

  const baseLineItems = data.baseLineItems || [];
  const proratedLineItems = data.proratedLineItems || [];

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-slate-900">{data.invoiceNumber || "Amount Due — Full Breakdown"}</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>
        <p className="text-xs text-slate-400 mb-1">
          {new Date(data.billingPeriodStart).toLocaleDateString()} – {new Date(data.billingPeriodEnd).toLocaleDateString()}
        </p>
        <p className="text-xs mb-4">
          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold uppercase tracking-wide">
            {cycleLabel} billing
          </span>
        </p>

        {/* Base licenses — purchased before this cycle. Each batch is billed
            at the rate it locked in when IT was bought, not today's rate —
            a later price change only applies to licenses bought after that
            change, so different batches here can show different rates. */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Licenses from earlier cycles ({data.purchasedLicenseSnapshot})
          </p>
          {baseLineItems.length > 0 && (
            <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 mb-2">
              {baseLineItems.map((item) => (
                <div key={item.orderCode} className="flex items-center justify-between px-3 py-1.5 text-xs gap-3">
                  <span className="text-slate-500">
                    {item.orderCode} · {item.quantity} licenses · {item.purchaseDate ? `purchased ${new Date(item.purchaseDate).toLocaleDateString()}` : "no linked order"}
                    <br />
                    ₹{item.unitPrice}/screen/month × {item.quantity} × {item.cycleMultiplier} month{item.cycleMultiplier === 1 ? "" : "s"}
                  </span>
                  <span className="text-slate-900 font-medium whitespace-nowrap">₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-sm font-medium">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-900">₹{baseAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Mid-cycle additions — billed immediately at the full cycle rate, same as base licenses, never a days-remaining fraction */}
        {proratedLineItems.length > 0 && (
          <div className="mb-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Added mid-cycle ({data.proratedLicenseCount} licenses, billed at the full {cycleLabel} rate — no day proration)
            </p>
            <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 mb-2">
              {proratedLineItems.map((item) => (
                <div key={item.orderCode} className="flex items-center justify-between px-3 py-1.5 text-xs gap-3">
                  <span className="text-slate-500">
                    {item.orderCode} · {item.quantity} licenses · added {new Date(item.purchaseDate).toLocaleDateString()}
                    <br />
                    ₹{item.unitPrice}/screen/month × {item.quantity} × {item.cycleMultiplier} month{item.cycleMultiplier === 1 ? "" : "s"}
                  </span>
                  <span className="text-slate-900 font-medium whitespace-nowrap">₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-900">₹{data.proratedAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm pt-3 border-t border-slate-200">
          <div className="flex justify-between font-semibold">
            <span className="text-slate-700">Subtotal</span>
            <span className="text-slate-900">₹{data.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
          {/* GST split into CGST + SGST (each half the total rate) — the
              standard Indian intra-state GST invoice format. */}
          <div className="flex justify-between">
            <span className="text-slate-500">CGST ({(data.taxRatePercent / 2).toFixed(1)}%)</span>
            <span className="text-slate-900 font-medium">₹{(data.taxAmount / 2).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">SGST ({(data.taxRatePercent / 2).toFixed(1)}%)</span>
            <span className="text-slate-900 font-medium">₹{(data.taxAmount / 2).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Total GST ({data.taxRatePercent}%)</span>
            <span>₹{data.taxAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200 text-base font-bold">
            <span className="text-slate-900">Total</span>
            <span className="text-slate-900">₹{data.total.toLocaleString("en-IN")}</span>
          </div>

          <div className="flex justify-between pt-3 border-t border-slate-100">
            <span className="text-slate-500">Due date</span>
            <span className="text-slate-900 font-medium">{new Date(data.dueDate).toLocaleDateString()}</span>
          </div>
          {data.paymentStatus && (
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <Badge status={data.paymentStatus} />
            </div>
          )}
          {data.razorpay?.paymentId && (
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction ID</span>
              <span className="text-slate-900 font-medium">{data.razorpay.paymentId}</span>
            </div>
          )}
        </div>

        {pricingLine && <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">{pricingLine}</p>}
      </div>
    </div>
  );
}
