import { useState, useEffect, useCallback } from "react";
import { Trophy, Plus, Trash2, RefreshCw, CheckCircle, AlertTriangle, Users, Pencil, X, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { avatarUrl } from "@/lib/avatar";

const API = getApiBase();

interface Challenge {
  id: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  image_url?: string | null;
  participant_count?: number;
  creator_name?: string | null;
  creator_avatar?: string | null;
  created_at?: string;
}

type Draft = { title: string; description: string; start_date: string; end_date: string; image_url: string };

const emptyDraft: Draft = { title: "", description: "", start_date: "", end_date: "", image_url: "" };

export default function AdminChallenges() {
  const { token } = useAuth();
  const { lang } = useI18n();
  const l = (en: string, ar: string) => (lang === "ar" ? ar : en);

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);

  const notify = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3000);
  };

  const api = useCallback((path: string, init?: RequestInit) =>
    fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } }), [token]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api("/api/admin/community/challenges");
      const data = await res.json();
      setChallenges(data.challenges || []);
    } catch {
      notify("err", l("Failed to load challenges", "فشل تحميل التحديات"));
    } finally {
      setLoading(false);
    }
  }, [api]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!draft.title.trim()) { notify("err", l("Title is required", "العنوان مطلوب")); return; }
    setBusy(true);
    try {
      const res = await api("/api/admin/community/challenges", { method: "POST", body: JSON.stringify(draft) });
      if (!res.ok) throw new Error();
      setDraft(emptyDraft);
      setCreating(false);
      await load();
      notify("ok", l("Challenge created", "تم إنشاء التحدي"));
    } catch {
      notify("err", l("Failed to create challenge", "فشل إنشاء التحدي"));
    } finally { setBusy(false); }
  };

  const startEdit = (c: Challenge) => {
    setEditId(c.id);
    setEditDraft({
      title: c.title || "",
      description: c.description || "",
      start_date: c.start_date || "",
      end_date: c.end_date || "",
      image_url: c.image_url || "",
    });
  };

  const saveEdit = async () => {
    if (editId == null) return;
    setBusy(true);
    try {
      const res = await api(`/api/admin/community/challenges/${editId}`, { method: "PATCH", body: JSON.stringify(editDraft) });
      if (!res.ok) throw new Error();
      setEditId(null);
      await load();
      notify("ok", l("Challenge updated", "تم تحديث التحدي"));
    } catch {
      notify("err", l("Failed to update challenge", "فشل تحديث التحدي"));
    } finally { setBusy(false); }
  };

  const remove = async (c: Challenge) => {
    if (!confirm(l(`Delete challenge "${c.title}"? This also removes its participants.`, `حذف التحدي "${c.title}"؟ سيؤدي ذلك أيضًا إلى إزالة المشاركين.`))) return;
    try {
      const res = await api(`/api/admin/community/challenges/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setChallenges(prev => prev.filter(x => x.id !== c.id));
      notify("ok", l("Deleted", "تم الحذف"));
    } catch {
      notify("err", l("Delete failed", "فشل الحذف"));
    }
  };

  const draftFields = (d: Draft, set: (d: Draft) => void) => (
    <div className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label>{l("Title", "العنوان")}</Label>
        <Input value={d.title} onChange={e => set({ ...d, title: e.target.value })} placeholder={l("e.g. 30-Day Step Challenge", "مثال: تحدي 30 يوم للخطوات")} />
      </div>
      <div className="grid gap-1.5">
        <Label>{l("Description", "الوصف")}</Label>
        <Textarea value={d.description} onChange={e => set({ ...d, description: e.target.value })} rows={3} className="resize-none" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{l("Start date", "تاريخ البدء")}</Label>
          <Input type="date" value={d.start_date} onChange={e => set({ ...d, start_date: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>{l("End date", "تاريخ الانتهاء")}</Label>
          <Input type="date" value={d.end_date} onChange={e => set({ ...d, end_date: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>{l("Image URL", "رابط الصورة")}</Label>
        <Input value={d.image_url} onChange={e => set({ ...d, image_url: e.target.value })} placeholder="/uploads/challenge.png" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed end-4 top-4 z-[9999] flex items-center gap-2 rounded-md bg-card px-4 py-3 text-[13px] font-semibold text-foreground shadow-soft-lg ring-1 ring-inset ${toast.kind === "ok" ? "ring-[color-mix(in_srgb,var(--green)_40%,transparent)]" : "ring-destructive/40"}`}>
          {toast.kind === "ok" ? <CheckCircle size={16} strokeWidth={2} className="text-[var(--green)]" /> : <AlertTriangle size={16} strokeWidth={2} className="text-destructive" />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
            <Trophy size={20} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">{l("Challenges", "التحديات")}</h1>
            <p className="text-[13px] text-muted-foreground">{l("Create and manage community challenges", "إنشاء وإدارة تحديات المجتمع")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} strokeWidth={2} /> {l("Refresh", "تحديث")}</Button>
          <Button size="sm" onClick={() => { setCreating(c => !c); setDraft(emptyDraft); }}>
            {creating ? <X size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
            {creating ? l("Cancel", "إلغاء") : l("New Challenge", "تحدٍ جديد")}
          </Button>
        </div>
      </div>

      {/* Create form */}
      {creating && (
        <Card className="gap-0 p-5">
          <p className="mb-3.5 text-[15px] font-semibold">{l("New challenge", "تحدٍ جديد")}</p>
          {draftFields(draft, setDraft)}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); setDraft(emptyDraft); }}>{l("Cancel", "إلغاء")}</Button>
            <Button size="sm" onClick={create} disabled={busy}><Save size={14} strokeWidth={2} /> {busy ? l("Saving...", "جاري الحفظ...") : l("Create", "إنشاء")}</Button>
          </div>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="grid gap-3.5">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : challenges.length === 0 ? (
        <Card className="p-10 text-center text-[13px] text-muted-foreground">{l("No challenges yet.", "لا توجد تحديات بعد.")}</Card>
      ) : (
        <div className="grid gap-3.5">
          {challenges.map(c => (
            <Card key={c.id} className="gap-0 overflow-hidden p-0">
              {editId === c.id ? (
                <div className="p-5">
                  {draftFields(editDraft, setEditDraft)}
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditId(null)}>{l("Cancel", "إلغاء")}</Button>
                    <Button size="sm" onClick={saveEdit} disabled={busy}><Save size={14} strokeWidth={2} /> {l("Save", "حفظ")}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4 p-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {c.image_url
                      ? <img src={c.image_url.startsWith("http") ? c.image_url : `${API}${c.image_url}`} alt={c.title} className="size-full object-cover" />
                      : <span className="grid size-full place-items-center text-muted-foreground"><Trophy size={20} strokeWidth={2} /></span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-foreground">{c.title}</p>
                      <Badge variant="secondary" className="gap-1 px-2 py-0 text-[10px]"><Users size={11} strokeWidth={2} /> {c.participant_count || 0}</Badge>
                    </div>
                    {c.description && <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{c.description}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {(c.start_date || c.end_date) && <span>{c.start_date || "—"} → {c.end_date || "—"}</span>}
                      {c.creator_name && (
                        <span className="inline-flex items-center gap-1.5">
                          <img src={avatarUrl({ avatar: c.creator_avatar, name: c.creator_name } as any)} alt="" className="size-4 rounded-full object-cover" />
                          {c.creator_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="outline" size="icon-sm" onClick={() => startEdit(c)} aria-label={l("Edit", "تعديل")}><Pencil size={14} strokeWidth={2} /></Button>
                    <Button variant="outline" size="icon-sm" className="text-destructive" onClick={() => remove(c)} aria-label={l("Delete", "حذف")}><Trash2 size={14} strokeWidth={2} /></Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
