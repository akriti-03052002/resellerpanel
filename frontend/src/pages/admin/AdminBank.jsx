import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import PromptModal from "../../components/ui/PromptModal";

export default function AdminBank() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState({});
  const [error, setError] = useState("");
  const [overridePrompt, setOverridePrompt] = useState(null); // { account } | null
  const [rejectPrompt, setRejectPrompt] = useState(null); // { account } | null

  const load = () => adminApi.get("/admin/bank/pending").then((res) => setAccounts(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const submitVerify = async (account, status, overrideReason) => {
    setError("");
    try {
      await adminApi.patch(`/admin/bank/${account._id}/verify`, { status, overrideReason });
      toast.success(`Bank account marked ${status}.`);
      load();
    } catch (err) {
      const message = err.response?.data?.message || "Couldn't update this bank account.";
      setError(message);
      toast.error(message);
    }
  };

  const verify = (account, status) => {
    const razorpayCheck = account.razorpayCheck;
    const razorpayPassed = razorpayCheck?.paymentStatus === "captured" && razorpayCheck?.nameMatchStatus === "matched";

    if (status === "verified" && !razorpayPassed) {
      setOverridePrompt({ account });
      return;
    }

    submitVerify(account, status);
  };

  const submitChangeDecision = async (account, decision, payload) => {
    setError("");
    try {
      await adminApi.patch(`/admin/bank/${account._id}/change/${decision}`, payload || {});
      toast.success(`Pending bank change ${decision === "approve" ? "approved" : "rejected"}.`);
      load();
    } catch (err) {
      const message = err.response?.data?.message || "Couldn't update this pending change.";
      setError(message);
      toast.error(message);
    }
  };

  const approveChange = (account) => {
    const razorpayCheck = account.pendingChange?.razorpayCheck;
    const razorpayPassed = razorpayCheck?.paymentStatus === "captured" && razorpayCheck?.nameMatchStatus === "matched";

    if (!razorpayPassed) {
      setOverridePrompt({ account, isChange: true });
      return;
    }

    submitChangeDecision(account, "approve");
  };

  const rejectChange = (account) => setRejectPrompt({ account });

  const reveal = async (id, pending) => {
    const res = await adminApi.get(`/admin/bank/${id}/reveal${pending ? "?pending=true" : ""}`);
    setRevealed((prev) => ({ ...prev, [pending ? `${id}:pending` : id]: res.data.data }));
  };

  const newAccounts = accounts.filter((a) => !a.pendingChange);
  const changeRequests = accounts.filter((a) => a.pendingChange);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Bank Account Review</h1>
      <p className="text-sm text-slate-500 -mt-4">Revealing full account details is restricted to finance admins and is audit-logged on every access.</p>
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">New account submissions</h2>
        <Card>
          {loading ? (
            <p className="text-slate-400 text-sm p-6">Loading...</p>
          ) : (
            <Table
              empty="No new bank accounts waiting for review."
              rows={newAccounts}
              columns={[
                { key: "partner", header: "Partner", render: (a) => a.partnerId?.legalEntity?.businessName || "—" },
                { key: "bank", header: "Bank", render: (a) => a.bankName },
                { key: "acct", header: "Account", render: (a) => revealed[a._id] ? `${revealed[a._id].accountNumber} / ${revealed[a._id].ifsc}` : `•••• ${a.accountNumberLast4}` },
                {
                  key: "razorpay",
                  header: "Razorpay Check",
                  render: (a) => (
                    <div className="flex flex-col gap-1 items-start">
                      <Badge status={a.razorpayCheck?.paymentStatus || "not_initiated"}>
                        {(a.razorpayCheck?.paymentStatus || "not_initiated").replace(/_/g, " ")}
                      </Badge>
                      <Badge status={a.razorpayCheck?.nameMatchStatus === "matched" ? "verified" : a.razorpayCheck?.nameMatchStatus === "mismatched" ? "rejected" : "not_submitted"}>
                        {(a.razorpayCheck?.nameMatchStatus || "not_checked").replace(/_/g, " ")}
                      </Badge>
                    </div>
                  )
                },
                {
                  key: "actions",
                  header: "",
                  render: (a) => (
                    <div className="flex gap-3">
                      {!revealed[a._id] && (
                        <button onClick={() => reveal(a._id, false)} className="text-xs font-semibold text-slate-500 hover:underline">Reveal</button>
                      )}
                      <button onClick={() => verify(a, "verified")} className="text-xs font-semibold text-emerald-600 hover:underline">Verify</button>
                      <button onClick={() => verify(a, "rejected")} className="text-xs font-semibold text-brand-red hover:underline">Reject</button>
                    </div>
                  )
                }
              ]}
            />
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Pending change requests</h2>
        <p className="text-xs text-slate-500 -mt-1 mb-2">These partners already have a verified account on file — approving one of these overwrites it with the proposed details.</p>
        <Card>
          {loading ? (
            <p className="text-slate-400 text-sm p-6">Loading...</p>
          ) : (
            <Table
              empty="No pending bank account changes."
              rows={changeRequests}
              columns={[
                { key: "partner", header: "Partner", render: (a) => a.partnerId?.legalEntity?.businessName || "—" },
                { key: "bank", header: "Proposed Bank", render: (a) => a.pendingChange.bankName },
                {
                  key: "acct",
                  header: "Proposed Account",
                  render: (a) => {
                    const key = `${a._id}:pending`;
                    return revealed[key] ? `${revealed[key].accountNumber} / ${revealed[key].ifsc}` : `•••• ${a.pendingChange.accountNumberLast4}`;
                  }
                },
                {
                  key: "razorpay",
                  header: "Razorpay Check",
                  render: (a) => (
                    <div className="flex flex-col gap-1 items-start">
                      <Badge status={a.pendingChange.razorpayCheck?.paymentStatus || "not_initiated"}>
                        {(a.pendingChange.razorpayCheck?.paymentStatus || "not_initiated").replace(/_/g, " ")}
                      </Badge>
                      <Badge status={a.pendingChange.razorpayCheck?.nameMatchStatus === "matched" ? "verified" : a.pendingChange.razorpayCheck?.nameMatchStatus === "mismatched" ? "rejected" : "not_submitted"}>
                        {(a.pendingChange.razorpayCheck?.nameMatchStatus || "not_checked").replace(/_/g, " ")}
                      </Badge>
                    </div>
                  )
                },
                {
                  key: "actions",
                  header: "",
                  render: (a) => (
                    <div className="flex gap-3">
                      {!revealed[`${a._id}:pending`] && (
                        <button onClick={() => reveal(a._id, true)} className="text-xs font-semibold text-slate-500 hover:underline">Reveal</button>
                      )}
                      <button onClick={() => approveChange(a)} className="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>
                      <button onClick={() => rejectChange(a)} className="text-xs font-semibold text-brand-red hover:underline">Reject</button>
                    </div>
                  )
                }
              ]}
            />
          )}
        </Card>
      </div>

      <PromptModal
        open={Boolean(overridePrompt)}
        title="Verify despite a failed Razorpay check?"
        message="The Razorpay bank check hasn't passed (payment not captured, or the name doesn't match). Enter a reason to verify anyway."
        placeholder="Reason for overriding the check..."
        confirmLabel="Verify Anyway"
        onConfirm={(reason) => {
          const { account, isChange } = overridePrompt;
          setOverridePrompt(null);
          if (isChange) {
            submitChangeDecision(account, "approve", { overrideReason: reason });
          } else {
            submitVerify(account, "verified", reason);
          }
        }}
        onCancel={() => setOverridePrompt(null)}
      />

      <PromptModal
        open={Boolean(rejectPrompt)}
        title="Reject this pending bank account change?"
        message="Let the partner know why this change is being rejected. Their existing account details are unaffected."
        placeholder="Reason for rejecting this change..."
        confirmLabel="Reject Change"
        onConfirm={(reason) => {
          const account = rejectPrompt.account;
          setRejectPrompt(null);
          submitChangeDecision(account, "reject", { rejectionReason: reason });
        }}
        onCancel={() => setRejectPrompt(null)}
      />
    </div>
  );
}
