/**
 * PlanCommentsThread
 * ─────────────────────────────────────────────────────────
 * Asana-style thread of comments attached to a workout-plan exercise or a
 * nutrition-plan meal. Either side (coach or athlete) can write notes; the
 * athlete (or coach) can mark a thread "resolved" so the coach knows the
 * action was done, or reply to keep it open.
 *
 * Provide ONE of workoutPlanId / nutritionPlanId, plus the matching key
 * (exerciseKey or mealKey).
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import { getAvatar } from "@/lib/avatar";
import { Check, MessageCircle, X, RefreshCw, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface Comment {
  id: number;
  workout_plan_id: number | null;
  nutrition_plan_id: number | null;
  exercise_key: string | null;
  meal_key: string | null;
  author_id: number;
  author_role: string;
  author_name: string;
  author_avatar?: string;
  body: string;
  status: "open" | "resolved";
  parent_id: number | null;
  created_at: string;
}

interface Props {
  workoutPlanId?: number | null;
  nutritionPlanId?: number | null;
  exerciseKey?: string | null;
  mealKey?: string | null;
  compact?: boolean;
}

export default function PlanCommentsThread({ workoutPlanId, nutritionPlanId, exerciseKey, mealKey, compact }: Props) {
  const { user, token } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [open, setOpen] = useState(!compact);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const planId = workoutPlanId || nutritionPlanId;
  const key = exerciseKey || mealKey;

  const api = useCallback((path: string, init?: RequestInit) =>
    fetch(getApiBase() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } }), [token]);

  const load = useCallback(async () => {
    if (!planId) return;
    const param = workoutPlanId ? `workout_plan_id=${workoutPlanId}` : `nutrition_plan_id=${nutritionPlanId}`;
    try {
      const r = await api(`/api/tickets/plan-comments/list?${param}`);
      if (r.ok) {
        const d = await r.json();
        const all: Comment[] = d.comments || [];
        const filtered = key ? all.filter(c => (c.exercise_key === key) || (c.meal_key === key)) : all;
        setComments(filtered);
      }
    } catch { /* ignore — no comments yet */ }
  }, [api, workoutPlanId, nutritionPlanId, planId, key]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!draft.trim() || !planId) return;
    setBusy(true);
    try {
      const body: any = { body: draft.trim() };
      if (workoutPlanId) body.workout_plan_id = workoutPlanId;
      if (nutritionPlanId) body.nutrition_plan_id = nutritionPlanId;
      if (exerciseKey) body.exercise_key = exerciseKey;
      if (mealKey) body.meal_key = mealKey;
      const r = await api("/api/tickets/plan-comments", { method: "POST", body: JSON.stringify(body) });
      if (r.ok) { setDraft(""); await load(); }
    } finally { setBusy(false); }
  };
  const resolve = async (id: number, status: "open" | "resolved") => {
    setBusy(true);
    try { const r = await api(`/api/tickets/plan-comments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); if (r.ok) await load(); }
    finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    setBusy(true);
    try { const r = await api(`/api/tickets/plan-comments/${id}`, { method: "DELETE" }); if (r.ok) await load(); }
    finally { setBusy(false); }
  };

  const openCount = comments.filter(c => c.status === "open").length;
  const myId = Number(user?.id);

  if (!planId) return null;

  return (
    <div className={compact && !open ? "mt-2" : "mt-2 pt-2"}>
      {!(compact && !open) && <Separator className="mb-2" />}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold transition-opacity hover:opacity-80 ${openCount ? "text-primary" : "text-muted-foreground"}`}
      >
        <MessageCircle size={15} strokeWidth={2} />
        {comments.length === 0 ? "Add comment" : `${comments.length} comment${comments.length === 1 ? "" : "s"}${openCount > 0 ? ` · ${openCount} open` : ""}`}
      </button>

      {open && (
        <div className="mt-1 flex flex-col gap-2">
          {comments.map(c => {
            const resolved = c.status === "resolved";
            return (
              <div
                key={c.id}
                className={`flex gap-2.5 rounded-md p-3 ${resolved ? "bg-[color-mix(in_srgb,var(--green)_8%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--green)_25%,transparent)]" : "bg-muted"}`}
              >
                <Avatar className="size-7">
                  <AvatarImage src={c.author_avatar || getAvatar(c.author_id, null, null, c.author_name)} alt="" />
                  <AvatarFallback className="text-[10px]">{(c.author_name || "U").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-foreground">{c.author_name}</span>
                    <Badge variant="muted" className="px-1.5 py-0 text-[9px] uppercase tracking-[0.08em]">{c.author_role}</Badge>
                    {resolved && <Check size={12} strokeWidth={2.5} className="text-[var(--green)]" aria-label="Resolved" />}
                  </div>
                  <p className={`whitespace-pre-wrap text-[13px] leading-relaxed ${resolved ? "text-muted-foreground line-through opacity-80" : "text-foreground"}`}>
                    {c.body}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {c.status === "open" ? (
                      <button
                        type="button"
                        onClick={() => resolve(c.id, "resolved")}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--green)] transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        <Check size={12} strokeWidth={2.5} /> Mark done
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => resolve(c.id, "open")}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        <RefreshCw size={11} strokeWidth={2} /> Reopen
                      </button>
                    )}
                    {c.author_id === myId && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        <X size={11} strokeWidth={2.5} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              placeholder="Write a comment…"
              className="h-10 flex-1 text-[13px]"
            />
            <Button
              size="icon-sm"
              onClick={submit}
              disabled={busy || !draft.trim()}
              aria-label="Send comment"
            >
              <Send size={16} strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
