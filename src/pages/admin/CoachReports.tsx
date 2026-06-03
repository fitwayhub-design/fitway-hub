import { getApiBase } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { Flag, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { getAvatar } from "@/lib/avatar";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="mx-auto w-full max-w-[1000px]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-[26px] font-bold tracking-tight">
          <Flag size={22} className="text-destructive" /> Coach Reports
        </h1>
        <p className="text-[12px] text-muted-foreground">{pending.length} pending · {reviewed.length} reviewed</p>
      </header>

      {message && (
        <div className="mb-4 rounded-md bg-primary/10 px-3.5 py-2.5 text-[13px] font-semibold text-primary">
          {message}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}</div>
      ) : reports.length === 0 ? (
        <Card className="items-center p-9 text-center text-[14px] text-muted-foreground">No coach reports yet.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const variant = r.status === "pending" ? "warning" : r.status === "resolved" ? "default" : "muted";
            return (
              <Card key={r.id} className="gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-11">
                      <AvatarImage src={r.coach_avatar || getAvatar(r.coach_email, null, null, r.coach_name)} alt={r.coach_name} />
                      <AvatarFallback>{(r.coach_name || "C").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[14px] font-bold">{r.coach_name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.coach_email}</p>
                    </div>
                  </div>
                  <Badge variant={variant as any} className="uppercase tracking-wide">{String(r.status || "").replace(/_/g, " ")}</Badge>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-md bg-muted px-3 py-2.5">
                    <p className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">Reporter</p>
                    <p className="text-[13px] font-semibold">{r.user_name || "User"}</p>
                    <p className="text-[11px] text-muted-foreground">{r.user_email}</p>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2.5">
                    <p className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">Reason</p>
                    <p className="text-[13px] font-semibold">{r.reason.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {r.details && (
                  <div className="rounded-md bg-muted px-3 py-2.5">
                    <p className="text-[12px] leading-relaxed text-muted-foreground">{r.details}</p>
                  </div>
                )}

                {r.status === "pending" ? (
                  <div className="flex flex-col gap-2.5">
                    <Textarea
                      value={notesById[r.id] || ""}
                      onChange={(e) => setNotesById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      rows={2}
                      placeholder="Admin notes (optional)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => review(r.id, "resolved")} disabled={savingId === r.id} className="gap-1.5">
                        <CheckCircle2 size={14} /> Resolve
                      </Button>
                      <Button variant="outline" onClick={() => review(r.id, "dismissed")} disabled={savingId === r.id} className="gap-1.5">
                        <XCircle size={14} /> Dismiss
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <ShieldAlert size={14} />
                    Reviewed {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : ""}
                    {r.reviewer_name ? ` by ${r.reviewer_name}` : ""}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
