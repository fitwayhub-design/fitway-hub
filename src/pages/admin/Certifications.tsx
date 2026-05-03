import { useState, useEffect } from "react";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { getApiBase } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getAvatar } from "@/lib/avatar";
import { CheckCircle, XCircle, Clock, FileText, Eye } from "lucide-react";

export default function AdminCertifications() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const api = (path: string, opts?: RequestInit) =>
    fetch(getApiBase() + path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const r = await api("/api/admin/certification-requests");
      if (r.ok) {
        const d = await r.json();
        setRequests(d.requests || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, []);
  useAutoRefresh(fetchRequests);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      const r = await api(`/api/admin/certification-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, admin_notes: adminNotes[id] || "" }),
      });
      if (r.ok) {
        fetchRequests();
        setAdminNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; border: string; label: string; icon: any }> = {
      pending: { bg: "rgba(255,179,64,0.12)", color: "var(--amber)", border: "rgba(255,179,64,0.25)", label: "Pending", icon: Clock },
      approved: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "rgba(59,130,246,0.25)", label: "Approved", icon: CheckCircle },
      rejected: { bg: "rgba(255,68,68,0.1)", color: "var(--red)", border: "rgba(255,68,68,0.25)", label: "Rejected", icon: XCircle },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600 }}>
        <Icon size={12} /> {s.label}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-en)", fontSize: 22, fontWeight: 700 }}>Certification Requests</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {(["pending", "all", "approved", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 99, border: `1px solid ${filter === f ? "var(--blue)" : "var(--border)"}`,
              background: filter === f ? "rgba(59,139,255,0.1)" : "var(--bg-surface)",
              color: filter === f ? "var(--blue)" : "var(--text-muted)",
              cursor: "pointer", fontSize: 12, fontWeight: 600, textTransform: "capitalize",
            }}>{f} {f === "pending" ? `(${requests.filter(r => r.status === "pending").length})` : ""}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <FileText size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>No {filter === "all" ? "" : filter} certification requests</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((req: any) => (
            <div key={req.id} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={req.coach_avatar || getAvatar(req.coach_email, null, null, req.coach_name)} alt={req.coach_name} style={{ width: 42, height: 42, borderRadius: "50%", backgroundColor: "var(--bg-surface)", border: "2px solid var(--border)" }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{req.coach_name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{req.coach_email} · {req.specialty || "General Fitness"}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {statusBadge(req.status)}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(req.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Documents */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <button onClick={() => setPreviewUrl(req.national_id_url)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--blue)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  <Eye size={14} /> View National ID
                </button>
                <button onClick={() => setPreviewUrl(req.certification_url)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--blue)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  <Eye size={14} /> View Certification
                </button>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
                  Paid: {req.amount_paid} EGP
                </span>
              </div>

              {/* Admin actions for pending requests */}
              {req.status === "pending" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <textarea
                    placeholder="Admin notes (optional)..."
                    value={adminNotes[req.id] || ""}
                    onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, resize: "vertical", minHeight: 50, fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleAction(req.id, "approve")}
                      disabled={actionLoading === req.id}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #06b6d4)", border: "none", color: "#fff", cursor: actionLoading === req.id ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-en)", opacity: actionLoading === req.id ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <CheckCircle size={15} /> {actionLoading === req.id ? "Processing…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleAction(req.id, "reject")}
                      disabled={actionLoading === req.id}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", color: "var(--red)", cursor: actionLoading === req.id ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-en)", opacity: actionLoading === req.id ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <XCircle size={15} /> {actionLoading === req.id ? "Processing…" : "Reject & Refund"}
                    </button>
                  </div>
                </div>
              )}

              {/* Show review info for reviewed requests */}
              {req.status !== "pending" && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {req.reviewer_name && <span>Reviewed by: {req.reviewer_name}</span>}
                  {req.reviewed_at && <span>on {new Date(req.reviewed_at).toLocaleDateString()}</span>}
                  {req.admin_notes && <span style={{ color: "var(--text-secondary)" }}>Notes: {req.admin_notes}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Document preview modal */}
      {previewUrl && (
        <div onClick={() => setPreviewUrl(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "pointer" }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: "85vh", position: "relative" }}>
            <button onClick={() => setPreviewUrl(null)} style={{ position: "absolute", top: -40, right: 0, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 99, padding: "8px 16px", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Close</button>
            <img src={previewUrl} alt="Document preview" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 12, objectFit: "contain" }} />
          </div>
        </div>
      )}
    </div>
  );
}
