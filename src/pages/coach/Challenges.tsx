/**
 * Coach Challenges console.
 *
 * Coaches create private, invitation-only Team challenges for athletes they
 * already serve, invite those athletes, review their submitted evidence,
 * monitor the private leaderboard, and finalize results (which grants the
 * admin-defined rewards).
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase, resolveAssetUrl } from "@/lib/api";
import {
  Trophy, Plus, ChevronLeft, Users, ShieldCheck, CheckCircle2, X, Send, Flag, Image as ImageIcon, Calendar, Target, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const METRICS = [
  { v: "sessions", l: "Sessions" }, { v: "steps", l: "Steps" }, { v: "distance_km", l: "Distance (km)" },
  { v: "minutes", l: "Minutes" }, { v: "reps", l: "Reps" }, { v: "checkins", l: "Check-ins" },
];
const MODELS = [
  { v: "consistency", l: "Consistency (show up often)" }, { v: "performance", l: "Performance (total output)" },
  { v: "improvement", l: "Improvement (vs. your baseline)" }, { v: "participation", l: "Participation (take part)" },
];
const TEAM_METHODS = [
  { v: "coach_approval", l: "Coach approval" }, { v: "attendance", l: "In-person attendance" },
  { v: "workout_log", l: "Workout log" }, { v: "time_based", l: "Timed activity" },
  { v: "manual_checkin", l: "Daily check-in" }, { v: "manual_step", l: "Steps (manual)" },
  { v: "manual_distance", l: "Distance (manual)" }, { v: "photo_evidence", l: "Photo evidence" },
  { v: "video_evidence", l: "Video evidence" }, { v: "screenshot_evidence", l: "Screenshot" },
];
const METHOD_LABELS: Record<string, string> = Object.fromEntries(TEAM_METHODS.map(m => [m.v, m.l]));

export default function CoachChallenges() {
  const { token } = useAuth();
  const api = useCallback((p: string, i?: RequestInit) =>
    fetch(getApiBase() + p, { ...i, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(i?.headers || {}) } }), [token]);

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const load = useCallback(async () => {
    try {
      const r = await api("/api/challenges?view=mine");
      if (r.ok) setList((await r.json()).challenges || []);
    } finally { setLoading(false); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  if (openId != null) return <ManageChallenge id={openId} api={api} token={token} onBack={() => { setOpenId(null); load(); }} flash={flash} toast={toast} />;

  return (
    <div className="space-y-5">
      {toast && <div className="fixed end-4 top-4 z-[9999] rounded-md bg-card px-4 py-3 text-[13px] font-semibold shadow-soft-lg ring-1 ring-inset ring-primary/30">{toast}</div>}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-primary/15 text-primary"><Trophy size={20} /></span>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">Team Challenges</h1>
            <p className="text-[13px] text-muted-foreground">Private, invite-only challenges for your athletes.</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-1.5"><Plus size={15} /> New challenge</Button>
      </div>

      {loading ? (
        <div className="grid gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
      ) : list.length === 0 ? (
        <Card className="p-12 text-center text-[13px] text-muted-foreground">No challenges yet. Create your first one!</Card>
      ) : (
        <div className="grid gap-3">
          {list.map(c => (
            <Card key={c.id} className="flex cursor-pointer items-center gap-4 p-4 transition-shadow hover:shadow-soft-md" onClick={() => setOpenId(c.id)}>
              <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {c.image_url ? <img src={resolveAssetUrl(c.image_url)} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-muted-foreground"><Trophy size={18} /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[15px] font-semibold">{c.title}</p>
                  <StatePill state={c.state} status={c.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users size={11} /> {c.participant_count || 0}</span>
                  <span className="inline-flex items-center gap-1"><Target size={11} /> {c.goal_label}</span>
                  {c.end_at && <span className="inline-flex items-center gap-1"><Calendar size={11} /> ends {new Date(c.end_at).toLocaleDateString()}</span>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && <CreateDialog api={api} token={token} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); flash("Challenge created"); }} flash={flash} />}
    </div>
  );
}

function StatePill({ state, status }: { state?: string; status?: string }) {
  const s = state || status || "active";
  const map: Record<string, string> = {
    pending_review: "bg-muted text-muted-foreground", rejected: "bg-destructive/15 text-destructive",
    scheduled: "bg-[var(--secondary-dim)] text-[var(--secondary)]", active: "bg-[color-mix(in_srgb,var(--green)_18%,transparent)] text-[var(--green)]",
    ended: "bg-muted text-muted-foreground", finalized: "bg-primary/15 text-primary", cancelled: "bg-destructive/15 text-destructive",
  };
  const label: Record<string, string> = { pending_review: "In review", rejected: "Rejected", scheduled: "Scheduled", active: "Live", ended: "Ended — finalize", finalized: "Finished", cancelled: "Cancelled" };
  return <Badge className={cn("px-2 py-0 text-[10px]", map[s] || map.active)}>{label[s] || s}</Badge>;
}

// ─── Create wizard ────────────────────────────────────────────────────────────
function CreateDialog({ token, onClose, onDone, flash }: any) {
  const [f, setF] = useState<any>({
    title: "", description: "", start_at: "", end_at: "", goal_metric: "sessions", goal_target: "",
    scoring_model: "consistency", participant_limit: "100", min_duration_seconds: "", rules_terms: "",
    verification_methods: ["coach_approval"], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const toggleMethod = (m: string) => set("verification_methods", f.verification_methods.includes(m) ? f.verification_methods.filter((x: string) => x !== m) : [...f.verification_methods, m]);

  const submit = async () => {
    if (f.title.trim().length < 3) return flash("Title must be at least 3 characters");
    if (!f.start_at || !f.end_at) return flash("Start and end dates are required");
    if (f.verification_methods.length === 0) return flash("Pick at least one verification method");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("type", "team");
      Object.entries(f).forEach(([k, v]) => {
        if (k === "verification_methods") fd.append(k, (v as string[]).join(","));
        else if (k === "start_at" || k === "end_at") fd.append(k, new Date(v as string).toISOString());
        else fd.append(k, String(v ?? ""));
      });
      if (cover) fd.append("cover", cover);
      const r = await fetch(getApiBase() + "/api/challenges", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) flash(d.message || "Failed to create"); else onDone();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <Card className="my-8 w-full max-w-[640px] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-bold">New Team Challenge</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X size={16} /></Button>
        </div>
        <div className="space-y-4">
          <Field label="Title"><Input value={f.title} onChange={e => set("title", e.target.value)} placeholder="e.g. 4-Week Consistency Sprint" /></Field>
          <Field label="Description"><Textarea value={f.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="What's the goal and how do athletes win?" /></Field>
          <Field label="Cover image (optional)">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[12px] text-muted-foreground">
              <ImageIcon size={14} /> {cover ? cover.name : "Choose image"}
              <input type="file" accept="image/*" className="hidden" onChange={e => setCover(e.target.files?.[0] || null)} />
            </label>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="datetime-local" value={f.start_at} onChange={e => set("start_at", e.target.value)} /></Field>
            <Field label="End"><Input type="datetime-local" value={f.end_at} onChange={e => set("end_at", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Goal metric">
              <Select value={f.goal_metric} onValueChange={v => set("goal_metric", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[10000]">{METRICS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Goal target"><Input type="number" value={f.goal_target} onChange={e => set("goal_target", e.target.value)} placeholder="e.g. 20" /></Field>
          </div>
          <Field label="Scoring model">
            <Select value={f.scoring_model} onValueChange={v => set("scoring_model", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="z-[10000]">{MODELS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Verification methods">
            <div className="flex flex-wrap gap-1.5">
              {TEAM_METHODS.map(m => (
                <button key={m.v} type="button" onClick={() => toggleMethod(m.v)}
                  className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px]", f.verification_methods.includes(m.v) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                  <ShieldCheck size={11} /> {m.l}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Participant limit"><Input type="number" value={f.participant_limit} onChange={e => set("participant_limit", e.target.value)} /></Field>
            <Field label="Min duration (sec, optional)"><Input type="number" value={f.min_duration_seconds} onChange={e => set("min_duration_seconds", e.target.value)} placeholder="e.g. 600" /></Field>
          </div>
          <Field label="Rules & terms (optional)"><Textarea value={f.rules_terms} onChange={e => set("rules_terms", e.target.value)} rows={2} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create challenge"}</Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return <div className="grid gap-1.5"><Label className="text-[12px]">{label}</Label>{children}</div>;
}

// ─── Manage one challenge ─────────────────────────────────────────────────────
function ManageChallenge({ id, api, token, onBack, flash, toast }: any) {
  const [c, setC] = useState<any>(null);
  const [tab, setTab] = useState("review");
  const [subs, setSubs] = useState<any[]>([]);
  const [board, setBoard] = useState<any[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const loadHead = useCallback(async () => { const r = await api(`/api/challenges/${id}`); if (r.ok) setC((await r.json()).challenge); }, [api, id]);
  const loadSubs = useCallback(async () => { const r = await api(`/api/challenges/${id}/submissions?status=pending`); if (r.ok) setSubs((await r.json()).submissions || []); }, [api, id]);
  const loadBoard = useCallback(async () => { const r = await api(`/api/challenges/${id}/leaderboard?scope=overall`); if (r.ok) setBoard((await r.json()).leaderboard || []); }, [api, id]);
  const loadAthletes = useCallback(async () => { const r = await api(`/api/challenges/${id}/invitable`); if (r.ok) setAthletes((await r.json()).athletes || []); }, [api, id]);

  useEffect(() => { loadHead(); loadSubs(); loadBoard(); loadAthletes(); }, [loadHead, loadSubs, loadBoard, loadAthletes]);

  const review = async (sid: number, approve: boolean) => {
    setBusy(true);
    try {
      const reason = approve ? "" : prompt("Reason for rejection (optional):") || "";
      await api(`/api/challenges/${id}/submissions/${sid}/${approve ? "approve" : "reject"}`, { method: "POST", body: JSON.stringify({ reason }) });
      await loadSubs(); await loadBoard();
    } finally { setBusy(false); }
  };
  const invite = async () => {
    if (picked.size === 0) return flash("Select athletes to invite");
    setBusy(true);
    try {
      const r = await api(`/api/challenges/${id}/invites`, { method: "POST", body: JSON.stringify({ userIds: [...picked] }) });
      const d = await r.json().catch(() => ({}));
      flash(d.message || "Invited"); setPicked(new Set()); await loadAthletes();
    } finally { setBusy(false); }
  };
  const finalize = async () => {
    if (!confirm("Finalize now? This locks the challenge and grants rewards.")) return;
    setBusy(true);
    try { const r = await api(`/api/challenges/${id}/finalize`, { method: "POST" }); const d = await r.json().catch(() => ({})); flash(d.message || "Finalized"); await loadHead(); await loadBoard(); }
    finally { setBusy(false); }
  };

  if (!c) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-5">
      {toast && <div className="fixed end-4 top-4 z-[9999] rounded-md bg-card px-4 py-3 text-[13px] font-semibold shadow-soft-lg ring-1 ring-inset ring-primary/30">{toast}</div>}
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /> Back</button>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className="size-12 overflow-hidden rounded-md bg-muted">{c.image_url ? <img src={resolveAssetUrl(c.image_url)} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-muted-foreground"><Trophy size={18} /></span>}</div>
          <div>
            <div className="flex items-center gap-2"><h2 className="text-[17px] font-bold">{c.title}</h2><StatePill state={c.state} /></div>
            <p className="text-[12px] text-muted-foreground">{c.participant_count} athletes · {c.goal_label} · {c.scoring_model}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { loadSubs(); loadBoard(); loadAthletes(); }}><RefreshCw size={14} /> Refresh</Button>
          {(c.state === "ended" || c.state === "active") && <Button size="sm" disabled={busy} onClick={finalize} className="gap-1.5"><Trophy size={14} /> Finalize</Button>}
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="review" className="gap-1.5">Review {subs.length > 0 && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">{subs.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="board">Leaderboard</TabsTrigger>
          <TabsTrigger value="invite">Invite</TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          {subs.length === 0 ? <Card className="p-10 text-center text-[13px] text-muted-foreground">Nothing to review. 🎉</Card> : (
            <div className="space-y-2.5">
              {subs.map(s => (
                <Card key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{s.user_name}</p>
                    <p className="text-[11px] text-muted-foreground">{METHOD_LABELS[s.method] || s.method} · {s.activity_date}{s.metric_value ? ` · ${s.metric_value}` : ""}{s.flagged ? " · ⚠️ flagged" : ""}</p>
                    {s.note && <p className="mt-0.5 text-[12px] text-muted-foreground">"{s.note}"</p>}
                  </div>
                  {s.evidence_url && <a href={resolveAssetUrl(s.evidence_url)} target="_blank" rel="noreferrer" className="text-[12px] text-primary underline">View evidence</a>}
                  <div className="flex gap-1.5">
                    <Button size="sm" disabled={busy} className="gap-1" onClick={() => review(s.id, true)}><CheckCircle2 size={14} /> Approve</Button>
                    <Button size="sm" variant="outline" disabled={busy} className="gap-1 text-destructive" onClick={() => review(s.id, false)}><X size={14} /> Reject</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="board">
          <Card className="p-4">
            {board.length === 0 ? <p className="py-8 text-center text-[13px] text-muted-foreground">No entries yet.</p> : (
              <div className="space-y-1">
                {board.map(r => (
                  <div key={r.participant_id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/40">
                    <span className={cn("grid size-7 place-items-center rounded-full text-[12px] font-bold", r.rank <= 3 ? "bg-primary/15 text-primary" : "text-muted-foreground")}>{r.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{r.name}{r.is_winner && <Trophy size={12} className="ms-1 inline text-primary" />}</span>
                    <span className="text-[13px] font-bold tabular-nums">{r.verified_points}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">Only athletes you've coached before are shown.</p>
              <Button size="sm" disabled={busy || picked.size === 0} className="gap-1.5" onClick={invite}><Send size={14} /> Invite {picked.size > 0 ? `(${picked.size})` : ""}</Button>
            </div>
            {athletes.length === 0 ? <p className="py-8 text-center text-[13px] text-muted-foreground">No eligible athletes to invite.</p> : (
              <div className="grid gap-1.5">
                {athletes.map(a => {
                  const on = picked.has(a.id);
                  return (
                    <button key={a.id} onClick={() => setPicked(p => { const n = new Set(p); on ? n.delete(a.id) : n.add(a.id); return n; })}
                      className={cn("flex items-center gap-3 rounded-md border px-3 py-2 text-start", on ? "border-primary bg-primary/5" : "border-border")}>
                      <span className={cn("grid size-5 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <CheckCircle2 size={13} />}</span>
                      <span className="text-[13px]">{a.name || `User #${a.id}`}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
