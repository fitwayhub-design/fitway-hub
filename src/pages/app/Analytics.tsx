import { apiFetch } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { TrendingUp, Activity, Flame, Target } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RecentSession = { id: number; start_time: string; end_time: string; total_steps: number; total_distance_km: number; calories: number; };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--popover)", borderRadius: 12, padding: "10px 14px", fontSize: 13, boxShadow: "var(--shadow-soft-md)" }}>
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

  const loadAnalytics = () => {
    if (!user) return;
    const token = localStorage.getItem("token");
    apiFetch(`/api/analytics/me?days=${period}`, { headers: { Authorization: `Bearer ${token}` } })
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

  const emptyWeek = Array.from({ length: 7 }, (_, i) => ({ day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i], steps: 0, calories: 0 }));

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pb-4">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 pt-1">
        <h1 className="text-[26px] font-bold leading-none tracking-tight">{t("advanced_analytics") || "Analytics"}</h1>
        <Select value={period} onValueChange={(v) => setPeriod(v as "7"|"30"|"180")}>
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t("last_7_days")}</SelectItem>
            <SelectItem value="30">{t("last_30_days")}</SelectItem>
            <SelectItem value="180">{t("last_6_months")}</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {/* Metric Cards */}
      <div className="scroll-x -mx-4 mb-6 flex snap-x gap-3 px-4 pb-1">
        {metricCards.map((m) => (
          <div key={m.label} className="min-w-[164px] shrink-0 snap-start rounded-lg bg-card p-4 shadow-soft-sm">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{m.label}</span>
              <span className="grid size-7 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)` }}>
                <m.icon size={14} style={{ color: m.color }} />
              </span>
            </div>
            <p className="text-[26px] leading-none font-bold tabular-nums">{loading ? "—" : m.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="gap-4 p-5">
          <p className="text-[14px] font-bold">{t('weekly_steps')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekly.length ? weekly : emptyWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--accent-surface)" }} />
              <Bar dataKey="steps" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="gap-4 p-5">
          <p className="text-[14px] font-bold">{t('calories_trend')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weekly.length ? weekly : emptyWeek}>
              <defs><linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--red)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--red)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="calories" stroke="var(--red)" strokeWidth={2} fill="url(#calGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Summary + Sessions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="gap-4 p-5">
          <p className="text-[14px] font-bold">{t("summary") || "Summary"}</p>
          {loading ? (
            <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : (
            <div className="flex flex-col">
              {[
                { label: t("total_steps") || "Total Steps", val: metrics?.totalSteps?.toLocaleString() || 0 },
                { label: t("total_distance") || "Total Distance", val: `${(metrics?.totalDistance || 0).toFixed(2)} km` },
                { label: t("total_calories") || "Total Calories", val: metrics?.totalCalories || 0 },
              ].map((item, i, arr) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[13px] text-muted-foreground">{item.label}</span>
                    <span className="text-[13px] font-bold tabular-nums">{item.val}</span>
                  </div>
                  {i < arr.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="gap-4 p-5">
          <p className="text-[14px] font-bold">{t("recent_sessions") || "Recent Sessions"}</p>
          {loading ? (
            <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {(metrics?.recentSessions || []).slice(0, 5).map((s: RecentSession) => (
                <div key={s.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2.5">
                  <div>
                    <p className="text-[12px] text-muted-foreground">{new Date(s.start_time).toLocaleDateString()}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground/70">{s.end_time ? `${Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000)} min` : "—"}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-[14px] font-bold text-primary tabular-nums">{s.total_steps.toLocaleString()}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{s.total_distance_km.toFixed(2)} km</p>
                  </div>
                </div>
              ))}
              {(metrics?.recentSessions || []).length === 0 && <p className="text-[13px] text-muted-foreground">{t('no_sessions_yet')}</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
