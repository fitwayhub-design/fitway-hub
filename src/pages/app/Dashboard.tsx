import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ChevronRight, Play, Star, Dumbbell, Activity, BookOpen, Users, Phone, MapPin, ArrowRight, TrendingUp, BadgeCheck } from "lucide-react";
import { avatarUrl } from "@/lib/avatar";
import { fetchPublicBlogs, type BlogPost } from "@/lib/blogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

/* ── Section header helper ─────────────────────────────────── */
function SectionHeader({ title, linkTo }: { title: string; linkTo: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[19px] font-bold leading-none tracking-tight">{title}</h2>
      <Link
        to={linkTo}
        className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-primary transition-opacity hover:opacity-75"
      >
        See all <ChevronRight size={15} />
      </Link>
    </div>
  );
}

/* Horizontal scroll rail — bleeds to the screen edges, hides its scrollbar. */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="scroll-x -mx-4 flex snap-x snap-mandatory gap-3 px-4 pb-1">
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user, token, updateUser } = useAuth();
  const { lang, t } = useI18n();
  const navigate = useNavigate();

  const [steps, setSteps] = useState(0);
  const [ads, setAds] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<Record<string, any>>({});

  const firstName = user?.name?.split(" ")[0] || "Athlete";
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Good Night" : hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const stepGoal = Number(user?.stepGoal || (user as any)?.step_goal || 10000);
  const goalPct = Math.max(0, Math.min(100, Math.round((steps / Math.max(stepGoal, 1)) * 100)));
  const caloriesEstimate = Math.round(steps * 0.04);

  /* helpers for config booleans (default true) */
  const vis = (key: string) => cfg[key] !== false && cfg[key] !== '0' && cfg[key] !== 'false';
  const txt = (key: string, fallback: string) => (cfg[key] && String(cfg[key]).trim()) || fallback;

  useEffect(() => {
    if (!token) return;
    const today = new Date().toISOString().split("T")[0];
    setLoading(true);
    Promise.allSettled([
      apiFetch(`/api/steps/${today}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      apiFetch(`/api/coach/ads/public/home`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      apiFetch(`/api/workouts/videos`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      apiFetch(`/api/coaching/coaches`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      apiFetch(`/api/admin/dashboard-config`).then(r => r.json()),
    ]).then(([stepsR, adsR, vidsR, coachR, cfgR]) => {
      if (stepsR.status === "fulfilled") { const s = stepsR.value?.entry?.steps || 0; setSteps(s); if (s) updateUser({ steps: s }); }
      if (adsR.status === "fulfilled") {
        const homeAds = (adsR.value?.ads || []).slice(0, 1);
        if (homeAds.length > 0) {
          setAds(homeAds);
        } else {
          apiFetch(`/api/coach/ads/public`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : { ads: [] })
            .then(d => setAds((d?.ads || []).slice(0, 1)))
            .catch(() => setAds([]));
        }
      }
      if (vidsR.status === "fulfilled") setVideos((vidsR.value?.videos || []).slice(0, 6));
      if (coachR.status === "fulfilled") {
        const raw = (coachR.value?.coaches || []);
        // Sort: certified first, then rotate by most reviewed / nearest / most subscribed
        const sorted = [...raw].sort((a: any, b: any) => {
          const aCert = a.certified === 1 && a.certified_until && new Date(a.certified_until) > new Date() ? 1 : 0;
          const bCert = b.certified === 1 && b.certified_until && new Date(b.certified_until) > new Date() ? 1 : 0;
          if (bCert !== aCert) return bCert - aCert;
          // Rotate criteria: review_count, sessions_count, avg_rating
          const aScore = (Number(a.review_count) || 0) + (Number(a.sessions_count) || 0) * 0.5 + (Number(a.avg_rating) || 0) * 10;
          const bScore = (Number(b.review_count) || 0) + (Number(b.sessions_count) || 0) * 0.5 + (Number(b.avg_rating) || 0) * 10;
          return bScore - aScore;
        });
        setCoaches(sorted.slice(0, 6));
      }
      if (cfgR.status === "fulfilled") setCfg(cfgR.value?.config || {});
      setLoading(false);
    });
    fetchPublicBlogs("", lang as "en" | "ar").then(b => setBlogs(b.slice(0, 6))).catch(() => {});
  }, [token]);
  useAutoRefresh(() => {
    if (!token) return;
    const today = new Date().toISOString().split("T")[0];
    Promise.allSettled([
      apiFetch(`/api/steps/${today}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      apiFetch(`/api/coach/ads/public/home`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      apiFetch(`/api/workouts/videos`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      apiFetch(`/api/coaching/coaches`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      apiFetch(`/api/admin/dashboard-config`).then(r => r.json()),
    ]).then(([stepsR, adsR, vidsR, coachR, cfgR]) => {
      if (stepsR.status === "fulfilled") { const s = stepsR.value?.entry?.steps || 0; setSteps(s); }
      if (adsR.status === "fulfilled") setAds((adsR.value?.ads || []).slice(0, 1));
      if (vidsR.status === "fulfilled") setVideos((vidsR.value?.videos || []).slice(0, 6));
      if (coachR.status === "fulfilled") {
        const raw = (coachR.value?.coaches || []);
        const sorted = [...raw].sort((a: any, b: any) => {
          const aCert = a.certified === 1 && a.certified_until && new Date(a.certified_until) > new Date() ? 1 : 0;
          const bCert = b.certified === 1 && b.certified_until && new Date(b.certified_until) > new Date() ? 1 : 0;
          if (bCert !== aCert) return bCert - aCert;
          const aScore = (Number(a.review_count) || 0) + (Number(a.sessions_count) || 0) * 0.5 + (Number(a.avg_rating) || 0) * 10;
          const bScore = (Number(b.review_count) || 0) + (Number(b.sessions_count) || 0) * 0.5 + (Number(b.avg_rating) || 0) * 10;
          return bScore - aScore;
        });
        setCoaches(sorted.slice(0, 6));
      }
      if (cfgR.status === "fulfilled") setCfg(cfgR.value?.config || {});
    });
  });

  const openCoachProfile = (c: any) => {
    navigate(`/app/coaching?coach=${c.id}`);
  };

  const quickActions = [
    { icon: Dumbbell, label: "Workouts", path: "/app/workouts" },
    { icon: Activity, label: "Steps", path: "/app/steps" },
    { icon: Users, label: "Community", path: "/app/community" },
    { icon: TrendingUp, label: "Analytics", path: "/app/analytics" },
    { icon: Star, label: "Coaching", path: "/app/coaching" },
  ];

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-4">
      <div className="space-y-7">

        {/* ═══════ GREETING ═══════════════════════════ */}
        {vis("dash_greeting_visible") && (
          <header className="pt-1">
            <p className="text-[13px] font-medium text-muted-foreground">{greeting}</p>
            <h1 className="mt-1 text-[30px] font-bold leading-[1.1] tracking-tight">
              {firstName} <span className="align-middle text-[26px]">👋</span>
            </h1>
          </header>
        )}

        {/* ═══════ HERO BANNER ══════════════════════════ */}
        {vis("dash_hero_visible") && (
          <Card className="relative min-h-[188px] gap-0 overflow-hidden rounded-[20px] p-0 shadow-soft">
            {cfg.dash_hero_image ? (
              <>
                <img src={cfg.dash_hero_image} alt="" className="absolute inset-0 size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--main-dim)] via-card to-[var(--secondary-dim)]" />
            )}
            <div className="relative z-10 flex min-h-[188px] flex-col justify-end gap-4 p-6">
              <div>
                <h2 className={`text-[23px] font-bold leading-tight tracking-tight ${cfg.dash_hero_image ? "text-white" : "text-foreground"}`}>
                  {txt("dash_hero_title", "Ready to crush your goals?")}
                </h2>
                <p className={`mt-1.5 text-[14px] leading-relaxed ${cfg.dash_hero_image ? "text-white/80" : "text-muted-foreground"}`}>
                  {txt("dash_hero_subtitle", "Track your progress and stay motivated")}
                </p>
              </div>
              <Button asChild size="lg" className="w-fit">
                <Link to={txt("dash_hero_cta_link", "/app/steps")}>
                  {txt("dash_hero_cta_text", "Start Tracking")} <ArrowRight size={17} />
                </Link>
              </Button>
            </div>
          </Card>
        )}

        {/* ═══════ QUICK ACTIONS (horizontal scroll pills) ═══ */}
        {vis("dash_quick_actions_visible") && (
          <Rail>
            {quickActions.map(({ icon: Icon, label, path }) => (
              <Link
                key={path + label}
                to={path}
                className="flex shrink-0 snap-start items-center gap-2.5 rounded-md bg-card py-2.5 ps-2.5 pe-4 shadow-soft-sm transition active:scale-[0.97]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary/15">
                  <Icon size={17} className="text-primary" />
                </span>
                <span className="text-[13px] font-semibold whitespace-nowrap">{label}</span>
              </Link>
            ))}
          </Rail>
        )}

        {/* ═══════ ANALYTICS SNAPSHOT ═══════════════════ */}
        {vis("dash_analytics_visible") && (
          <section>
            <SectionHeader title={txt("dash_analytics_title", t("analytics_snapshot"))} linkTo="/app/analytics" />
            <Rail>
              <Link to="/app/steps" className="flex min-w-[152px] shrink-0 snap-start flex-col rounded-lg bg-card p-4 shadow-soft-sm transition active:scale-[0.98]">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("today_steps")}</span>
                <p className="mt-2 text-[26px] leading-none font-bold tabular-nums">{steps.toLocaleString()}</p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary"><Activity size={13} /> {t("live_synced")}</div>
              </Link>
              <Link to="/app/steps" className="flex min-w-[152px] shrink-0 snap-start flex-col rounded-lg bg-card p-4 shadow-soft-sm transition active:scale-[0.98]">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("goal_progress")}</span>
                <p className="mt-2 text-[26px] leading-none font-bold tabular-nums">{goalPct}%</p>
                <Progress value={goalPct} className="mt-2.5 h-1.5" />
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary"><TrendingUp size={13} /> {t("of_goal_value", { value: stepGoal.toLocaleString() })}</div>
              </Link>
              <Link to="/app/analytics" className="flex min-w-[152px] shrink-0 snap-start flex-col rounded-lg bg-card p-4 shadow-soft-sm transition active:scale-[0.98]">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t("calories_burned")}</span>
                <p className="mt-2 text-[26px] leading-none font-bold tabular-nums">{caloriesEstimate}</p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary"><Zap size={13} /> {t("estimated_today")}</div>
              </Link>
            </Rail>
          </section>
        )}

        {/* ═══════ FEATURED CARD ═════════════════════════ */}
        {vis("dash_featured_visible") && (
          <Link to={txt("dash_featured_link", "/app/workouts")} className="block overflow-hidden rounded-lg shadow-soft-sm transition active:scale-[0.99]">
            <div className="relative min-h-[148px]">
              {cfg.dash_featured_image ? (
                <>
                  <img src={cfg.dash_featured_image} alt="" className="absolute inset-0 size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--main-dim)] via-card to-[var(--secondary-dim)]" />
              )}
              <div className="relative z-10 flex min-h-[148px] flex-col justify-end gap-1 p-5">
                <span className="mb-1 w-fit rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">Featured</span>
                <h3 className={`text-[18px] font-bold tracking-tight ${cfg.dash_featured_image ? "text-white" : "text-foreground"}`}>{txt("dash_featured_title", "Featured Workout")}</h3>
                <p className={`text-[13px] ${cfg.dash_featured_image ? "text-white/80" : "text-muted-foreground"}`}>{txt("dash_featured_subtitle", "Try today's recommended routine")}</p>
              </div>
            </div>
          </Link>
        )}

        {/* ═══════ SPONSORED AD (single, randomized per refresh) ══════════ */}
        {vis("dash_ads_visible") && ads.length > 0 && (
          <div>
            {ads.map((ad: any) => {
              const isCall = ad.objective === "direct_call" && ad.contact_phone;
              const target = isCall
                ? `tel:${(ad.contact_phone || "").replace(/\s/g, "")}`
                : ad.coach_id
                ? `/app/coaching?coach=${ad.coach_id}`
                : null;
              const trackClick = () => {
                if (!ad.id) return;
                apiFetch(`/api/coach/ads/${ad.id}/click`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
              };
              const cardInner = (
                <>
                  {ad.image_url && (
                    <div className="relative aspect-video max-h-[180px] w-full overflow-hidden bg-muted">
                      <img src={ad.image_url} alt="" className="size-full object-cover" />
                      <span className="absolute end-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">Sponsored</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="truncate text-[14px] font-bold">{ad.title}</p>
                      {ad.description && <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{ad.description}</p>}
                    </div>
                    {target ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground" aria-hidden="true">
                        {isCall ? <Phone size={14} /> : null}
                        {isCall ? "Call" : ad.cta || "Subscribe"}
                        {!isCall && <ArrowRight size={14} />}
                      </span>
                    ) : (
                      !ad.image_url && <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary">Sponsored</span>
                    )}
                  </div>
                </>
              );
              const cardCls = "block overflow-hidden rounded-lg bg-card shadow-soft-sm";
              if (!target) {
                return <Card key={ad.id} className="gap-0 overflow-hidden p-0 shadow-soft-sm">{cardInner}</Card>;
              }
              return isCall ? (
                <a key={ad.id} href={target} onClick={trackClick} className={`${cardCls} transition active:scale-[0.99]`}>{cardInner}</a>
              ) : (
                <Link key={ad.id} to={target} onClick={trackClick} className={`${cardCls} transition active:scale-[0.99]`}>{cardInner}</Link>
              );
            })}
          </div>
        )}

        {/* ═══════ WORKOUT VIDEOS ═══════════════════════ */}
        {vis("dash_videos_visible") && videos.length > 0 && (
          <section>
            <SectionHeader title={txt("dash_videos_title", "Workouts")} linkTo="/app/workouts" />
            <Rail>
              {videos.map((v: any) => (
                <div key={v.id} className="w-[170px] shrink-0 snap-start">
                  <div className="relative mb-2 h-[106px] overflow-hidden rounded-lg bg-card shadow-soft-sm">
                    {v.thumbnail
                      ? <img src={v.thumbnail} className="size-full object-cover" />
                      : <div className="grid size-full place-items-center bg-muted"><Play size={24} className="text-muted-foreground" /></div>}
                    <div className="absolute inset-0 grid place-items-center bg-black/20">
                      <span className="grid size-9 place-items-center rounded-full bg-black/55 backdrop-blur"><Play size={15} className="text-white" fill="#fff" /></span>
                    </div>
                    {v.duration && <span className="absolute end-1.5 bottom-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{v.duration}</span>}
                  </div>
                  <p className="line-clamp-2 text-[12.5px] leading-snug font-semibold">{v.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{v.category}</p>
                </div>
              ))}
            </Rail>
          </section>
        )}

        {/* ═══════ TOP COACHES ══════════════════════════ */}
        {vis("dash_coaches_visible") && coaches.length > 0 && (
          <section>
            <SectionHeader title={txt("dash_coaches_title", "Top Coaches")} linkTo="/app/coaching" />
            <Rail>
              {coaches.map((c: any) => {
                const certified = c.certified === 1 && c.certified_until && new Date(c.certified_until) > new Date();
                return (
                  <button
                    key={c.id}
                    onClick={() => openCoachProfile(c)}
                    className="w-[162px] shrink-0 snap-start rounded-lg bg-card p-4 text-center shadow-soft-sm transition active:scale-[0.97]"
                  >
                    <Avatar className="mx-auto size-16 ring-2 ring-primary/25">
                      <AvatarImage src={avatarUrl(c)} alt="" />
                      <AvatarFallback>{(c.name || "C").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <p className="mt-2.5 flex items-center justify-center gap-1 truncate text-[13px] font-semibold">
                      <span className="truncate">{c.name}</span>
                      {certified && <BadgeCheck size={14} className="shrink-0 text-primary" />}
                    </p>
                    <p className="truncate text-[11px] font-semibold text-primary">{c.specialty || "Fitness Coach"}</p>
                    {c.avg_rating > 0 && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                        <Star size={11} className="fill-current" /> {Number(c.avg_rating).toFixed(1)}
                      </div>
                    )}
                    {c.location && <p className="mt-1 inline-flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><MapPin size={9} />{c.location}</p>}
                  </button>
                );
              })}
            </Rail>
          </section>
        )}

        {/* ═══════ BLOGS / ARTICLES ═════════════════════ */}
        {vis("dash_blogs_visible") && (
          <section>
            <SectionHeader title={txt("dash_blogs_title", "Latest Articles")} linkTo="/app/blogs" />
            {blogs.length > 0 ? (
              <Rail>
                {blogs.slice(0, 6).map((b) => (
                  <Link key={b.id} to="/app/blogs" className="w-[210px] shrink-0 snap-start overflow-hidden rounded-lg bg-card shadow-soft-sm transition active:scale-[0.98]">
                    <div className="h-[112px] overflow-hidden bg-muted">
                      {b.header_image_url
                        ? <img src={b.header_image_url} className="size-full object-cover" />
                        : <div className="grid size-full place-items-center"><BookOpen size={22} className="text-muted-foreground" /></div>}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-[13px] leading-snug font-semibold">{b.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{b.author_name}</p>
                    </div>
                  </Link>
                ))}
              </Rail>
            ) : (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                <BookOpen size={28} className="mx-auto mb-2 opacity-40" />
                <p>No articles yet</p>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
