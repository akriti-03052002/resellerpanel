import { useEffect, useState } from "react";
import { X } from "lucide-react";
import adminApi from "../../services/adminApi";
import Button from "../ui/Button";
import PromptModal from "../ui/PromptModal";

// Lets an admin actually look at the uploaded file before deciding —
// verify/reject used to be a blind call off just the filename.
export default function DocumentPreviewModal({ doc, onClose, onVerify, onReject }) {
  const [fileUrl, setFileUrl] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    adminApi.get(`/admin/documents/${doc._id}/download`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = window.URL.createObjectURL(res.data);
        setFileUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setError("Couldn't load a preview of this file."); });

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [doc._id]);

  const isImage = doc.file.mimeType?.startsWith("image/");
  const isPdf = doc.file.mimeType === "application/pdf";

  const handleVerify = async () => {
    setBusy(true);
    try {
      await onVerify(doc._id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = () => setRejecting(true);

  const submitReject = async (reason) => {
    setBusy(true);
    try {
      await onReject(doc._id, reason);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-900 capitalize">{doc.documentType.replace(/_/g, " ")}</p>
            <p className="text-xs text-slate-400">{doc.file.originalName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-brand-black" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-slate-50 flex items-center justify-center p-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && !fileUrl && <p className="text-sm text-slate-400">Loading preview...</p>}
          {fileUrl && isImage && (
            <img src={fileUrl} alt={doc.file.originalName} className="max-w-full max-h-[60vh] object-contain rounded-lg" />
          )}
          {fileUrl && isPdf && (
            <iframe src={fileUrl} title={doc.file.originalName} className="w-full h-[60vh] rounded-lg border border-slate-200" />
          )}
          {fileUrl && !isImage && !isPdf && (
            <a href={fileUrl} download={doc.file.originalName} className="text-sm font-semibold text-brand-red hover:underline">
              No inline preview for this file type — click to download
            </a>
          )}
        </div>

        {doc.verification.status === "pending" && (onVerify || onReject) && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
            <Button variant="danger" onClick={handleReject} loading={busy}>Reject</Button>
            <Button onClick={handleVerify} loading={busy}>Verify</Button>
          </div>
        )}
      </div>

      <PromptModal
        open={rejecting}
        title="Reject this document?"
        placeholder="Reason for rejecting..."
        confirmLabel="Reject"
        onConfirm={(reason) => { setRejecting(false); submitReject(reason); }}
        onCancel={() => setRejecting(false)}
      />
    </div>
  );
}
