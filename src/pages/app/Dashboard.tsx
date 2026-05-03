import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ChevronRight, Play, Star, Dumbbell, Activity, BookOpen, Users, Phone, X, MessageSquare, MapPin, ArrowRight, TrendingUp } from "lucide-react";
import { avatarUrl } from "@/lib/avatar";
import { fetchPublicBlogs, type BlogPost } from "@/lib/blogs";

/* ── Section header helper ─────────────────────────────────── */
function SectionHeader({ title, linkTo }: { title: string; linkTo: string }) {
  return (
    <div className="dash-section-header">
      <h2>{title}</h2>
      <Link to={linkTo}>
        See all <ChevronRight size={14} />
      </Link>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user, token, updateUser } = useAuth();
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const isRTL = lang === "ar";

  const [steps, setSteps] = useState(0);
  const [ads, setAds] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileCoach, setProfileCoach] = useState<any | null>(null);
  const [coachReviews, setCoachReviews] = useState<any[]>([]);
  const [cfg, setCfg] = useState<Record<string, any>>({});
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

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
      fetch(`${getApiBase()}/api/steps/${today}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${getApiBase()}/api/coach/ads/public/home`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${getApiBase()}/api/workouts/videos`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${getApiBase()}/api/coaching/coaches`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${getApiBase()}/api/admin/dashboard-config`).then(r => r.json()),
    ]).then(([stepsR, adsR, vidsR, coachR, cfgR]) => {
      if (stepsR.status === "fulfilled") { const s = stepsR.value?.entry?.steps || 0; setSteps(s); if (s) updateUser({ steps: s }); }
      if (adsR.status === "fulfilled") {
        const homeAds = (adsR.value?.ads || []).slice(0, 3);
        if (homeAds.length > 0) {
          setAds(homeAds);
        } else {
          fetch(`${getApiBase()}/api/coach/ads/public`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : { ads: [] })
            .then(d => setAds((d?.ads || []).slice(0, 3)))
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
      fetch(`${getApiBase()}/api/steps/${today}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${getApiBase()}/api/coach/ads/public/home`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${getApiBase()}/api/workouts/videos`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${getApiBase()}/api/coaching/coaches`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${getApiBase()}/api/admin/dashboard-config`).then(r => r.json()),
    ]).then(([stepsR, adsR, vidsR, coachR, cfgR]) => {
      if (stepsR.status === "fulfilled") { const s = stepsR.value?.entry?.steps || 0; setSteps(s); }
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
    fetchPublicBlogs("", lang as "en" | "ar").then(b => setBlogs(b.slice(0, 6))).catch(() => {});
  });

  const openCoachProfile = (c: any) => {
    navigate(`/app/coaching?coach=${c.id}`);
  };

  return (
    <div className="dash-root">

      {/* ═══════ GREETING ═══════════════════════════ */}
      {vis("dash_greeting_visible") && (
        <div className="dash-greeting">
          <div>
            <p className="dash-greeting-sub">{greeting}</p>
            <h1 className="dash-greeting-name">{firstName} <span style={{ fontSize: 22 }}>👋</span></h1>
          </div>
        </div>
      )}

      {/* ═══════ HERO BANNER ══════════════════════════ */}
      {vis("dash_hero_visible") && (
        <div className="dash-hero" style={!cfg.dash_hero_image ? {} : undefined}>
          {cfg.dash_hero_image && (
            <div className="dash-hero-img">
              <img src={cfg.dash_hero_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
            </div>
          )}
          <div className="dash-hero-overlay" style={cfg.dash_hero_image ? { flex: 1, background: "none", borderRadius: 12, padding: "20px 0 20px 6px" } : {}}>
            <h2 className="dash-hero-title">{txt("dash_hero_title", "Ready to crush your goals?")}</h2>
            <p className="dash-hero-subtitle">{txt("dash_hero_subtitle", "Track your progress and stay motivated")}</p>
            <Link to={txt("dash_hero_cta_link", "/app/steps")} className="dash-hero-cta">
              {txt("dash_hero_cta_text", "Start Tracking")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {/* ═══════ QUICK ACTIONS (horizontal scroll pills) ═══ */}
      {vis("dash_quick_actions_visible") && (
        <div className="dash-actions-scroll">
          {[
            { icon: Dumbbell, label: "Workouts", path: "/app/workouts", color: "var(--main)", bg: "var(--main-dim)" },
            { icon: Activity, label: "Steps", path: "/app/steps", color: "var(--main)", bg: "var(--main-dim)" },
            { icon: Users, label: "Community", path: "/app/community", color: "var(--main)", bg: "var(--main-dim)" },
            { icon: TrendingUp, label: "Analytics", path: "/app/analytics", color: "var(--main)", bg: "var(--main-dim)" },
            { icon: Star, label: "Coaching", path: "/app/coaching", color: "var(--main)", bg: "var(--main-dim)" },
            { icon: Zap, label: "Streak", path: "/app/steps", color: "var(--main)", bg: "var(--main-dim)" },
          ].map(({ icon: Icon, label, path, color, bg }) => (
            <Link key={path + label} to={path} className="dash-action-pill">
              <div style={{ width: 36, height: 36, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color={color} />
              </div>
              <span className="dash-action-label">{label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ═══════ ANALYTICS SNAPSHOT ═══════════════════ */}
      {vis("dash_analytics_visible") && (
        <section className="dash-section">
          <SectionHeader title={txt("dash_analytics_title", t("analytics_snapshot"))} linkTo="/app/analytics" />
          <div className="dash-analytics-grid">
            <Link to="/app/steps" className="dash-analytics-card">
              <span className="dash-analytics-kicker">{t("today_steps")}</span>
              <p className="dash-analytics-value">{steps.toLocaleString()}</p>
              <div className="dash-analytics-foot"><Activity size={14} /> {t("live_synced")}</div>
            </Link>
            <Link to="/app/steps" className="dash-analytics-card">
              <span className="dash-analytics-kicker">{t("goal_progress")}</span>
              <p className="dash-analytics-value">{goalPct}%</p>
              <div className="dash-analytics-foot"><TrendingUp size={14} /> {t("of_goal_value", { value: stepGoal.toLocaleString() })}</div>
            </Link>
            <Link to="/app/analytics" className="dash-analytics-card">
              <span className="dash-analytics-kicker">{t("calories_burned")}</span>
              <p className="dash-analytics-value">{caloriesEstimate}</p>
              <div className="dash-analytics-foot"><Zap size={14} /> {t("estimated_today")}</div>
            </Link>
          </div>
        </section>
      )}

      {/* ═══════ FEATURED CARD ═════════════════════════ */}
      {vis("dash_featured_visible") && (
        <Link to={txt("dash_featured_link", "/app/workouts")} className="dash-featured" style={!cfg.dash_featured_image ? {} : undefined}>
          {cfg.dash_featured_image && (
            <div className="dash-featured-img">
              <img src={cfg.dash_featured_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
            </div>
          )}
          <div className="dash-featured-overlay" style={cfg.dash_featured_image ? { flex: 1, background: "none", borderRadius: 12, padding: "16px 0 16px 6px" } : {}}>
            <span className="dash-featured-badge">Featured</span>
            <h3 className="dash-featured-title">{txt("dash_featured_title", "Featured Workout")}</h3>
            <p className="dash-featured-sub">{txt("dash_featured_subtitle", "Try today's recommended routine")}</p>
          </div>
        </Link>
      )}

      {/* ═══════ SPONSORED ADS ═════════════════════════ */}
      {vis("dash_ads_visible") && ads.length > 0 && (
        <div className="dash-ads-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ads.map((ad: any) => (
            <div key={ad.id} className="dash-ad-card">
              <div className="dash-ad-icon">
                {ad.image_url ? <img src={ad.image_url} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} /> : <Star size={18} color="var(--accent)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{ad.title}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ad.description}</p>
              </div>
              {ad.objective === "direct_call" && ad.contact_phone ? (
                <a href={`tel:${(ad.contact_phone || '').replace(/\s/g, '')}`}
                  onClick={() => fetch(getApiBase() + `/api/coach/ads/${ad.id}/click`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {})}
                  className="dash-ad-cta">
                  <Phone size={13} /> Call
                </a>
              ) : (
                <span className="dash-ad-badge">Sponsored</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══════ WORKOUT VIDEOS ═══════════════════════ */}
      {vis("dash_videos_visible") && videos.length > 0 && (
        <section className="dash-section">
          <SectionHeader title={txt("dash_videos_title", "Workouts")} linkTo="/app/workouts" />
          <div className="dash-hscroll">
            {videos.map((v: any) => (
              <div key={v.id} className="dash-video-card">
                <div className="dash-video-thumb">
                  {v.thumbnail
                    ? <img src={v.thumbnail} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-surface)" }}><Play size={24} color="var(--text-muted)" /></div>}
                  <div className="dash-video-play">
                    <Play size={16} color="#fff" fill="#fff" />
                  </div>
                  {v.duration && <span className="dash-video-dur">{v.duration}</span>}
                </div>
                <p className="dash-video-title">{v.title}</p>
                <p className="dash-video-cat">{v.category}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ TOP COACHES ══════════════════════════ */}
      {vis("dash_coaches_visible") && coaches.length > 0 && (
        <section className="dash-section">
          <SectionHeader title={txt("dash_coaches_title", "Top Coaches")} linkTo="/app/coaching" />
          <div className="dash-hscroll">
            {coaches.map((c: any) => (
              <div key={c.id} className="dash-coach-card" onClick={() => openCoachProfile(c)}>
                <img src={avatarUrl(c)} className="dash-coach-avatar" />
                <p className="dash-coach-name">
                  {c.name}
                  {c.certified === 1 && c.certified_until && new Date(c.certified_until) > new Date() && (
                    <span className="dash-coach-badge">✓</span>
                  )}
                </p>
                <p className="dash-coach-spec">{c.specialty || "Fitness Coach"}</p>
                {c.avg_rating > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                    <Star size={11} style={{ fill: "var(--main)", color: "var(--main)" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--main)" }}>{Number(c.avg_rating).toFixed(1)}</span>
                  </div>
                )}
                {c.location && <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}><MapPin size={9} />{c.location}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ BLOGS / ARTICLES ═════════════════════ */}
      {vis("dash_blogs_visible") && (
        <section className="dash-section">
          <SectionHeader title={txt("dash_blogs_title", "Latest Articles")} linkTo="/app/blogs" />
          {blogs.length > 0 ? (
          <div className="dash-hscroll">
            {blogs.slice(0, 6).map((b) => (
              <Link key={b.id} to="/app/blogs" className="dash-blog-card">
                <div className="dash-blog-img">
                  {b.header_image_url
                    ? <img src={b.header_image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><BookOpen size={22} color="var(--text-muted)" /></div>}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <p className="dash-blog-title">{b.title}</p>
                  <p className="dash-blog-author">{b.author_name}</p>
                </div>
              </Link>
            ))}
          </div>
          ) : (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              <BookOpen size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
              <p>No articles yet</p>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
