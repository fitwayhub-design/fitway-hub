import { getApiBase } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { Flag, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { getAvatar } from "@/lib/avatar";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

type ReportStatus = "pending" | "resolved" | "dismissed";

interface CoachReport {
  id: number;
  coach_id: number;
  user_id: number;
  reason: string;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  coach_name: string;
  coach_email: string;
  coach_avatar: string | null;
  user_name: string;
  user_email: string;
  reviewer_name: string | null;
}

export default function CoachReports() {
  const { token } = useAuth();
  const [reports, setReports] = useState<CoachReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notesById, setNotesById] = useState<Record<number, string>>({});

  const load = async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/admin/coach-reports`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setReports(d.reports || []);
    } catch {
      setMessage("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);
  useAutoRefresh(load);

  const review = async (id: number, status: "resolved" | "dismissed") => {
    setSavingId(id);
    try {
      const r = await fetch(`${getApiBase()}/api/admin/coach-reports/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_notes: notesById[id] || "" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(d?.message || "Failed to update report");
      } else {
        setMessage("Report updated");
        setReports((prev) => prev.map((x) => x.id === id ? { ...x, status, admin_notes: notesById[id] || null } : x));
      }
    } catch {
      setMessage("Failed to update report");
    }
    setSavingId(null);
    setTimeout(() => setMessage(""), 2200);
  };

  const pending = reports.filter((r) => r.status === "pending");
  const reviewed = reports.filter((r) => r.status !== "pending");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-en)", fontSize: "clamp(20px, 3.6vw, 28px)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Flag size={20} color="var(--red)" /> Coach Reports
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{pending.length} pending · {reviewed.length} reviewed</p>
      </div>

      {message && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 12, background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.24)", color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading reports...</div>
      ) : reports.length === 0 ? (
        <div style={{ padding: 34, textAlign: "center", borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)" }}>
          No coach reports yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.map((r) => {
            const statusColor = r.status === "pending" ? "var(--amber)" : r.status === "resolved" ? "var(--accent)" : "var(--text-muted)";
            return (
              <div key={r.id} style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg-card)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={r.coach_avatar || getAvatar(r.coach_email, null, null, r.coach_name)} alt={r.coach_name} style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--bg-surface)" }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700 }}>{r.coach_name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.coach_email}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, border: `1px solid ${statusColor}`, color: statusColor, fontWeight: 700, textTransform: "uppercase" }}>
                    {String(r.status || "").replace(/_/g, " ")}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 10 }}>
                  <div style={{ padding: "9px 11px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Reporter</p>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{r.user_name || "User"}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.user_email}</p>
                  </div>
                  <div style={{ padding: "9px 11px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Reason</p>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{r.reason.replace(/_/g, " ")}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {r.details && (
                  <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>{r.details}</p>
                  </div>
                )}

                {r.status === "pending" ? (
                  <>
                    <textarea
                      className="input-base"
                      value={notesById[r.id] || ""}
                      onChange={(e) => setNotesById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="Admin notes (optional)"
                      style={{ resize: "vertical", marginBottom: 8 }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => review(r.id, "resolved")}
                        disabled={savingId === r.id}
                        style={{ padding: "9px 12px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#000000", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: savingId === r.id ? 0.6 : 1 }}
                      >
                        <CheckCircle2 size={14} /> Resolve
                      </button>
                      <button
                        onClick={() => review(r.id, "dismissed")}
                        disabled={savingId === r.id}
                        style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: savingId === r.id ? 0.6 : 1 }}
                      >
                        <XCircle size={14} /> Dismiss
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", paddingTop: 2 }}>
                    <ShieldAlert size={14} />
                    Reviewed {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : ""}
                    {r.reviewer_name ? ` by ${r.reviewer_name}` : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
