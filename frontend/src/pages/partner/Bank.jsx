import { useEffect, useState } from "react";
import { AlertCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { waitForRazorpay } from "../../utils/razorpayCheckout";

const EMPTY_FORM = { accountHolderName: "", bankName: "", accountNumber: "", ifsc: "", accountType: "current" };

export default function Bank() {
  const [account, setAccount] = useState(null);
  const [chequeDoc, setChequeDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  // The cancelled cheque is uploaded once from the Documents page (like
  // every other KYC document) — this just picks up the latest one on file
  // and references it, rather than re-uploading a copy from here.
  const load = () =>
    Promise.all([
      api.get("/partner/bank").then((res) => {
        setAccount(res.data.data);
        if (!res.data.data) setEditing(true);
      }),
      api.get("/partner/documents").then((res) => {
        const latestCheque = res.data.data
          .filter((d) => d.documentType === "cancelled_cheque")
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
        setChequeDoc(latestCheque);
      })
    ]).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await api.put("/partner/bank", { ...form, cancelledChequeDocumentId: chequeDoc?._id });
      setForm(EMPTY_FORM);
      setEditing(false);
      toast.success(res.data.message || "Bank account saved.");
      load();
    } catch (err) {
      const message = err.response?.data?.message || "Something went wrong saving the bank account.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Opens the Razorpay Checkout popup (test mode during dev) against a
  // server-created ₹1 order, then hands the result to /verify/confirm.
  // Nothing here is trusted on its own — the backend independently
  // re-verifies the signature and re-fetches the payment from Razorpay
  // before recording anything (mirrors the customer subscription checkout
  // in pages/customer/Subscription.jsx).
  const startVerification = async () => {
    setVerifyError("");
    setVerifying(true);
    try {
      const res = await api.post("/partner/bank/verify");
      const order = res.data.data;
      const Razorpay = await waitForRazorpay();

      const rzp = new Razorpay({
        key: order.keyId,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: "SPOTX",
        description: "₹1 bank account verification",
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#E11D2E" },
        modal: {
          ondismiss: () => setVerifying(false)
        },
        handler: async (response) => {
          try {
            await api.post("/partner/bank/verify/confirm", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            await load();
          } catch (err) {
            setVerifyError(err.response?.data?.message || "We couldn't confirm your verification payment. If any amount was debited, contact support with your payment ID.");
          } finally {
            setVerifying(false);
          }
        }
      });

      rzp.on("payment.failed", (response) => {
        setVerifying(false);
        setVerifyError(`Payment failed: ${response.error.description || "please try again."}`);
        api.post("/partner/bank/verify/failure", {
          code: response.error.code,
          description: response.error.description
        }).catch(() => {});
      });

      rzp.open();
    } catch (err) {
      setVerifyError(err.response?.data?.message || "Couldn't start bank verification.");
      setVerifying(false);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Bank Account</h1>
      <p className="text-sm text-slate-500 -mt-4">
        Only the partner owner can view or manage this. SPOTX verifies your account before settling any payout to it.
      </p>

      {!editing && account && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Badge status={account.verification.status} />
            <Button variant="outline" onClick={() => setEditing(true)} disabled={Boolean(account.pendingChange)}>
              {account.pendingChange ? "Change Pending Review" : "Update"}
            </Button>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Account Holder</dt><dd className="font-medium">{account.accountHolderName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Bank</dt><dd className="font-medium">{account.bankName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Account Number</dt><dd className="font-medium">•••• {account.accountNumberLast4}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">IFSC</dt><dd className="font-medium">{account.ifscMasked}</dd></div>
          </dl>

          {account.pendingChange && (
            <div className="mt-5 p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-blue-700 shrink-0" />
                <p className="text-sm font-semibold text-blue-900">A change to your bank details is pending admin review</p>
              </div>
              <p className="text-xs text-blue-700 mb-3">
                Your account above is still active for payouts. These proposed details will only take effect once an admin approves them.
              </p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Account Holder</dt><dd className="font-medium">{account.pendingChange.accountHolderName}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Bank</dt><dd className="font-medium">{account.pendingChange.bankName}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Account Number</dt><dd className="font-medium">•••• {account.pendingChange.accountNumberLast4}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">IFSC</dt><dd className="font-medium">{account.pendingChange.ifscMasked}</dd></div>
              </dl>

              {account.pendingChange.razorpayCheck?.paymentStatus === "not_initiated" && (
                <div className="mt-4 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-700 mb-2">Complete a ₹1 verification payment for this pending change before it can be approved.</p>
                  {verifyError && <p className="text-xs text-red-600 mb-2">{verifyError}</p>}
                  <Button onClick={startVerification} loading={verifying}>Pay ₹1 to Verify Pending Change</Button>
                </div>
              )}

              {account.pendingChange.razorpayCheck?.paymentStatus && account.pendingChange.razorpayCheck.paymentStatus !== "not_initiated" && (
                <div className="mt-4 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-blue-900">Automated bank check (pending change)</p>
                    <Button variant="outline" onClick={startVerification} loading={verifying}>Re-run Check</Button>
                  </div>
                  {verifyError && <p className="text-xs text-red-600 mb-2">{verifyError}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge status={account.pendingChange.razorpayCheck?.paymentStatus || "not_initiated"}>
                      Payment: {(account.pendingChange.razorpayCheck?.paymentStatus || "not_initiated").replace(/_/g, " ")}
                    </Badge>
                    <Badge status={account.pendingChange.razorpayCheck?.nameMatchStatus === "matched" ? "verified" : account.pendingChange.razorpayCheck?.nameMatchStatus === "mismatched" ? "rejected" : "not_submitted"}>
                      Bank match: {(account.pendingChange.razorpayCheck?.nameMatchStatus || "not_checked").replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {account.verification.status === "rejected" && account.verification.rejectionReason && (
            <div className="flex items-start gap-2 mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{account.verification.rejectionReason}</span>
            </div>
          )}

          {!account.pendingChange && account.verification.status !== "verified" && account.razorpayCheck?.paymentStatus === "not_initiated" && (
            <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm font-semibold text-amber-900">Your bank details have been saved — one step left</p>
              <p className="text-xs text-amber-700 mt-1 mb-3">
                Complete a ₹1 verification payment via Razorpay (test mode) now to confirm this account is really yours. SPOTX will do a final review once it's captured.
              </p>
              {verifyError && <p className="text-xs text-red-600 mb-3">{verifyError}</p>}
              <Button onClick={startVerification} loading={verifying}>Pay ₹1 to Verify Bank Account</Button>
            </div>
          )}

          {!account.pendingChange && account.verification.status !== "verified" && account.razorpayCheck?.paymentStatus !== "not_initiated" && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">Automated bank check</p>
                <Button variant="outline" onClick={startVerification} loading={verifying}>Re-run Check</Button>
              </div>

              {verifyError && <p className="text-xs text-red-600 mb-3">{verifyError}</p>}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge status={account.razorpayCheck?.paymentStatus || "not_initiated"}>
                  Payment: {(account.razorpayCheck?.paymentStatus || "not_initiated").replace(/_/g, " ")}
                </Badge>
                <Badge status={account.razorpayCheck?.nameMatchStatus === "matched" ? "verified" : account.razorpayCheck?.nameMatchStatus === "mismatched" ? "rejected" : "not_submitted"}>
                  Bank match: {(account.razorpayCheck?.nameMatchStatus || "not_checked").replace(/_/g, " ")}
                </Badge>
              </div>

              {account.razorpayCheck?.nameMatchStatus === "mismatched" && (
                <p className="text-xs text-red-600 mt-2">
                  Razorpay recorded this payment via <strong>{account.razorpayCheck.matchedBankName}</strong> netbanking, which doesn't match the bank you entered (<strong>{account.bankName}</strong>). Update your details above if that's wrong.
                </p>
              )}

              {account.razorpayCheck?.nameMatchStatus === "unverifiable" && (
                <p className="text-xs text-amber-600 mt-2">
                  Your payment was captured, but automatic bank matching only works for netbanking payments (yours used {account.razorpayCheck.method || "another method"}) — an admin will verify this manually.
                </p>
              )}

              {account.razorpayCheck?.paymentStatus === "failed" && account.razorpayCheck?.failureReason && (
                <p className="text-xs text-red-600 mt-2">{account.razorpayCheck.failureReason}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {editing && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Account Holder Name" name="accountHolderName" value={form.accountHolderName} onChange={handleChange} required />
            <Input label="Bank Name" name="bankName" value={form.bankName} onChange={handleChange} required />
            <Input label="Account Number" name="accountNumber" value={form.accountNumber} onChange={handleChange} required />
            <Input label="IFSC Code" name="ifsc" value={form.ifsc} onChange={handleChange} required />
            <Select label="Account Type" name="accountType" value={form.accountType} onChange={handleChange}>
              <option value="current">Current</option>
              <option value="savings">Savings</option>
              <option value="other">Other</option>
            </Select>
            <div className="flex justify-end gap-3">
              {account && <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>}
              <Button type="submit" loading={saving}>Save Bank Account</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
