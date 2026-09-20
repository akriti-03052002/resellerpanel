import { useEffect, useState } from "react";
import { X } from "lucide-react";
import api from "../../services/api";

// View-only preview for the partner's own documents (no verify/reject —
// that's the admin side's DocumentPreviewModal). Same download-as-blob
// approach so it works through the same authenticated endpoint.
export default function DocumentPreviewModal({ doc, onClose }) {
  const [fileUrl, setFileUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    api.get(`/partner/documents/${doc._id}/download`, { responseType: "blob" })
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
      </div>
    </div>
  );
}
