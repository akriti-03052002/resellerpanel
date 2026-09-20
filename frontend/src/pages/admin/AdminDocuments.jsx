import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, FileText } from "lucide-react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import DocumentPreviewModal from "../../components/admin/DocumentPreviewModal";

export default function AdminDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [expandedPartnerId, setExpandedPartnerId] = useState(null);

  const load = () => adminApi.get("/admin/documents/pending").then((res) => setDocuments(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const verify = async (id, status, rejectionReason) => {
    await adminApi.patch(`/admin/documents/${id}/verify`, { status, rejectionReason });
    load();
  };

  // Each partner can have several documents awaiting review at once — group
  // them so an admin sees one partner with everything they still need to
  // verify, instead of scanning a flat list for repeated partner names.
  const groups = useMemo(() => {
    const byPartner = new Map();

    for (const doc of documents) {
      const partnerId = doc.partnerId?._id || "unknown";
      if (!byPartner.has(partnerId)) {
        byPartner.set(partnerId, { partner: doc.partnerId, docs: [] });
      }
      byPartner.get(partnerId).docs.push(doc);
    }

    return Array.from(byPartner.values());
  }, [documents]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">KYC Review Queue</h1>

      {loading ? (
        <Card><p className="text-slate-400 text-sm p-6">Loading...</p></Card>
      ) : groups.length === 0 ? (
        <Card><p className="text-slate-400 text-sm p-6">No documents waiting for review.</p></Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const partnerId = group.partner?._id || "unknown";
            const isExpanded = expandedPartnerId === partnerId;

            return (
              <Card key={partnerId} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedPartnerId(isExpanded ? null : partnerId)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-100 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {group.partner?.legalEntity?.businessName || "Unknown partner"}
                      </p>
                      <p className="text-xs text-slate-400">{group.partner?.partnerCode || group.partner?._id || "—"} · {group.docs.length} document{group.docs.length === 1 ? "" : "s"} to review</p>
                    </div>
                  </div>
                  {group.partner?._id && (
                    <Link
                      to={`/admin/partners/${group.partner._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-brand-red hover:underline shrink-0"
                    >
                      View partner
                    </Link>
                  )}
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5">
                    {group.docs.map((d) => (
                      <button
                        key={d._id}
                        type="button"
                        onClick={() => setPreviewDoc(d)}
                        className="text-left p-4 rounded-xl border border-slate-200 hover:border-brand-red/40 hover:bg-slate-50 transition"
                      >
                        <p className="text-sm font-semibold text-slate-900 capitalize mb-3">{d.documentType.replace(/_/g, " ")}</p>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={16} className="text-slate-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{d.file.originalName}</p>
                              <p className="text-xs text-slate-400">Uploaded {new Date(d.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-brand-red shrink-0">Preview & Review</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onVerify={(id) => verify(id, "verified")}
          onReject={(id, reason) => verify(id, "rejected", reason)}
        />
      )}
    </div>
  );
}
