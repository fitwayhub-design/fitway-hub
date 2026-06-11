/**
 * Admin Challenges — the public-surface control room.
 *
 *  • Approvals  — review & approve/reject pending challenges (every Community
 *                 challenge and any flagged Team challenge lands here).
 *  • All        — moderate every challenge: finalize, cancel.
 *  • Reports    — abuse + system fraud-flag queue.
 *  • Rewards    — the single, global reward catalog applied to ALL challenges.
 *
 * Admins can also create Community challenges directly.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase, resolveAssetUrl } from "@/lib/api";
import {
  Trophy, RefreshCw, CheckCircle, AlertTriangle, Users, Plus, X, Save, Flag, Gift, ShieldCheck, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { GoalBuilder, RewardFields, type GoalDraft } from "@/components/challenges/goals";

const API = getApiBase();

export default function AdminChallenges() {
  const { token } = useAuth();
  const api = useCallback((p: string, i?: RequestInit) =>
    fetch(`${API}${p}`, { ...i, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(i?.headers || {}) } }), [token]);

  const [tab, setTab] = useState("approvals");
  const [list, setList] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [rewardEdit, setRewardEdit] = useState<any>(null);
  const notify = (k: "ok" | "err", t: string) => { setToast({ k, t }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [l, r] = await Promise.all([api("/api/challenges/admin/list"), api("/api/challenges/admin/reports")]);
      if (l.ok) setList((await l.json()).challenges || []);
      if (r.ok) setReports((await r.json()).reports || []);
    } catch { notify("err", "Failed to load"); } finally { setLoading(false); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const review = async (id: number, decision: "approve" | "reject") => {
    const body = decision === "reject" ? { reason: prompt("Reason (optional):") || "" } : {};
    const r = await api(`/api/challenges/admin/${id}/${decision}`, { method: "POST", body: JSON.stringify(body) });
    notify(r.ok ? "ok" : "err", r.ok ? `Challenge ${decision}d` : "Failed"); load();
  };
  const finalize = async (id: number) => {
    if (!confirm("Force-finalize this challenge now?")) return;
    const r = await api(`/api/challenges/${id}/finalize?force=1`, { method: "POST" });
    const d = await r.json().catch(() => ({})); notify(r.ok ? "ok" : "err", d.message || "Done"); load();
  };
  const cancel = async (id: number) => {
    if (!confirm("Cancel this challenge? Participants are notified.")) return;
    const r = await api(`/api/challenges/${id}`, { method: "DELETE" });
    notify(r.ok ? "ok" : "err", r.ok ? "Cancelled" : "Failed"); load();
  };
  const resolveReport = async (id: number) => {
    const r = await api(`/api/challenges/admin/reports/${id}/resolve`, { method: "POST", body: JSON.stringify({ note: prompt("Resolution note (optional):") || "" }) });
    notify(r.ok ? "ok" : "err", r.ok ? "Resolved" : "Failed"); load();
  };

  const pending = list.filter(c => c.status === "pending_review");

  return (
    <div className="space-y-5">
      {toast && (
        <div className={cn("fixed end-4 top-4 z-[9999] flex items-center gap-2 rounded-md bg-card px-4 py-3 text-[13px] font-semibold shadow-soft-lg ring-1 ring-inset", toast.k === "ok" ? "ring-[color-mix(in_srgb,var(--green)_40%,transparent)]" : "ring-destructive/40")}>
          {toast.k === "ok" ? <CheckCircle size={16} className="text-[var(--green)]" /> : <AlertTriangle size={16} className="text-destructive" />}{toast.t}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-primary/15 text-primary"><Trophy size={20} /></span>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">Challenges</h1>
            <p className="text-[13px] text-muted-foreground">Approve, moderate, and configure rewards for all challenges.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw size={14} /> Refresh</Button>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5"><Plus size={14} /> New community challenge</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="approvals" className="gap-1.5">Approvals {pending.length > 0 && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">{pending.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">Reports {reports.length > 0 && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">{reports.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5"><Gift size={14} /> Rewards</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals">
          {loading ? <Skeleton className="h-24 w-full rounded-lg" /> : pending.length === 0 ? (
            <Card className="p-10 text-center text-[13px] text-muted-foreground">No challenges awaiting review.</Card>
          ) : pending.map(c => (
            <Card key={c.id} className="mb-3 flex flex-wrap items-center gap-4 p-4">
              <Cover c={c} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{c.title}</p>
                <p className="line-clamp-2 text-[12px] text-muted-foreground">{c.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  by {c.creator_name} · {c.type}
                  {Number(c.goals_count) > 0 ? ` · ${c.goals_count} goal${Number(c.goals_count) > 1 ? "s" : ""}` : ` · ${c.goal_label || c.goal_metric} · ${c.scoring_model}`}
                  {c.reward_title ? ` · 🎁 ${c.reward_title}` : " · no reward set"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={() => review(c.id, "approve")}><CheckCircle size={14} /> Approve</Button>
                <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => review(c.id, "reject")}><X size={14} /> Reject</Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all">
          {loading ? <Skeleton className="h-24 w-full rounded-lg" /> : (
            <div className="grid gap-3">
              {list.map(c => (
                <Card key={c.id} className="flex flex-wrap items-center gap-4 p-4">
                  <Cover c={c} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold">{c.title}</p>
                      <Badge variant="outline" className="px-2 py-0 text-[10px]">{c.type}</Badge>
                      <Badge variant="secondary" className="px-2 py-0 text-[10px]">{c.state}</Badge>
                      <Badge variant="secondary" className="gap-1 px-2 py-0 text-[10px]"><Users size={10} /> {c.participant_count || 0}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      by {c.creator_name}{c.end_at ? ` · ends ${new Date(c.end_at).toLocaleDateString()}` : ""}
                      {c.reward_title ? ` · 🎁 ${c.reward_title}${Number(c.reward_points) > 0 ? ` (+${c.reward_points} pts)` : ""}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {c.state !== "finalized" && c.status !== "cancelled" && <Button size="sm" variant="outline" className="gap-1" onClick={() => setRewardEdit(c)}><Gift size={13} /> Reward</Button>}
                    {c.state !== "finalized" && c.status !== "cancelled" && <Button size="sm" variant="outline" onClick={() => finalize(c.id)}>Finalize</Button>}
                    {c.status !== "cancelled" && c.state !== "finalized" && <Button size="sm" variant="outline" className="text-destructive" onClick={() => cancel(c.id)}>Cancel</Button>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports">
          {reports.length === 0 ? <Card className="p-10 text-center text-[13px] text-muted-foreground">No open reports.</Card> : reports.map(r => (
            <Card key={r.id} className="mb-2.5 flex flex-wrap items-center gap-3 p-3.5">
              <Flag size={16} className={r.source === "system" ? "text-[var(--secondary)]" : "text-destructive"} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{r.challenge_title || `Challenge #${r.challenge_id}`}</p>
                <p className="text-[12px] text-muted-foreground">{r.source === "system" ? "🤖 system flag" : "user report"}: {r.reason}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => resolveReport(r.id)}>Resolve</Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="rewards">
          <RewardSettings api={api} notify={notify} />
        </TabsContent>
      </Tabs>

      {creating && <CreateCommunity api={api} token={token} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); notify("ok", "Community challenge created"); }} notify={notify} />}
      {rewardEdit && <EditRewardDialog api={api} challenge={rewardEdit} onClose={() => setRewardEdit(null)} onDone={() => { setRewardEdit(null); load(); notify("ok", "Reward updated"); }} notify={notify} />}
    </div>
  );
}

// ─── Per-challenge reward editor (admin sets the prize in challenge settings) ──
function EditRewardDialog({ api, challenge, onClose, onDone, notify }: any) {
  const [f, setF] = useState({
    reward_title: challenge.reward_title || "",
    reward_description: challenge.reward_description || "",
    reward_points: String(challenge.reward_points ?? 0),
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api(`/api/challenges/${challenge.id}`, { method: "PATCH", body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) notify("err", d.message || "Failed"); else onDone();
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <Card className="my-16 w-full max-w-[460px] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[16px] font-bold"><Gift size={16} className="text-primary" /> Reward — {challenge.title}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X size={16} /></Button>
        </div>
        <RewardFields showPoints value={f} onChange={patch => setF(p => ({ ...p, ...patch }))} />
        <p className="mt-2 text-[11px] text-muted-foreground">The champion receives this reward (and bonus points) when the challenge is finalized.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save reward"}</Button>
        </div>
      </Card>
    </div>
  );
}

function Cover({ c }: { c: any }) {
  return (
    <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
      {c.image_url ? <img src={resolveAssetUrl(c.image_url)} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-muted-foreground"><Trophy size={18} /></span>}
    </div>
  );
}

// ─── Global reward settings editor ────────────────────────────────────────────
function RewardSettings({ api, notify }: any) {
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const r = await api("/api/challenges/admin/reward-settings"); if (r.ok) setS((await r.json()).settings || {}); })(); }, [api]);
  if (!s) return <Skeleton className="h-64 w-full rounded-lg" />;

  const tier = (key: string, label: string) => {
    const t = s[key] || {};
    return (
      <div key={key} className="grid grid-cols-[1fr_auto] items-end gap-3 rounded-md border border-border p-3">
        <div className="grid gap-1.5">
          <Label className="text-[11px] text-muted-foreground">{label} — title</Label>
          <Input value={t.label || ""} onChange={e => setS({ ...s, [key]: { ...t, label: e.target.value } })} />
        </div>
        <div className="grid w-28 gap-1.5">
          <Label className="text-[11px] text-muted-foreground">Points</Label>
          <Input type="number" value={t.points ?? 0} onChange={e => setS({ ...s, [key]: { ...t, points: Number(e.target.value) } })} />
        </div>
      </div>
    );
  };

  const save = async () => {
    setBusy(true);
    try { const r = await api("/api/challenges/admin/reward-settings", { method: "PUT", body: JSON.stringify({ settings: s }) }); notify(r.ok ? "ok" : "err", r.ok ? "Saved" : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold"><ShieldCheck size={15} className="text-primary" /> Global reward catalog (applies to every challenge)</div>
      {tier("champion", "🥇 Champion")}
      {tier("runner_up", "🥈 Runner-up")}
      {tier("third", "🥉 Third place")}
      {tier("most_consistent", "Most Consistent")}
      {tier("most_improved", "Most Improved")}
      {tier("completion", "Finisher (completed goal)")}
      {tier("participation", "Participant")}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label className="text-[11px] text-muted-foreground">Podium winners count</Label><Input type="number" value={s.winners_count ?? 3} onChange={e => setS({ ...s, winners_count: Number(e.target.value) })} /></div>
        <div className="grid gap-1.5"><Label className="text-[11px] text-muted-foreground">Coach auto-approve limit</Label><Input type="number" value={s.coach_auto_approve_limit ?? 200} onChange={e => setS({ ...s, coach_auto_approve_limit: Number(e.target.value) })} /></div>
      </div>
      <div className="flex justify-end"><Button disabled={busy} onClick={save} className="gap-1.5"><Save size={14} /> {busy ? "Saving…" : "Save reward settings"}</Button></div>
    </Card>
  );
}

// ─── Create community challenge ───────────────────────────────────────────────
function CreateCommunity({ api, token, onClose, onDone, notify }: any) {
  const [f, setF] = useState<any>({
    title: "", description: "", start_at: "", end_at: "",
    participant_limit: "0", rules_terms: "",
    reward_title: "", reward_description: "", reward_points: "0",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const [goals, setGoals] = useState<GoalDraft[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (f.title.trim().length < 3) return notify("err", "Title too short");
    if (!f.start_at || !f.end_at) return notify("err", "Dates required");
    if (goals.length === 0) return notify("err", "Add at least one goal to the list");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("type", "community");
      Object.entries(f).forEach(([k, v]) => {
        if (k === "start_at" || k === "end_at") fd.append(k, new Date(v as string).toISOString());
        else fd.append(k, String(v ?? ""));
      });
      fd.append("goals_json", JSON.stringify(goals));
      if (cover) fd.append("cover", cover);
      const r = await fetch(`${API}/api/challenges`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) notify("err", d.message || "Failed"); else onDone();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <Card className="my-8 w-full max-w-[620px] p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-[18px] font-bold">New Community Challenge</h2><Button variant="ghost" size="icon-sm" onClick={onClose}><X size={16} /></Button></div>
        <div className="space-y-4">
          <div className="grid gap-1.5"><Label className="text-[12px]">Title</Label><Input value={f.title} onChange={e => set("title", e.target.value)} placeholder="e.g. June Step-Up Challenge" /></div>
          <div className="grid gap-1.5"><Label className="text-[12px]">Description</Label><Textarea rows={2} value={f.description} onChange={e => set("description", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className="text-[12px]">Cover image (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[12px] text-muted-foreground"><ImageIcon size={14} /> {cover ? cover.name : "Choose image"}<input type="file" accept="image/*" className="hidden" onChange={e => setCover(e.target.files?.[0] || null)} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-[12px]">Start</Label><Input type="datetime-local" value={f.start_at} onChange={e => set("start_at", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label className="text-[12px]">End</Label><Input type="datetime-local" value={f.end_at} onChange={e => set("end_at", e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label className="text-[12px]">Goals — the task list athletes complete</Label>
            <GoalBuilder api={api} goals={goals} onChange={setGoals} />
          </div>
          <RewardFields showPoints value={f} onChange={patch => setF((p: any) => ({ ...p, ...patch }))} />
          <div className="grid gap-1.5"><Label className="text-[12px]">Participant limit (0 = unlimited)</Label><Input type="number" value={f.participant_limit} onChange={e => set("participant_limit", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className="text-[12px]">Rules & terms (optional)</Label><Textarea rows={2} value={f.rules_terms} onChange={e => set("rules_terms", e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create"}</Button></div>
      </Card>
    </div>
  );
}
