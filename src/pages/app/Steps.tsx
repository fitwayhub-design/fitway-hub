import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Activity, Flame, MapPin, Clock, Plus, Trash2, Play, CheckCircle } from "lucide-react";
import { calculateStepsFromDistance, estimateCaloriesBurned, type UserMetrics, type ActivityMode } from "@/lib/stepCalculations";
import MapTracker from "@/components/app/MapTracker";
import { Link } from "react-router-dom";

interface Entry { id: number; date: string; steps: number; calories_burned?: number; distance_km?: number; tracking_mode?: string; }

function Ring({ pct, size = 200, stroke = 14, color = "var(--accent)", glow = true, children }: any) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-surface)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ filter: glow && pct > 0 ? `drop-shadow(0 0 8px ${color})` : "none", transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export default function Steps() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<"today" | "history">("today");
  const [mode, setMode] = useState<"manual" | "live">("manual");
  const [stepsInput, setStepsInput] = useState("");
  const [distInput, setDistInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [todayEntry, setTodayEntry] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveActive, setLiveActive] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const [liveStart, setLiveStart] = useState<Date | null>(null);
  const [elapsedTimer, setElapsedTimer] = useState(0);
  const today = new Date().toISOString().split("T")[0];

  const stepGoal = user?.stepGoal || 10000;
  const steps = todayEntry?.steps || 0;
  const pct = Math.min(100, (steps / stepGoal) * 100);
  const calories = todayEntry?.calories_burned || Math.round(steps * 0.04);
  const dist = todayEntry?.distance_km ? Number(todayEntry.distance_km).toFixed(2) : (steps / 1312).toFixed(2);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [todayR, histR] = await Promise.all([
        fetch(`${getApiBase()}/api/steps/${today}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${getApiBase()}/api/steps?limit=14`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      setTodayEntry(todayR?.entry || null);
      setHistory(histR?.entries || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);
  useAutoRefresh(load);

  // Ticking timer for live tracking
  useEffect(() => {
    if (!liveStart) { setElapsedTimer(0); return; }
    const id = setInterval(() => setElapsedTimer(Math.floor((Date.now() - liveStart.getTime()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [liveStart]);

  const metrics: UserMetrics = { weight: user?.weight || 70, height: user?.height || 170, gender: (user?.gender as any) || "male" };

  const handleSave = async () => {
    const s = parseInt(stepsInput) || (distInput ? calculateStepsFromDistance(parseFloat(distInput), metrics, "walking") : 0);
    if (!s) return flash("❌ Enter steps or distance");
    setSaving(true);
    try {
      const cal = estimateCaloriesBurned(s, metrics.weight, metrics.height);
      const km = parseFloat(distInput) || s / 1312;
      const r = await fetch(`${getApiBase()}/api/steps/${today}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ steps: s, calories_burned: cal, distance_km: km, tracking_mode: "manual" }),
      });
      if (r.ok) { flash("✅ Saved!"); setStepsInput(""); setDistInput(""); await load(); }
      else flash("❌ Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    await fetch(`${getApiBase()}/api/steps/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const elapsed = liveStart ? elapsedTimer : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timerDisplay = liveStart ? `${mins}:${String(secs).padStart(2, "0")}` : `${Math.round(steps / 100)}`;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-heading)" }}>Activity</h1>
        <div style={{ display: "flex", gap: 1, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {(["today", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 700 : 400, background: tab === t ? "var(--accent)" : "transparent", color: tab === t ? "#000000" : "var(--text-muted)", transition: "all 0.15s" }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {msg && <div style={{ margin: "0 16px 12px", padding: "10px 14px", borderRadius: 12, background: msg.startsWith("✅") ? "rgba(74,222,128,0.1)" : "rgba(251,113,133,0.1)", border: `1px solid ${msg.startsWith("✅") ? "var(--green)" : "var(--red)"}`, fontSize: 13, fontWeight: 600, color: msg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{msg}</div>}

      {tab === "today" && (
        <>
          {/* Big ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 16px 24px" }}>
            <Ring pct={pct} size={200} stroke={14} color={pct >= 100 ? "var(--green)" : "var(--accent)"}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: pct >= 100 ? "var(--green)" : "var(--accent)" }}>
                  {steps >= 10000 ? `${(steps/1000).toFixed(1)}k` : steps.toLocaleString()}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>/ {stepGoal.toLocaleString()} steps</p>
                {pct >= 100 && <p style={{ fontSize: 12, color: "var(--green)", marginTop: 4, fontWeight: 700 }}>🎉 Goal reached!</p>}
              </div>
            </Ring>

            {/* Mini stats row */}
            <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
              {[
                { icon: Flame, v: `${calories}`, u: "kcal", c: "#FB7185" },
                { icon: MapPin, v: dist, u: "km", c: "#60A5FA" },
                { icon: Clock, v: timerDisplay, u: liveStart ? "elapsed" : "min", c: "#FBBF24" },
              ].map(({ icon: Icon, v, u, c }) => (
                <div key={u} style={{ textAlign: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${c}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                    <Icon size={18} color={c} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 800 }}>{v}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{u}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 1, margin: "0 16px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <button onClick={() => setMode("manual")} style={{ flex: 1, padding: "12px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: mode === "manual" ? 700 : 400, background: mode === "manual" ? "var(--accent)" : "transparent", color: mode === "manual" ? "#000000" : "var(--text-muted)", transition: "all 0.15s" }}>
              ✏️ Manual Entry
            </button>
            <button onClick={() => setMode("live")} style={{ flex: 1, padding: "12px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: mode === "live" ? 700 : 400, background: mode === "live" ? "var(--accent)" : "transparent", color: mode === "live" ? "#000000" : "var(--text-muted)", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              📍 GPS Track
            </button>
          </div>

          {mode === "manual" && (
            <div style={{ margin: "0 16px", padding: "16px", borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Log Today's Steps</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { label: "Steps", val: stepsInput, set: setStepsInput, ph: "e.g. 8500" },
                  { label: "Distance (km)", val: distInput, set: setDistInput, ph: "e.g. 6.5" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label}>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>{label}</p>
                    <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving || (!stepsInput && !distInput)}
                style={{ width: "100%", padding: "13px", borderRadius: 12, background: (!stepsInput && !distInput) || saving ? "var(--bg-surface)" : "var(--accent)", border: "none", color: (!stepsInput && !distInput) || saving ? "var(--text-muted)" : "#000000", fontWeight: 700, fontSize: 14, cursor: (!stepsInput && !distInput) || saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Plus size={16} /> {saving ? "Saving…" : "Save Activity"}
              </button>
            </div>
          )}

          {mode === "live" && (
            <div style={{ margin: "0 16px", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
              <MapTracker />
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <div style={{ padding: "0 16px" }}>
          {loading && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 30 }}>Loading…</p>}
          {!loading && history.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Activity size={48} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No activity logged yet</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Start tracking your steps!</p>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map(e => {
              const d = new Date(e.date); const isToday = e.date === today;
              const epct = Math.min(100, (e.steps / stepGoal) * 100);
              return (
                <div key={e.id} style={{ padding: "14px 16px", borderRadius: 14, background: "var(--bg-card)", border: `1px solid ${isToday ? "var(--accent)" : "var(--border)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{isToday ? "Today" : d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{e.tracking_mode === "live" ? "📍 GPS" : "✏️ Manual"}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: epct >= 100 ? "var(--green)" : "var(--accent)" }}>{e.steps.toLocaleString()}</p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)" }}>steps</p>
                      </div>
                      {epct >= 100 && <CheckCircle size={16} color="var(--green)" />}
                      <button onClick={() => handleDelete(e.id)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={13} color="var(--red)" />
                      </button>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "var(--bg-surface)", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${epct}%`, background: epct >= 100 ? "var(--green)" : "var(--accent)", borderRadius: 99 }} />
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                    {e.calories_burned && <span><Flame size={11} style={{ display: "inline", marginRight: 3 }} />{Math.round(e.calories_burned)} kcal</span>}
                    {e.distance_km && <span><MapPin size={11} style={{ display: "inline", marginRight: 3 }} />{Number(e.distance_km).toFixed(2)} km</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
