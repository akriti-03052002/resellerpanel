import { useEffect, useState } from "react";
import { UploadCloud, Download, FileText, AlertCircle } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Logo from "../../components/ui/Logo";

// `required` is resolved per-partnerType from the backend (see
// partnerVerification.js) once profile data loads — business types
// (Vendor, Reseller, Agency, Technology, Strategic) need GST/MSME on top
// of PAN + a cheque; individual-oriented types (Affiliate, Influencer,
// Referral) only need the latter two.
const DOCUMENT_TYPES = [
  { value: "msme_udyam", label: "MSME / Udyam Certificate" },
  { value: "gst_certificate", label: "GST Certificate" },
  { value: "pan_card", label: "PAN Card" },
  { value: "cancelled_cheque", label: "Cancelled Cheque" },
  { value: "bank_proof", label: "Bank Proof" },
  { value: "partner_agreement", label: "Partner Agreement", systemGenerated: true },
  { value: "other", label: "Other" }
];

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [requiredTypes, setRequiredTypes] = useState([]);
  const [partnerType, setPartnerType] = useState("");
  const [partnerStatus, setPartnerStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState({}); // { [documentType]: File }
  const [uploadingType, setUploadingType] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [errors, setErrors] = useState({}); // { [documentType]: message }

  const load = () => {
    Promise.all([
      api.get("/partner/documents").then((res) => setDocuments(res.data.data)),
      api.get("/partner/profile").then((res) => {
        setRequiredTypes(res.data.data.requiredDocumentTypes || []);
        setPartnerType(res.data.data.partner.partnerType);
        setPartnerStatus(res.data.data.partner.status);
      })
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Most recent upload per type — a rejected doc can be re-uploaded, which
  // creates a new row rather than replacing the old one, so only the latest
  // is what the checklist should reflect.
  const latestByType = (type) =>
    documents
      .filter((d) => d.documentType === type)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

  const handleFileSelect = (type, file) => {
    setPendingFiles((prev) => ({ ...prev, [type]: file }));
    setErrors((prev) => ({ ...prev, [type]: "" }));
  };

  const handleUpload = async (type) => {
    const file = pendingFiles[type];

    if (!file) {
      setErrors((prev) => ({ ...prev, [type]: "Choose a file first." }));
      return;
    }

    const formData = new FormData();
    formData.append("documentType", type);
    formData.append("file", file);

    try {
      setUploadingType(type);
      await api.post("/partner/documents", formData, { headers: { "Content-Type": undefined } });
      setPendingFiles((prev) => ({ ...prev, [type]: null }));
      load();
    } catch (err) {
      setErrors((prev) => ({ ...prev, [type]: err.response?.data?.message || "Upload failed. Try again." }));
    } finally {
      setUploadingType(null);
    }
  };

  const handleDownload = async (doc) => {
    try {
      setDownloadingId(doc._id);
      const res = await api.get(`/partner/documents/${doc._id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.file.originalName || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setErrors((prev) => ({ ...prev, [doc.documentType]: "Couldn't download this file." }));
    } finally {
      setDownloadingId(null);
    }
  };

  const uploadableTypes = DOCUMENT_TYPES.filter((t) => !t.systemGenerated);
  const submittedCount = uploadableTypes.filter((t) => latestByType(t.value)).length;
  const verifiedCount = DOCUMENT_TYPES.filter((t) => latestByType(t.value)?.verification.status === "verified").length;
  const requiredCount = requiredTypes.length;
  const requiredVerifiedCount = DOCUMENT_TYPES.filter((t) => requiredTypes.includes(t.value) && latestByType(t.value)?.verification.status === "verified").length;

  if (loading) {
    return <p className="text-slate-400 text-sm">Loading...</p>;
  }

  // Once verified, the individual KYC proofs are no longer relevant to the
  // partner — SPOTX has already reviewed and approved them, and re-download
  // is blocked server-side (see partnerDocumentController.downloadDocument).
  // Only the Partner Agreement — their actual contract — stays visible.
  if (partnerStatus === "active") {
    const agreementDoc = latestByType("partner_agreement");

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">KYC Documents</h1>
          <p className="text-sm text-slate-500 mt-1">Only the partner owner can view documents.</p>
        </div>

        <Card className="p-8 text-center">
          <Logo size="md" className="mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900">Your account is verified</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Your KYC documents have been reviewed and approved by SPOTX. They're no longer shown here —
            only your Partner Agreement remains available below.
          </p>
        </Card>

        {agreementDoc && (
          <Card className="p-5 max-w-md">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Partner Agreement</p>
                <p className="text-xs text-slate-400">Generated by SPOTX</p>
              </div>
              <Badge status={agreementDoc.verification.status} />
            </div>
            <div className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{agreementDoc.file.originalName}</p>
                  <p className="text-xs text-slate-400">Generated {new Date(agreementDoc.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(agreementDoc)}
                disabled={downloadingId === agreementDoc._id}
                className="shrink-0 text-slate-400 hover:text-brand-black disabled:opacity-50"
                aria-label="Download"
              >
                <Download size={16} />
              </button>
            </div>
            {errors.partner_agreement && <p className="text-xs text-red-600 mt-2">{errors.partner_agreement}</p>}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">KYC Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Only the partner owner can upload or view KYC documents. SPOTX reviews each one before your account is verified.
          {partnerType && <> Required documents are tailored to your partner type (<span className="font-medium text-slate-600 capitalize">{partnerType}</span>).</>}
        </p>
      </div>

      <Card className="p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Required documents verified</p>
          <p className="text-xs text-slate-500 mt-0.5">{requiredVerifiedCount} of {requiredCount} required documents approved</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{submittedCount} of {uploadableTypes.length} submitted</Badge>
          <Badge tone={requiredVerifiedCount === requiredCount ? "success" : "warning"}>
            {verifiedCount} of {DOCUMENT_TYPES.length} total verified
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DOCUMENT_TYPES.map((type) => {
            const doc = latestByType(type.value);
            const status = doc?.verification.status || "not_submitted";
            const isRequired = requiredTypes.includes(type.value);

            return (
              <Card key={type.value} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {type.label}
                      {isRequired && <span className="text-brand-red ml-1">*</span>}
                    </p>
                    {type.systemGenerated ? (
                      <p className="text-xs text-slate-400">Generated by SPOTX</p>
                    ) : !isRequired ? (
                      <p className="text-xs text-slate-400">Optional</p>
                    ) : null}
                  </div>
                  {(!type.systemGenerated || doc) && <Badge status={status} />}
                </div>

                {doc && (
                  <div className="flex items-center justify-between gap-3 mb-3 p-2.5 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{doc.file.originalName}</p>
                        <p className="text-xs text-slate-400">Uploaded {new Date(doc.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc._id}
                      className="shrink-0 text-slate-400 hover:text-brand-black disabled:opacity-50"
                      aria-label="Download"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                )}

                {status === "rejected" && doc?.verification.rejectionReason && (
                  <div className="flex items-start gap-2 mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{doc.verification.rejectionReason}</span>
                  </div>
                )}

                {type.systemGenerated ? (
                  !doc && (
                    <p className="text-xs text-slate-400">
                      This is generated automatically once your KYC documents and bank account are both verified — nothing to upload here.
                    </p>
                  )
                ) : status !== "verified" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileSelect(type.value, e.target.files[0])}
                      className="flex-1 min-w-0 text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                    />
                    <Button
                      type="button"
                      onClick={() => handleUpload(type.value)}
                      loading={uploadingType === type.value}
                      className="shrink-0 !px-3 !py-2"
                    >
                      <span className="flex items-center gap-1.5"><UploadCloud size={14} /> {doc ? "Re-upload" : "Upload"}</span>
                    </Button>
                  </div>
                )}

                {errors[type.value] && <p className="text-xs text-red-600 mt-2">{errors[type.value]}</p>}
              </Card>
            );
        })}
      </div>
    </div>
  );
}
