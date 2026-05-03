import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/context/I18nContext";
import { useBranding } from "@/context/BrandingContext";
import { useTheme } from "@/context/ThemeContext";
import { getApiBase } from "@/lib/api";
import {
  ArrowRight, Dumbbell, BarChart2, Users, MessageCircle,
  Star, Shield, Zap, Heart, Smartphone, Timer, Award,
  Trophy, Eye,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Home Page — FitWayHub Design System (April 2026)
   Layout: Role-aware editorial with Barlow Condensed display + Instrument Serif
           italic accents + Geist Mono kickers. Yellow accent = brand color.
   CMS sections used (admin editable via /admin/website):
     • hero            — heading, headingAccent, subheading, badge, btn texts/links, bg image
     • portal_select   — Athlete/Coach gate (eyebrow, heading, headingAccent, labels, links)
     • features        — sectionLabel, heading, intro, items[]
     • cta             — heading, subheading, btnText, btnLink
   Live data: /api/public/stats (members, coaches, programs, rating)
   ────────────────────────────────────────────────────────────────────────── */

const FEATURE_ICONS: Record<string, any> = {
  workouts: Dumbbell,
  coaching: Users,
  analytics: BarChart2,
  community: MessageCircle,
  Dumbbell, Users, BarChart: BarChart2, BarChart2, MessageCircle,
};

// Wider icon map for trust badges + step icons (CMS uses string names).
// Imported below in the actual file via the existing lucide imports.
let CMS_ICON_MAP: Record<string, any> = {};
function makeCmsIconMap(icons: Record<string, any>) { CMS_ICON_MAP = { ...icons }; }

const DEFAULT_FEATURES = [
  {
    id: "workouts",
    en: { title: "Workouts", desc: "Video-guided programs for every level with progress tracking and form tips." },
    ar: { title: "التمارين", desc: "برامج بالفيديو لكل المستويات مع تتبع التقدم ونصائح الأداء." },
  },
  {
    id: "coaching",
    en: { title: "Customized Coaching", desc: "Plans built for your body, goals, and schedule by certified human coaches — no generic templates." },
    ar: { title: "كوتشينج مخصص", desc: "خطط مبنية على جسمك وأهدافك وجدولك من كوتشات معتمدين — مفيش قوالب عامة." },
  },
  {
    id: "analytics",
    en: { title: "Smart Analytics", desc: "Visual dashboards track every step, calorie, and personal milestone in real time." },
    ar: { title: "تحليلات ذكية", desc: "لوحات بصرية تتابع كل خطوة وسعرة حرارية وإنجاز شخصي لحظة بلحظة." },
  },
  {
    id: "community",
    en: { title: "Community & Challenges", desc: "Share progress, join challenges, and stay motivated with thousands of members." },
    ar: { title: "المجتمع والتحديات", desc: "شارك تقدمك، انضم للتحديات، وابقَ متحمساً مع آلاف الأعضاء." },
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const { branding } = useBranding();
  const { isDark } = useTheme();
  const isAr = lang === "ar";
  const accent = branding.primary_color || "#FFD600";

  /* ── Cursor-follow hover preview state ─────────────────────────────────────
     A single floating preview tracks the mouse anywhere on the page. Each
     hoverable element calls `setHoverImage(url)` on enter and
     `setHoverImage(null)` on leave. The preview itself is rendered once at
     the end of the page. */
  const [hoverImage, setHoverImage] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverFrameRef = useRef<number | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // rAF-throttle so we don't re-render on every pixel of mouse movement.
      if (hoverFrameRef.current != null) return;
      hoverFrameRef.current = requestAnimationFrame(() => {
        setMousePos({ x: e.clientX, y: e.clientY });
        hoverFrameRef.current = null;
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hoverFrameRef.current != null) cancelAnimationFrame(hoverFrameRef.current);
    };
  }, []);

  const [liveStats, setLiveStats] = useState({ members: 0, coaches: 0, programs: 0, rating: "5.0" });
  const [cmsSections, setCmsSections] = useState<Record<string, any>>({});
  const [cmsLoaded, setCmsLoaded] = useState(false);

  useEffect(() => {
    fetch(`${getApiBase()}/api/public/stats`)
      .then(r => r.json())
      .then(d => setLiveStats({
        members: d.members || 0,
        coaches: d.coaches || 0,
        programs: d.programs || 0,
        rating: d.rating || "5.0",
      }))
      .catch(() => {});
    fetch(`${getApiBase()}/api/cms/sections/home`)
      .then(r => r.json())
      .then(d => {
        const map: Record<string, any> = {};
        (d.sections || []).forEach((s: any) => {
          try { map[s.type] = typeof s.content === "string" ? JSON.parse(s.content) : s.content; }
          catch { map[s.type] = s.content; }
        });
        setCmsSections(map);
      })
      .catch(() => {})
      .finally(() => setCmsLoaded(true));
  }, []);

  // CMS text picker: prefer CMS value, fallback to provided default.
  const cms = (type: string, field: string, fallback: string) => {
    const sec = cmsSections[type];
    if (!sec) return fallback;
    const key = isAr ? `${field}_ar` : field;
    return sec[key] || sec[field] || fallback;
  };

  // Hold first paint until CMS arrives — avoids flash of fallback text
  if (!cmsLoaded) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-primary)", color: "var(--text-primary)",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          border: `3px solid ${accent}33`, borderTopColor: accent,
          animation: "fh-spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes fh-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Live stats (4 cells) ───────────────────────────────────────────────── */
  // STATS — numbers are LIVE from /api/public/stats. Descriptions come from
  // the CMS `stats` template's `label` / `label_ar` fields if admin has
  // populated them; otherwise fall back to the seeded English/Arabic copy.
  const cmsStats = cmsSections.stats?.items || [];
  const statsDesc = (i: number, fallback: string) => {
    const it = cmsStats[i];
    if (!it) return fallback;
    return (isAr ? (it.label_ar || it.label) : (it.label || it.label_ar)) || fallback;
  };
  const STATS = [
    { num: liveStats.members > 0 ? `${liveStats.members.toLocaleString()}+` : "—", desc: statsDesc(0, isAr ? "عضو نشط يتدرب على المنصة." : "Active members training across the platform every week."), icon: Users },
    { num: liveStats.coaches > 0 ? `${liveStats.coaches}+` : "—", desc: statsDesc(1, isAr ? "كوتش معتمد بشهادات موثقة." : "Vetted certified coaches with verified credentials."), icon: Award },
    { num: liveStats.programs > 0 ? `${liveStats.programs}+` : "—", desc: statsDesc(2, isAr ? "برنامج تدريب جاهز للمتابعة." : "Ready-made training programs to follow."), icon: Dumbbell },
    { num: `${liveStats.rating}★`, desc: statsDesc(3, isAr ? "تقييم التطبيق من المستخدمين." : "App rating from athletes who trained with us."), icon: Star },
  ];

  /* ── Testimonials — prefer CMS, fall back to seeded defaults ───────────
     Admin can add a `testimonials` section to the Home page in /admin/website
     and edit name, meta, quote, and upload a profile photo per item in both
     EN and AR. Until that section exists in CMS, we render the three
     baseline reviews below with placeholder photos from randomuser.me. */
  const TESTIMONIAL_DEFAULTS = [
    {
      name: isAr ? "أحمد محمد" : "Ahmed M.",
      avatar: "https://randomuser.me/api/portraits/men/32.jpg",
      meta: isAr ? "−15 كجم · 3 شهور" : "−15kg · 3 months",
      quote: isAr ? "غيّر حياتي بشكل كامل. الكوتش ساعدني أنزل ١٥ كيلو في ٣ شهور." : "Completely changed my life. My coach helped me lose 15kg in 3 months.",
    },
    {
      name: isAr ? "سارة أحمد" : "Sara A.",
      avatar: "https://randomuser.me/api/portraits/women/44.jpg",
      meta: isAr ? "تقييم 5 نجوم" : "5★ review",
      quote: isAr ? "أفضل تطبيق لياقة استخدمته. التحليلات والمتابعة مش موجودة في أي تطبيق تاني." : "Best fitness app I've used. The analytics and tracking are unmatched.",
    },
    {
      name: isAr ? "عمر خالد" : "Omar K.",
      avatar: "https://randomuser.me/api/portraits/men/67.jpg",
      meta: isAr ? "خطة مخصصة" : "Custom plan",
      quote: isAr ? "الكوتشات المعتمدين عندهم خبرة حقيقية. خطة مخصصة لي ونتائج خرافية." : "The certified coaches really know their stuff. A plan built for me and incredible results.",
    },
  ];
  const cmsTestimonials = cmsSections.testimonials?.items;
  const TESTIMONIALS = (cmsTestimonials?.length
    ? cmsTestimonials.map((it: any) => ({
        name:   isAr ? (it.name_ar  || it.name)  : (it.name  || it.name_ar),
        meta:   isAr ? (it.meta_ar  || it.meta)  : (it.meta  || it.meta_ar),
        quote:  isAr ? (it.quote_ar || it.quote) : (it.quote || it.quote_ar),
        avatar: it.imageUrl || "",
      }))
    : TESTIMONIAL_DEFAULTS
  );

  // Local icon map for CMS-driven trust badges + steps (string → component).
  // Falls back to a sensible default when the admin picks an icon we haven't
  // imported here.
  makeCmsIconMap({ Shield, Zap, Smartphone, Heart, Users, Timer, BarChart2, BarChart: BarChart2, Dumbbell, MessageCircle, Award: Trophy, Eye, Activity: BarChart2, Star });

  /* ── Trust indicators — prefer CMS, fall back to seeded defaults ───────── */
  const TRUST_DEFAULTS = [
    { icon: Shield, label: isAr ? "بيانات مشفرة" : "Encrypted Data" },
    { icon: Zap, label: isAr ? "سريع وخفيف" : "Lightning Fast" },
    { icon: Smartphone, label: isAr ? "iOS و Android" : "iOS & Android" },
    { icon: Heart, label: isAr ? "مجاني للبدء" : "Free to Start" },
  ];
  const TRUST = (cmsSections.trust?.items?.length
    ? cmsSections.trust.items.map((it: any) => ({
        icon: CMS_ICON_MAP[it.icon] || Shield,
        label: isAr ? (it.label_ar || it.label) : (it.label || it.label_ar),
      }))
    : TRUST_DEFAULTS
  );

  /* ── Steps — prefer CMS, fall back to seeded defaults ──────────────────── */
  const STEPS_DEFAULTS = [
    { step: "01", icon: Smartphone, title: isAr ? "سجّل حسابك" : "Create Account", desc: isAr ? "سجّل مجاناً في ثواني واختار هدفك." : "Sign up free in seconds and pick your goal." },
    { step: "02", icon: Users, title: isAr ? "ابحث واختر كوتش" : "Search & Choose a Coach", desc: isAr ? "تصفح الكوتشات المعتمدين واختر اللي يناسب هدفك وميزانيتك." : "Browse certified coaches and pick the one that fits your goal and budget." },
    { step: "03", icon: Timer, title: isAr ? "ابدأ التمرين" : "Start Training", desc: isAr ? "اتبع خطتك المخصصة من كوتشك أو التمارين الجاهزة في التطبيق." : "Follow your coach's personalised plan or the guided workouts in the app." },
    { step: "04", icon: BarChart2, title: isAr ? "تابع تقدمك" : "Track Progress", desc: isAr ? "شوف تطورك بالأرقام والتحليلات وشارك إنجازاتك مع المجتمع." : "See your growth with analytics and share your milestones with the community." },
  ];
  const STEPS = (cmsSections.steps?.items?.length
    ? cmsSections.steps.items.map((it: any) => ({
        step: it.step || "",
        icon: CMS_ICON_MAP[it.icon] || Smartphone,
        title: isAr ? (it.title_ar || it.title) : (it.title || it.title_ar),
        desc:  isAr ? (it.desc_ar  || it.desc)  : (it.desc  || it.desc_ar),
      }))
    : STEPS_DEFAULTS
  );

  /* ── Features list (CMS overrideable) ──────────────────────────────────── */
  const cmsFeat = cmsSections.features;
  const featureItems = (cmsFeat?.items?.length
    ? cmsFeat.items.map((it: any, i: number) => ({
        id: DEFAULT_FEATURES[i % DEFAULT_FEATURES.length].id,
        icon: it.icon || DEFAULT_FEATURES[i % DEFAULT_FEATURES.length].id,
        title: isAr ? (it.title_ar || it.title) : (it.title || it.title_ar),
        desc: isAr ? (it.desc_ar || it.desc) : (it.desc || it.desc_ar),
        imageUrl: it.imageUrl || "",
      }))
    : DEFAULT_FEATURES.map(f => ({
        id: f.id,
        icon: f.id,
        title: f[isAr ? "ar" : "en"].title,
        desc: f[isAr ? "ar" : "en"].desc,
        imageUrl: "",
      }))
  ).slice(0, 6);

  /* ── Marquee words — prefer CMS comma list, fall back to seeded defaults ─ */
  const marqDefaults = isAr
    ? ["تدرّب", "تعافى", "اكسر حدودك", "ابني عضلاتك", "ابقى ثابت", "اقوى كل يوم"]
    : ["Train Hard", "Recover Smart", "Break Limits", "Build Strength", "Stay Consistent", "Get Stronger"];
  const marqCmsRaw = isAr
    ? (cmsSections.marquee?.words_ar || cmsSections.marquee?.words || "")
    : (cmsSections.marquee?.words || cmsSections.marquee?.words_ar || "");
  const marqWords = (marqCmsRaw && String(marqCmsRaw).trim())
    ? String(marqCmsRaw).split(",").map(s => s.trim()).filter(Boolean)
    : marqDefaults;

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — large light display type with italic accent
          CMS: hero (heading, headingAccent, subheading, badge, btn texts/links, backgroundImage)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-hero" style={{ overflow: "hidden", borderBottom: "1px solid var(--border)" }}>
        {/* Theme-aware hero background:
            - dark mode → backgroundImageDark (CMS), then backgroundImage (legacy fallback)
            - light mode → backgroundImageLight (CMS), then backgroundImage (legacy fallback)
            - if neither set, no background image renders. */}
        {(() => {
          const heroBg = isDark
            ? (cmsSections.hero?.backgroundImageDark || cmsSections.hero?.backgroundImage)
            : (cmsSections.hero?.backgroundImageLight || cmsSections.hero?.backgroundImage);
          if (!heroBg) return null;
          return (
            <div aria-hidden style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: `url(${heroBg})`,
              backgroundSize: "cover", backgroundPosition: "center",
              // Slightly stronger overlay in light mode where bright images
              // can wash out body text.
              opacity: isDark ? 0.35 : 0.28,
            }} />
          );
        })()}
        <div className="fwh-con" style={{ position: "relative", width: "100%" }}>
          {/* Top meta */}
          <div className="fwh-section-meta">
            <span>{isAr ? "منصة لياقة النخبة · إصدار ٢٠٢٦" : "ELITE FITNESS PLATFORM · V.2026"}</span>
            <span>{isAr ? `يوم ${new Date().getDate()} · ${new Date().getFullYear()}` : `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()} · ${new Date().getFullYear()}`}</span>
          </div>

          {/* Eyebrow */}
          <div className="fwh-kicker" style={{ marginBottom: 28 }}>
            {cms("hero", "badge", isAr ? "منصة لياقة #١ في مصر" : "#1 fitness platform in egypt")}
          </div>

          {/* Hero headline (with CMS) */}
          <h1 className="fwh-hero-h1">
            {cmsSections.hero ? (
              <>
                {cms("hero", "heading", "")}
                {cms("hero", "headingAccent", "") && (
                  <> <em className="fwh-italic">{cms("hero", "headingAccent", "")}</em></>
                )}
              </>
            ) : isAr ? (
              <>لياقتك. <em className="fwh-italic">بطريقتك.</em><br /><span className="fwh-stroke">بلا حدود.</span></>
            ) : (
              <>Your fitness.<br /><em className="fwh-italic">Your way.</em><br /><span className="fwh-stroke">No limits.</span></>
            )}
          </h1>

          {/* Sub */}
          <p className="fwh-hero-sub">
            {cms("hero", "subheading", isAr
              ? "منصة لياقة متكاملة تجمع التمارين المعتمدة، التحليلات الذكية، وكوتشات حقيقيين — كل ده في تطبيق واحد."
              : "A complete fitness platform combining certified workouts, smart analytics, and real coaches — all in one app.")}
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 56 }}>
            <button
              className="fwh-btn"
              onClick={() => navigate(cmsSections.hero?.primaryBtnLink || "/auth/register")}
            >
              {cms("hero", "primaryBtnText", isAr ? "ابدأ مجاناً" : "Get Started Free")}
              <span className="fwh-btn-arr"><ArrowRight size={14} /></span>
            </button>
            <button
              className="fwh-btn-outline"
              onClick={() => navigate(cmsSections.hero?.secondaryBtnLink || "/about")}
            >
              <span>{cms("hero", "secondaryBtnText", isAr ? "اعرف أكتر" : "Learn More")}</span>
              <span className="fwh-btn-outline-arr">↗</span>
            </button>
          </div>

          {/* Trust indicators */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 32,
            paddingTop: 28, marginTop: 28,
            borderTop: "1px solid var(--border)",
          }}>
            {TRUST.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <item.icon size={15} color={accent} strokeWidth={2.2} />
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          MARQUEE
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="fwh-marq" aria-hidden>
        <div className="fwh-marq-track">
          {[0, 1].map(k => marqWords.map((w, i) => (
            <span key={`${k}-${i}`} style={{ display: "inline-flex", alignItems: "center" }}>
              <span className={`fwh-marq-item ${i % 2 ? "stroke" : ""}`}>{w}</span>
              <span className="fwh-marq-dot" />
            </span>
          )))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PORTAL SELECTOR — Athlete or Coach
          CMS: portal_select (eyebrow, heading, headingAccent, athleteLabel, athleteLink, coachLabel, coachLink)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-gate">
        <div className="fwh-gate-bg">
          <div className="fwh-photo" style={{ position: "absolute", inset: 0 }} />
        </div>
        <div className="fwh-gate-content">
          <div className="fwh-gate-tag">
            {cms("portal_select", "eyebrow", isAr ? "— اختر مسارك" : "— Choose Your Path")}
          </div>
          <h2 className="fwh-gate-h">
            {cmsSections.portal_select ? (
              <>
                {cms("portal_select", "heading", "")}
                {cms("portal_select", "headingAccent", "") && (
                  <> <em className="fwh-italic">{cms("portal_select", "headingAccent", "")}</em></>
                )}
              </>
            ) : isAr ? (
              <>رياضي <em className="fwh-italic">أم</em> مدرب.</>
            ) : (
              <>Athlete <em className="fwh-italic">or</em> Coach.</>
            )}
          </h2>
          <div className="fwh-gate-buttons">
            <button
              className="fwh-gate-btn"
              onClick={() => navigate(cmsSections.portal_select?.athleteLink || "/auth/register?role=user")}
            >
              <span className="fwh-gate-btn-num">01 /</span>
              <span className="fwh-gate-btn-label">
                {cms("portal_select", "athleteLabel", isAr ? "أنا رياضي" : "I'm an Athlete")}
              </span>
              <span className="fwh-gate-btn-arr">↗</span>
            </button>
            <button
              className="fwh-gate-btn"
              onClick={() => navigate(cmsSections.portal_select?.coachLink || "/auth/register?role=coach")}
            >
              <span className="fwh-gate-btn-num">02 /</span>
              <span className="fwh-gate-btn-label">
                {cms("portal_select", "coachLabel", isAr ? "أنا مدرب" : "I'm a Coach")}
              </span>
              <span className="fwh-gate-btn-arr">↗</span>
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          STATS — 4-cell grid (live data)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 32, height: 1, background: accent, display: "inline-block" }} />
              <span style={{ color: accent, textTransform: "none", letterSpacing: "0.02em", fontSize: 13, fontFamily: "var(--font-en)" }}>
                {isAr ? "— نشاط مثالي" : "— Perfect Activity"}
              </span>
              <span>(04)</span>
            </span>
            <span>{isAr ? "أرقام تحكي القصة" : "Numbers tell the story"}</span>
          </div>
          <h2 className="fwh-s-h" style={{ marginBottom: 56, maxWidth: 1100 }}>
            {isAr ? <>أرقام تثبت <em className="fwh-italic">التزامنا</em>.</> : <>Numbers that prove <em className="fwh-italic">commitment</em>.</>}
          </h2>
          <div className="fwh-stats-grid">
            {STATS.map((s, i) => (
              <div key={i} className="fwh-stat-cell">
                <div className="fwh-stat-num">{s.num}</div>
                <div className="fwh-stat-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURES — service-row style with hover slide
          CMS: features (sectionLabel, heading, intro, items[icon, title, desc])
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section">
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 32, height: 1, background: accent, display: "inline-block" }} />
              <span style={{ color: accent, textTransform: "none", letterSpacing: "0.02em", fontSize: 13, fontFamily: "var(--font-en)" }}>
                — {cms("features", "sectionLabel", isAr ? "المميزات" : "What We Offer")}
              </span>
              <span>({featureItems.length.toString().padStart(2, "0")})</span>
            </span>
            <span>{isAr ? "كفاءة شاملة" : "Complete Proficiency"}</span>
          </div>
          <h2 className="fwh-s-h" style={{ marginBottom: 32, maxWidth: 1100 }}>
            {cms("features", "heading", isAr ? "كل اللي محتاجه في تطبيق واحد." : "Everything you need in one app.")}
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-muted)", maxWidth: 720, lineHeight: 1.7, marginBottom: 56 }}>
            {cms("features", "intro", isAr
              ? "من التمارين للكوتشات للتحليلات والمجتمع — كل أدواتك في مكان واحد."
              : "Workouts, certified coaches, smart analytics, community — all in one place.")}
          </p>

          <div style={{ borderTop: "1px solid var(--border)" }}>
            {featureItems.map((f: any, i: number) => {
              const Icon = FEATURE_ICONS[f.icon] || Dumbbell;
              // Hover handlers — when this feature has a screenshot URL, set
              // the floating preview to that URL on enter and clear on leave.
              const onEnter = () => f.imageUrl && setHoverImage(f.imageUrl);
              const onLeave = () => setHoverImage(null);
              return (
                <div
                  key={i}
                  className="fwh-service-row"
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                  style={{ cursor: f.imageUrl ? "none" : undefined }}
                >
                  <div className="fwh-service-num">({String(i + 1).padStart(2, "0")})</div>
                  <div className="fwh-service-title">{f.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <Icon size={28} color={accent} strokeWidth={1.5} />
                    <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, flex: 1 }}>
                      {f.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — 4 steps in editorial cards
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 32, height: 1, background: accent, display: "inline-block" }} />
              <span style={{ color: accent, textTransform: "none", letterSpacing: "0.02em", fontSize: 13, fontFamily: "var(--font-en)" }}>
                {isAr ? "— كيف يعمل" : "— How It Works"}
              </span>
              <span>(04)</span>
            </span>
            <span>{isAr ? "ابدأ في خطوات بسيطة" : "Start in simple steps"}</span>
          </div>
          <h2 className="fwh-s-h" style={{ marginBottom: 56, maxWidth: 1000 }}>
            {isAr ? <>ابدأ في <em className="fwh-italic">٤ خطوات</em>.</> : <>Start in <em className="fwh-italic">4 simple</em> steps.</>}
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 24,
          }}>
            {STEPS.map((item, i) => (
              <div key={i} className="fwh-card" style={{ minHeight: 240, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span className="fwh-card-eyebrow" style={{ marginBottom: 0 }}>
                    Step / {item.step}
                  </span>
                  <item.icon size={22} color={accent} strokeWidth={2} />
                </div>
                <h3 className="fwh-card-title">{item.title}</h3>
                <p className="fwh-card-body">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          TESTIMONIALS — quote cards
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section">
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 32, height: 1, background: accent, display: "inline-block" }} />
              <span style={{ color: accent, textTransform: "none", letterSpacing: "0.02em", fontSize: 13, fontFamily: "var(--font-en)" }}>
                — {cms("testimonials", "sectionLabel", isAr ? "نتائج حقيقية" : "Real Results")}
              </span>
              <span>({TESTIMONIALS.length.toString().padStart(2, "0")})</span>
            </span>
            <span>{isAr ? "آراء الأعضاء" : "Athlete Stories"}</span>
          </div>
          <h2 className="fwh-s-h" style={{ marginBottom: 56, maxWidth: 1000 }}>
            {cmsSections.testimonials?.heading
              ? cms("testimonials", "heading", "")
              : (isAr
                  ? <>أشخاص حقيقيون. <em className="fwh-italic">تحوّلات</em> مذهلة.</>
                  : <>Real people. <em className="fwh-italic">Real</em> transformations.</>)
            }
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="fwh-card" style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: 280 }}>
                <span className="fwh-card-eyebrow">({String(i + 1).padStart(2, "0")})</span>
                <p style={{
                  fontFamily: "var(--fwh-serif, 'Instrument Serif', serif)",
                  fontStyle: "italic",
                  fontSize: 22,
                  lineHeight: 1.4,
                  color: "var(--text-primary)",
                  flex: 1,
                  margin: 0,
                }}>
                  "{t.quote}"
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* When the CMS testimonial has no imageUrl OR a remote
                        photo URL fails to load, show a coloured-initials
                        avatar instead of a broken-image icon. */}
                    {(() => {
                      const initials = String(t.name || "?")
                        .split(" ").filter(Boolean).map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
                      const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(
                        `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='100%' height='100%' fill='${accent}'/><text x='50%' y='58%' text-anchor='middle' font-size='18' font-weight='700' font-family='sans-serif' fill='%230a0a0a'>${initials}</text></svg>`
                      )}`;
                      return (
                        <img
                          src={t.avatar || fallback}
                          alt={t.name}
                          loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
                          style={{
                            width: 44, height: 44, borderRadius: "50%",
                            objectFit: "cover",
                            border: "1px solid var(--border)",
                            background: "var(--bg-surface)",
                            flexShrink: 0,
                          }}
                        />
                      );
                    })()}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                        {t.name}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: accent }}>
                        {t.meta}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {Array.from({ length: 5 }, (_, j) => (
                      <Star key={j} size={12} fill={accent} color={accent} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA — circle CTA with huge italic display
          CMS: cta (heading, subheading, btnText, btnLink)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section" style={{ padding: "140px 24px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
        <div className="fwh-con">
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: accent,
            marginBottom: 36,
          }}>
            — {isAr ? "لنبدأ معاً" : "Let's Begin Together"}
          </div>
          <h2 style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 300,
            fontSize: "clamp(56px, 9vw, 160px)",
            lineHeight: 0.9,
            letterSpacing: "-0.045em",
            color: "var(--text-primary)",
            marginBottom: 48,
          }}>
            {cmsSections.cta ? (
              cms("cta", "heading", "")
            ) : isAr ? (
              <>ابدأ <em className="fwh-italic">تحوّلك</em><br />اليوم.</>
            ) : (
              <>Start your<br /><em className="fwh-italic">transformation</em><br />today.</>
            )}
          </h2>
          <p style={{
            fontSize: 17, color: "var(--text-muted)", lineHeight: 1.7,
            maxWidth: 600, margin: "0 auto 48px",
          }}>
            {cms("cta", "subheading", isAr
              ? "انضم للآلاف اللي بدأوا رحلتهم. حسابك مجاني ومافيش قيود."
              : "Join thousands who already started. Your account is free with no strings attached.")}
          </p>
          <button
            onClick={() => navigate(cmsSections.cta?.btnLink || "/auth/register")}
            className="fwh-circle-cta"
            style={{ display: "inline-flex" }}
          >
            <span className="fwh-circle-arr">↗</span>
            <small>{cms("cta", "btnText", isAr ? "لنبدأ" : "Let's Talk")}</small>
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CURSOR-FOLLOW HOVER PREVIEW
          A single floating screenshot that follows the mouse when hovering
          over any feature row that has an `imageUrl` set in the CMS.
          Rendered once at the document level so it can escape section
          overflow:hidden boxes. Pointer-events: none so it never blocks
          clicks underneath. Hidden when hoverImage is null.
      ═══════════════════════════════════════════════════════════════════════ */}
      {hoverImage && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            // Offset 24px from cursor so the image doesn't sit directly under
            // the pointer (which would create flicker as the cursor enters/
            // exits the image bounds).
            left: mousePos.x + 24,
            top: mousePos.y + 24,
            width: 280,
            height: 200,
            pointerEvents: "none",
            zIndex: 9999,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            background: "var(--bg-surface)",
            // Subtle entrance.
            animation: "fwh-hover-pop 160ms ease-out",
          }}
        >
          <img
            src={hoverImage}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <style>{`@keyframes fwh-hover-pop {
            from { opacity: 0; transform: scale(0.92); }
            to   { opacity: 1; transform: scale(1); }
          }`}</style>
        </div>
      )}

    </div>
  );
}
