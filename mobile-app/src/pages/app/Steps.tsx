import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Activity, Flame, MapPin, Clock, Plus, Trash2, Play, CheckCircle, PencilLine } from "lucide-react";
import { calculateStepsFromDistance, estimateCaloriesBurned, type UserMetrics, type ActivityMode } from "@/lib/stepCalculations";
import MapTracker from "@/components/app/MapTracker";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface Entry { id: number; date: string; steps: number; calories_burned?: number; distance_km?: number; tracking_mode?: string; }

function Ring({ pct, size = 200, stroke = 14, color = "var(--main)", glow = true, children }: any) {
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

  const load = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
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
  // Silent refresh — update in place without flashing the loading state.
  useAutoRefresh(() => load(true));

  // Ticking timer for live tracking
  useEffect(() => {
    if (!liveStart) { setElapsedTimer(0); return; }
    const id = setInterval(() => setElapsedTimer(Math.floor((Date.now() - liveStart.getTime()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [liveStart]);

  const metrics: UserMetrics = { weight: user?.weight || 70, height: user?.height || 170, gender: (user?.gender as any) || "male" };

  // When the athlete types a distance, auto-convert it to steps and fill the
  // steps field. The steps field stays editable so they can fine-tune it.
  const handleDistanceChange = (value: string) => {
    setDistInput(value);
    const km = parseFloat(value);
    if (value !== "" && !isNaN(km) && km > 0) {
      setStepsInput(String(calculateStepsFromDistance(km, metrics, "walking")));
    } else if (value === "") {
      setStepsInput("");
    }
  };

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

  const goalReached = pct >= 100;
  const ringColor = goalReached ? "var(--green)" : "var(--main)";
  const miniStats = [
    { icon: Flame, v: `${calories}`, u: "kcal", c: "var(--red)" },
    { icon: MapPin, v: dist, u: "km", c: "var(--secondary)" },
    { icon: Clock, v: timerDisplay, u: liveStart ? "elapsed" : "min", c: "var(--amber)" },
  ];

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 pt-1 pb-5">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Activity</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "today" | "history")}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {msg && (
        <div
          className="mb-4 rounded-md px-4 py-2.5 text-[13px] font-semibold"
          style={{
            backgroundColor: msg.startsWith("✅") ? "color-mix(in srgb, var(--green) 12%, transparent)" : "color-mix(in srgb, var(--red) 12%, transparent)",
            color: msg.startsWith("✅") ? "var(--green)" : "var(--red)",
          }}
        >
          {msg}
        </div>
      )}

      {tab === "today" && (
        <div className="space-y-4">
          {/* Big ring */}
          <Card className="items-center gap-0 p-6">
            <Ring pct={pct} size={200} stroke={14} color={ringColor}>
              <div className="text-center">
                <p className="text-[40px] font-extrabold leading-none tabular-nums" style={{ color: ringColor }}>
                  {steps >= 10000 ? `${(steps/1000).toFixed(1)}k` : steps.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">/ {stepGoal.toLocaleString()} steps</p>
                {pct >= 100 && <p className="mt-1 text-[12px] font-bold" style={{ color: "var(--green)" }}>🎉 Goal reached!</p>}
              </div>
            </Ring>

            {/* Mini stats row */}
            <div className="mt-5 flex gap-5">
              {miniStats.map(({ icon: Icon, v, u, c }) => (
                <div key={u} className="text-center">
                  <span className="mx-auto mb-1.5 grid size-10 place-items-center rounded-md" style={{ backgroundColor: `color-mix(in srgb, ${c} 12%, transparent)` }}>
                    <Icon size={18} color={c} strokeWidth={2} />
                  </span>
                  <p className="text-[16px] font-bold tabular-nums">{v}</p>
                  <p className="text-[11px] text-muted-foreground">{u}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Mode toggle */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "live")}>
            <TabsList className="w-full">
              <TabsTrigger value="manual"><PencilLine size={15} /> Manual Entry</TabsTrigger>
              <TabsTrigger value="live"><MapPin size={15} /> GPS Track</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "manual" && (
            <Card className="gap-0 p-5">
              <p className="mb-3.5 text-[15px] font-semibold">Log Today's Steps</p>
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="dist-input" className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Distance (km)</Label>
                  <Input id="dist-input" type="number" inputMode="decimal" value={distInput} onChange={e => handleDistanceChange(e.target.value)} placeholder="e.g. 6.5" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="steps-input" className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Steps</Label>
                  <Input id="steps-input" type="number" inputMode="numeric" value={stepsInput} onChange={e => setStepsInput(e.target.value)} placeholder="auto from distance" />
                </div>
              </div>
              {distInput && stepsInput && (
                <p className="mb-3 -mt-1 text-[11px] text-muted-foreground">
                  ≈ {Number(stepsInput).toLocaleString()} steps from {distInput} km — edit the steps field to adjust.
                </p>
              )}
              <Button onClick={handleSave} disabled={saving || (!stepsInput && !distInput)} className="w-full">
                <Plus size={16} /> {saving ? "Saving…" : "Save Activity"}
              </Button>
            </Card>
          )}

          {mode === "live" && (
            <div className="overflow-hidden rounded-lg shadow-soft-sm">
              <MapTracker />
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div>
          {loading && (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          )}
          {!loading && history.length === 0 && (
            <div className="py-10 text-center">
              <Activity size={48} className="mx-auto mb-3 text-muted-foreground" strokeWidth={1.75} />
              <p className="font-semibold">No activity logged yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Start tracking your steps!</p>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {history.map(e => {
              const d = new Date(e.date); const isToday = e.date === today;
              const epct = Math.min(100, (e.steps / stepGoal) * 100);
              const entryColor = epct >= 100 ? "var(--green)" : "var(--main)";
              return (
                <Card key={e.id} className={`gap-0 p-4 ${isToday ? "ring-1 ring-primary/40" : ""}`}>
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold">{isToday ? "Today" : d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                        {e.tracking_mode === "live"
                          ? <><MapPin size={11} /> GPS</>
                          : <><PencilLine size={11} /> Manual</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-end">
                        <p className="text-[20px] font-bold tabular-nums" style={{ color: entryColor }}>{e.steps.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">steps</p>
                      </div>
                      {epct >= 100 && <CheckCircle size={16} color="var(--green)" />}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(e.id)}
                        aria-label="Delete entry"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  <Progress value={epct} className="h-1" />
                  <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                    {e.calories_burned ? <span className="inline-flex items-center gap-1"><Flame size={11} />{Math.round(e.calories_burned)} kcal</span> : null}
                    {e.distance_km ? <span className="inline-flex items-center gap-1"><MapPin size={11} />{Number(e.distance_km).toFixed(2)} km</span> : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
