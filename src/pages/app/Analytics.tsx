import { getApiBase } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { TrendingUp, Activity, Flame, Target } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { useAutoRefresh } from "@/lib/useAutoRefresh";

type RecentSession = { id: number; start_time: string; end_time: string; total_steps: number; total_distance_km: number; calories: number; };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "10px 14px", fontSize: 13 }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ color: "var(--accent)", fontWeight: 700 }}>{p.value?.toLocaleString()} {p.name}</p>)}
    </div>
  );
};

export default function Analytics() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [period, setPeriod] = useState<"7"|"30"|"180">("30");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const loadAnalytics = () => {
    if (!user) return;
    const token = localStorage.getItem("token");
    fetch(getApiBase() + `/api/analytics/me?days=${period}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setMetrics(d)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadAnalytics();
  }, [user, period]);
  useAutoRefresh(loadAnalytics);



  const weekly = metrics?.weekly || [];
  const avgSteps = weekly.length ? Math.round(weekly.reduce((a: number, b: any) => a + b.steps, 0) / 7) : 0;
  const activeDays = weekly.filter((d: any) => d.steps > 0).length;
  const consistency = Math.round((activeDays / 7) * 100);

  const metricCards = [
    { label: t("avg_daily_steps") || "Avg Daily Steps", value: avgSteps.toLocaleString(), color: "var(--accent)", icon: Activity },
    { label: t("total_sessions") || "Total Sessions", value: (metrics?.sessionsCount || 0).toString(), color: "var(--blue)", icon: Target },
    { label: t("calories_burned") || "Calories Burned", value: (metrics?.totalCalories || 0).toLocaleString(), color: "var(--red)", icon: Flame },
    { label: t("consistency") || "Consistency", value: `${consistency}%`, color: "var(--cyan)", icon: TrendingUp },
  ];

  return (
    <div style={{ padding: isMobile ? "16px 12px 40px" : "24px 20px 40px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-en)", fontSize: "clamp(20px, 4vw, 28px)", fontWeight: 700 }}>{t("advanced_analytics") || "Analytics"}</h1>
        <select value={period} onChange={e => setPeriod(e.target.value as "7"|"30"|"180")} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "8px 14px", fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
            <option value="7">{t("last_7_days")}</option><option value="30">{t("last_30_days")}</option><option value="180">{t("last_6_months")}</option>
          </select>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, overflowX: "auto", paddingBottom: 4, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
        {metricCards.map((m) => (
          <div key={m.label} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "16px 18px", minWidth: 160, flex: "0 0 auto", scrollSnapAlign: "start" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: "var(--radius-full)", backgroundColor: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <m.icon size={14} color={m.color} />
              </div>
            </div>
            <p style={{ fontFamily: "var(--font-en)", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{loading ? "—" : m.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Weekly steps */}
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 16px" }}>
          <p style={{ fontFamily: "var(--font-en)", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{t('weekly_steps')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekly.length ? weekly : Array.from({length:7},(_,i)=>({day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i],steps:0,calories:0}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="steps" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Calories area */}
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 16px" }}>
          <p style={{ fontFamily: "var(--font-en)", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{t('calories_trend')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weekly.length ? weekly : Array.from({length:7},(_,i)=>({day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i],steps:0,calories:0}))}>
              <defs><linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#FF4444" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="calories" stroke="#FF4444" strokeWidth={2} fill="url(#calGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary + Sessions */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 20px" }}>
          <p style={{ fontFamily: "var(--font-en)", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{t("summary") || "Summary"}</p>
          {loading ? <p style={{ color: "var(--text-muted)" }}>{t('loading_text')}</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: t("total_steps") || "Total Steps", val: metrics?.totalSteps?.toLocaleString() || 0 },
                { label: t("total_distance") || "Total Distance", val: `${(metrics?.totalDistance || 0).toFixed(2)} km` },
                { label: t("total_calories") || "Total Calories", val: metrics?.totalCalories || 0 },
                { label: t("premium_sessions") || "Sessions", val: metrics?.sessionsCount || 0 },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{item.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 20px" }}>
          <p style={{ fontFamily: "var(--font-en)", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{t("recent_sessions") || "Recent Sessions"}</p>
          {loading ? <p style={{ color: "var(--text-muted)" }}>{t('loading_text')}</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(metrics?.recentSessions || []).slice(0, 5).map((s: RecentSession) => (
                <div key={s.id} style={{ padding: "10px 12px", backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-full)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(s.start_time).toLocaleDateString()}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s.end_time ? `${Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000)} min` : "—"}</p>
                  </div>
                  <div style={{ textAlign: "end" }}>
                    <p style={{ fontFamily: "var(--font-en)", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{s.total_steps.toLocaleString()}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.total_distance_km.toFixed(2)} km</p>
                  </div>
                </div>
              ))}
              {(metrics?.recentSessions || []).length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t('no_sessions_yet')}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
