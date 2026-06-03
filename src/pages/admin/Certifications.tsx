import { useState, useEffect } from "react";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { getApiBase } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getAvatar } from "@/lib/avatar";
import { CheckCircle, XCircle, Clock, FileText, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  const pendingCount = requests.filter(r => r.status === "pending").length;

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: string; label: string; icon: any }> = {
      pending: { variant: "warning", label: "Pending", icon: Clock },
      approved: { variant: "accent", label: "Approved", icon: CheckCircle },
      rejected: { variant: "destructive", label: "Rejected", icon: XCircle },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return <Badge variant={s.variant as any}><Icon size={12} strokeWidth={2} /> {s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
            <FileText size={20} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">Coach Requests</h1>
            <p className="text-[13px] text-muted-foreground">Review and approve coach certification submissions</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["pending", "all", "approved", "rejected"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "secondary"}
              onClick={() => setFilter(f)}
              className="rounded-full capitalize"
            >
              {f} {f === "pending" ? `(${pendingCount})` : ""}
            </Button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="items-center py-14 text-center text-muted-foreground">
          <FileText size={40} strokeWidth={2} className="mb-3 opacity-30" />
          <p className="text-[14px]">No {filter === "all" ? "" : filter} certification requests</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((req: any) => (
            <Card key={req.id} className="gap-3.5 p-5">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-3">
                  <Avatar className="size-11">
                    <AvatarImage src={req.coach_avatar || getAvatar(req.coach_email, null, null, req.coach_name)} alt={req.coach_name} />
                    <AvatarFallback>{(req.coach_name || "C").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[14px] font-bold">{req.coach_name}</p>
                    <p className="text-[12px] text-muted-foreground">{req.coach_email} · {req.specialty || "General Fitness"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(req.status)}
                  <span className="text-[11px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Documents */}
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="secondary" size="sm" onClick={() => setPreviewUrl(req.national_id_url)} className="gap-1.5 text-[var(--secondary)]">
                  <Eye size={14} strokeWidth={2} /> View National ID
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPreviewUrl(req.certification_url)} className="gap-1.5 text-[var(--secondary)]">
                  <Eye size={14} strokeWidth={2} /> View Certification
                </Button>
                <span className="text-[12px] text-muted-foreground">Paid: {req.amount_paid} EGP</span>
              </div>

              {/* Admin actions for pending requests */}
              {req.status === "pending" && (
                <div className="flex flex-col gap-2.5">
                  <Textarea
                    placeholder="Admin notes (optional)…"
                    value={adminNotes[req.id] || ""}
                    onChange={e => setAdminNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleAction(req.id, "approve")} disabled={actionLoading === req.id} className="flex-1 gap-1.5">
                      <CheckCircle size={15} strokeWidth={2} /> {actionLoading === req.id ? "Processing…" : "Approve"}
                    </Button>
                    <Button variant="destructive" onClick={() => handleAction(req.id, "reject")} disabled={actionLoading === req.id} className="flex-1 gap-1.5">
                      <XCircle size={15} strokeWidth={2} /> {actionLoading === req.id ? "Processing…" : "Reject & Refund"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Show review info for reviewed requests */}
              {req.status !== "pending" && (
                <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
                  {req.reviewer_name && <span>Reviewed by: {req.reviewer_name}</span>}
                  {req.reviewed_at && <span>on {new Date(req.reviewed_at).toLocaleDateString()}</span>}
                  {req.admin_notes && <span className="text-foreground/80">Notes: {req.admin_notes}</span>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Document preview modal */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-[720px] bg-transparent p-0 shadow-none ring-0">
          {previewUrl && <img src={previewUrl} alt="Document preview" className="max-h-[82vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
