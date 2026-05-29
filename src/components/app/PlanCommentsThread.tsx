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

  if (!planId) return null;

  return (
    <div style={{ marginTop: 8, borderTop: compact && !open ? "none" : "1px dashed var(--border)", paddingTop: compact && !open ? 0 : 8 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: openCount ? "var(--main)" : "var(--text-muted)", cursor: "pointer", padding: 0, fontWeight: 600 }}>
        <MessageCircle size={12} /> {comments.length === 0 ? "Add comment" : `${comments.length} comment${comments.length === 1 ? "" : "s"}${openCount > 0 ? ` · ${openCount} open` : ""}`}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 10, background: c.status === "resolved" ? "rgba(74,222,128,0.08)" : "var(--bg-surface)", border: `1px solid ${c.status === "resolved" ? "rgba(74,222,128,0.25)" : "var(--border)"}` }}>
              <img src={c.author_avatar || getAvatar(c.author_id, null, null, c.author_name)} alt="" style={{ width: 26, height: 26, borderRadius: "50%" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{c.author_name}</span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{c.author_role}</span>
                  {c.status === "resolved" && <Check size={11} color="var(--green)" />}
                </div>
                <p style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap", textDecoration: c.status === "resolved" ? "line-through" : "none", opacity: c.status === "resolved" ? 0.65 : 1 }}>{c.body}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {c.status === "open" ? (
                    <button onClick={() => resolve(c.id, "resolved")} disabled={busy}
                      style={{ background: "none", border: "none", fontSize: 10, color: "var(--green)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
                      <Check size={11} /> Mark done
                    </button>
                  ) : (
                    <button onClick={() => resolve(c.id, "open")} disabled={busy}
                      style={{ background: "none", border: "none", fontSize: 10, color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
                      <RefreshCw size={10} /> Reopen
                    </button>
                  )}
                  {c.author_id === user?.id && (
                    <button onClick={() => remove(c.id)} disabled={busy}
                      style={{ background: "none", border: "none", fontSize: 10, color: "var(--red)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
                      <X size={10} /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} placeholder="Write a comment…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 12 }} />
            <button onClick={submit} disabled={busy || !draft.trim()}
              style={{ padding: "6px 12px", borderRadius: 10, border: "none", background: "var(--main)", color: "#000", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700 }}>
              <Send size={11} /> Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
