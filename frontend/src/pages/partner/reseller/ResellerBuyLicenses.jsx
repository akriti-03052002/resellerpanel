import { useEffect, useState } from "react";
import api from "../../../services/api";
import Card from "../../../components/ui/Card";
import Table from "../../../components/ui/Table";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { waitForRazorpay } from "../../../utils/razorpayCheckout";

const ORDER_STATUS_COPY = {
  requested: "Waiting for SPOTX to review your request.",
  rejected: "This request was declined.",
  completed: "Accepted. Licenses added to your inventory — the cost will appear on your next billing-cycle invoice."
};

/* ============================================================
   BUY SOFTWARE LICENSES
   Requesting a quantity here does NOT charge anything — it's a
   request SPOTX reviews and accepts or rejects. Once accepted, the
   licenses are credited immediately and their cost rolls into your
   regular billing-cycle invoice — there's no separate payment step
   per order here. See backend/models/ScreenLicensePurchaseOrder.js's
   orderStatus comment for the full lifecycle. Quantity is the only
   thing this page ever sends the server on request — every price
   figure shown here is echoed back from the server's own computation.
============================================================ */
export default function ResellerBuyLicenses() {
  const [orders, setOrders] = useState([]);
  const [prepayment, setPrepayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [payingPrepayment, setPayingPrepayment] = useState(false);

  const load = () => {
    Promise.all([
      api.get("/partner/reseller/license-orders").then((res) => setOrders(res.data.data)),
      api.get("/partner/reseller/prepayment").then((res) => setPrepayment(res.data.data))
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Razorpay's own payment-lookup can lag a signature that already proved
  // success by a few minutes (see verifyPrepaymentPayment) — poll in the
  // background instead of leaving the partner stuck on a scary error.
  const pollUntilDone = () => {
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        clearInterval(interval);
        return;
      }
      const res = await api.get("/partner/reseller/prepayment");
      setPrepayment(res.data.data);
      if (res.data.data?.status === "done") {
        clearInterval(interval);
        setInfo("");
      }
    }, 20000);
  };

  const payPrepayment = async () => {
    setError("");
    setPayingPrepayment(true);

    try {
      const res = await api.post("/partner/reseller/prepayment/pay");
      const { razorpayOrderId, amount, currency, keyId } = res.data.data;

      const Razorpay = await waitForRazorpay();

      const rzp = new Razorpay({
        key: keyId,
        amount,
        currency,
        name: "SPOTX",
        description: "One-time reseller prepayment",
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
        modal: { ondismiss: () => setPayingPrepayment(false) },
        handler: async (response) => {
          try {
            const verifyRes = await api.post("/partner/reseller/prepayment/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            if (verifyRes.data.pending) {
              setInfo(verifyRes.data.message);
              pollUntilDone();
            } else {
              setInfo("");
            }
            load();
          } catch (err) {
            setError(err.response?.data?.message || "We couldn't confirm your payment. If any amount was debited, contact support with your payment ID.");
          } finally {
            setPayingPrepayment(false);
          }
        }
      });

      rzp.on("payment.failed", () => {
        setError("Payment failed. You can try again.");
        setPayingPrepayment(false);
      });

      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong starting the payment.");
      setPayingPrepayment(false);
    }
  };

  const handleRequest = async () => {
    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1) {
      setError("Enter a valid quantity.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await api.post("/partner/reseller/license-orders", { quantity: qty });
      setQuantity("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong submitting the request.");
    } finally {
      setSubmitting(false);
    }
  };

  const prepaymentDone = prepayment?.status === "done";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Buy Software Licenses</h1>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {info && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">{info}</div>}

      {!loading && !prepaymentDone && (
        <Card className="p-6 max-w-lg">
          <p className="text-sm font-semibold text-slate-900 mb-1">One-time prepayment required</p>
          {prepayment?.status === "awaiting_payment" ? (
            <>
              <p className="text-sm text-slate-500 mb-4">
                Pay your one-time prepayment of <strong className="text-slate-900">₹{prepayment.amount?.toLocaleString("en-IN")}</strong> to
                unlock buying licenses. This is a single one-time payment — not a recurring charge.
              </p>
              <Button onClick={payPrepayment} loading={payingPrepayment}>Pay ₹{prepayment.amount?.toLocaleString("en-IN")}</Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              SPOTX needs to set up your one-time prepayment before you can buy licenses. Contact SPOTX to get started.
            </p>
          )}
        </Card>
      )}

      {prepaymentDone && (
        <Card className="p-6 max-w-lg">
          <Input
            label="Quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 500"
          />

          <p className="text-xs text-slate-400 mt-4">
            This submits a request to SPOTX — nothing is charged yet. Once accepted, the licenses are added to your
            inventory immediately and billed on your next regular billing-cycle invoice.
          </p>

          <Button className="mt-4 w-full" onClick={handleRequest} loading={submitting}>Request Licenses</Button>
        </Card>
      )}

      <Card>
        <div className="p-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Purchase Orders</p>
        </div>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No purchase orders yet."
            rows={orders}
            columns={[
              { key: "code", header: "Order", render: (o) => o.orderCode || o._id.slice(-8) },
              { key: "quantity", header: "Quantity", render: (o) => o.quantity },
              { key: "unitPrice", header: "Price / license", render: (o) => `₹${o.pricing.unitPrice}` },
              { key: "total", header: "Total", render: (o) => `₹${o.pricing.totalAmount.toLocaleString("en-IN")}` },
              {
                key: "status",
                header: "Status",
                render: (o) => (
                  <div className="flex flex-col gap-1 items-start">
                    <Badge status={o.orderStatus}>{o.orderStatus.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-slate-400">{ORDER_STATUS_COPY[o.orderStatus]}</span>
                    {o.orderStatus === "rejected" && o.approval?.rejectionReason && (
                      <span className="text-xs text-red-600">{o.approval.rejectionReason}</span>
                    )}
                  </div>
                )
              },
              { key: "date", header: "Date", render: (o) => new Date(o.createdAt).toLocaleDateString() }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
