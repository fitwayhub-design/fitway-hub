import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/context/I18nContext";
import { useBranding } from "@/context/BrandingContext";
import { getApiBase } from "@/lib/api";
import {
  Dumbbell, Brain, BarChart2, Users, Bell, Globe,
  ArrowRight, CheckCircle, Trophy, Heart, Target, Zap,
  Instagram, Youtube, Twitter, Facebook,
} from "lucide-react";

// Map CMS icon string → lucide component, with sensible aliases. Mirrors the
// admin dropdown choices so any icon picked there renders here.
const ICON_MAP: Record<string, any> = {
  Dumbbell, Brain, BarChart: BarChart2, BarChart2, Users, Bell, Globe,
  ArrowRight, CheckCircle, Trophy, Heart, Target, Zap,
};

/* ─────────────────────────────────────────────────────────────────────────────
   About Page — FitWayHub Design System (April 2026)
   Same brand colors, same content as before, just the FWH visual layer:
     · Barlow Condensed display + Instrument Serif italic accents
     · Geist Mono kickers, 1px borders, 0px corners
     · Yellow brand color reused as --fwh-ac
   All section content can be moved into CMS later (admin already supports
   editing the home page; this page intentionally mirrors that taxonomy).
   ────────────────────────────────────────────────────────────────────────── */

const VALUES = [
  { icon: Heart,  en: { title: "Human First",       desc: "Every feature is built around real people, not metrics. We listen to our community." },
                   ar: { title: "الإنسان أولاً",       desc: "كل ميزة بنبنيها مصممة حوالين الناس الحقيقيين، مش الأرقام. بنسمع لمجتمعنا." } },
  { icon: Target, en: { title: "Science-Based",     desc: "Every workout, meal plan, and insight is backed by research and reviewed by certified professionals." },
                   ar: { title: "مبني على العلم",      desc: "كل تمرين وخطة غذاء ورؤية مدعومة ببحث ومراجعة من متخصصين معتمدين." } },
  { icon: Zap,    en: { title: "Accessible to All", desc: "Fitness shouldn't be a privilege. We built affordable plans for every budget and experience level." },
                   ar: { title: "متاح للجميع",         desc: "اللياقة مش رفاهية. بنبني خطط مناسبة لكل ميزانية ومستوى خبرة." } },
  { icon: Trophy, en: { title: "Results-Driven",    desc: "We obsess over your progress. Real coaches, real accountability, real transformations." },
                   ar: { title: "يهتم بالنتائج",        desc: "بنركّز على تقدمك. كوتشات حقيقيين، التزام حقيقي، تحولات حقيقية." } },
];

const FEATURES = [
  { icon: Dumbbell,  en: { title: "Certified Programs",       desc: "Structured workouts for all levels — from beginner to advanced athlete." },
                      ar: { title: "برامج معتمدة",              desc: "تمارين منظّمة لكل المستويات — من المبتدئ للرياضي المحترف." } },
  { icon: Users,     en: { title: "Certified Human Coaches", desc: "Real certified coaches — not bots — build plans tailored to your body, goals, and schedule." },
                      ar: { title: "كوتشات بشريين معتمدين",     desc: "كوتشات حقيقيين معتمدين — مش بوتات — بيبنوا خطط حسب جسمك وأهدافك وجدولك." } },
  { icon: BarChart2, en: { title: "Smart Analytics",          desc: "Visual dashboards track every step, calorie, and personal milestone." },
                      ar: { title: "تحليلات ذكية",              desc: "لوحات بصرية بتتابع كل خطوة وسعرة حرارية ومعلم شخصي." } },
  { icon: Bell,      en: { title: "Smart Reminders",          desc: "Nudges that keep you consistent without being annoying." },
                      ar: { title: "تذكيرات ذكية",              desc: "إشعارات بتخليك ملتزم من غير ما تكون مزعجة." } },
  { icon: Globe,     en: { title: "Fully Bilingual",          desc: "Every screen available in Arabic and English — built for Egypt, open to the world." },
                      ar: { title: "ثنائي اللغة بالكامل",        desc: "كل شاشة متاحة بالعربي والإنجليزي — مصمم لمصر، مفتوح للعالم." } },
];

const TEAM = [
  { emoji: "💪", en: { name: "Ahmed Hassan", role: "CEO & Co-Founder",   bio: "Former national athlete turned entrepreneur. Years of experience transforming the Egyptian fitness scene." },
                  ar: { name: "أحمد حسن",     role: "الرئيس التنفيذي والمؤسس", bio: "رياضي قومي سابق تحوّل لرائد أعمال. سنين خبرة في تحويل المشهد الرياضي المصري." } },
  { emoji: "🏆", en: { name: "Sara Mostafa", role: "Head of Coaching",   bio: "Certified trainer and nutritionist with hundreds of coached clients across Egypt and the Gulf." },
                  ar: { name: "سارة مصطفى",   role: "رئيسة قسم الكوتشينج",     bio: "مدربة وأخصائية تغذية معتمدة دربت مئات العملاء عبر مصر والخليج." } },
  { emoji: "⚡", en: { name: "Omar Khalid",  role: "CTO",                bio: "Full-stack engineer who believes the best tech is the kind you don't notice." },
                  ar: { name: "عمر خالد",     role: "المدير التقني",           bio: "مهندس برمجيات بيؤمن إن أفضل تكنولوجيا هي اللي مش بتحس بيها." } },
  { emoji: "❤️", en: { name: "Mona Adel",    role: "Head of Community",  bio: "Community builder, wellness advocate, and the person making sure every member feels seen." },
                  ar: { name: "منى عادل",     role: "رئيسة المجتمع",          bio: "بناء المجتمع، رفيقة العافية، والشخص اللي بيتأكد إن كل عضو شاعر إنه مرئي." } },
];

const TIMELINE = [
  { year: "2022", en: { title: "The Idea",     desc: "Two friends frustrated with overpriced gyms and generic apps decided to build something better." },
                   ar: { title: "الفكرة",         desc: "اتنين أصحاب زهقوا من أسعار الجيمات والتطبيقات العامة وقرروا يبنوا حاجة أحسن." } },
  { year: "2023", en: { title: "First Launch", desc: "FitWay Hub launched with its founding members and coaches. The waitlist grew rapidly." },
                   ar: { title: "أول إطلاق",      desc: "فيت واي هاب أطلق بأعضائه وكوتشاته المؤسسين. قائمة الانتظار كبرت بسرعة." } },
  { year: "2024", en: { title: "Growing Fast", desc: "Scaled the member base, onboarded more certified coaches, and launched live video coaching sessions." },
                   ar: { title: "نمو سريع",       desc: "وسعنا قاعدة الأعضاء، ضمينا كوتشات معتمدين أكتر، وأطلقنا جلسات الكوتشينج الحي بالفيديو." } },
  { year: "2025", en: { title: "Expanding",    desc: "Growing active member community. Expanding across North Africa and the Arab world." },
                   ar: { title: "التوسع",         desc: "مجتمع نشط متنامي. توسع عبر شمال إفريقيا والعالم العربي." } },
];

export default function AboutPage() {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const { branding } = useBranding();
  const isAr = lang === "ar";
  const accent = branding.primary_color || "#FFD600";

  const [liveStats, setLiveStats] = useState({ members: 0, coaches: 0, programs: 0, rating: "5.0" });
  // CMS-driven About content. Admin can manage the About page in /admin/website
  // by adding `features` / `team` sections to page = "about". When a section is
  // missing from CMS we fall back to the hardcoded defaults below so a fresh
  // install keeps working without admin setup.
  const [cmsSections, setCmsSections] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch(`${getApiBase()}/api/public/stats`)
      .then(r => r.json())
      .then(d => setLiveStats({ members: d.members || 0, coaches: d.coaches || 0, programs: d.programs || 0, rating: d.rating || "5.0" }))
      .catch(() => {});

    fetch(`${getApiBase()}/api/cms/sections/about`)
      .then(r => r.json())
      .then(d => {
        const map: Record<string, any> = {};
        (d.sections || []).forEach((s: any) => {
          try { map[s.type] = typeof s.content === "string" ? JSON.parse(s.content) : s.content; }
          catch { map[s.type] = s.content; }
        });
        setCmsSections(map);
      })
      .catch(() => {});
  }, []);

  // CMS text picker — same shape as Home.tsx. Prefers CMS value, then CMS_ar
  // when in Arabic, then falls back to the provided default. Admin can
  // override any field below by editing the matching section in /admin/website.
  const cms = (type: string, field: string, fallback: string) => {
    const sec = cmsSections[type];
    if (!sec) return fallback;
    const key = isAr ? `${field}_ar` : field;
    return sec[key] || sec[field] || fallback;
  };

  /* ── Cursor-follow hover preview (Why Fitway / Features) ─────────────────
     A floating screenshot tracks the mouse over feature rows that have an
     imageUrl set in CMS. Same pattern as Home.tsx. */
  const [hoverImage, setHoverImage] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverFrameRef = useRef<number | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
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

  /* ── Resolve values list — prefer CMS, fall back to VALUES const ──────── */
  const valueItems = (() => {
    const cmsItems = cmsSections.values?.items || cmsSections.cards?.items;
    if (cmsItems?.length) {
      return cmsItems.map((it: any) => ({
        Icon: ICON_MAP[it.icon] || Heart,
        title: isAr ? (it.title_ar || it.title) : (it.title || it.title_ar),
        desc:  isAr ? (it.desc_ar  || it.desc)  : (it.desc  || it.desc_ar),
      }));
    }
    return VALUES.map(v => {
      const t = isAr ? v.ar : v.en;
      return { Icon: v.icon, title: t.title, desc: t.desc };
    });
  })();

  /* ── Resolve timeline list — prefer CMS, fall back to TIMELINE const ──── */
  const timelineItems = (() => {
    const cmsItems = cmsSections.timeline?.items;
    if (cmsItems?.length) {
      return cmsItems.map((it: any) => ({
        year: it.year || "",
        title: isAr ? (it.title_ar || it.title) : (it.title || it.title_ar),
        desc:  isAr ? (it.desc_ar  || it.desc)  : (it.desc  || it.desc_ar),
      }));
    }
    return TIMELINE.map(item => {
      const t = isAr ? item.ar : item.en;
      return { year: item.year, title: t.title, desc: t.desc };
    });
  })();

  /* ── Resolve features list — prefer CMS, fall back to FEATURES const ──── */
  const featureItems = (() => {
    const cmsItems = cmsSections.features?.items;
    if (cmsItems?.length) {
      return cmsItems.map((it: any) => ({
        Icon: ICON_MAP[it.icon] || Dumbbell,
        title: isAr ? (it.title_ar || it.title) : (it.title || it.title_ar),
        desc:  isAr ? (it.desc_ar  || it.desc)  : (it.desc  || it.desc_ar),
        imageUrl: it.imageUrl || "",
      }));
    }
    return FEATURES.map(f => {
      const t = isAr ? f.ar : f.en;
      return { Icon: f.icon, title: t.title, desc: t.desc, imageUrl: "" };
    });
  })();

  /* ── Resolve team list — prefer CMS, fall back to TEAM const ──────────── */
  const teamMembers = (() => {
    const cmsMembers = cmsSections.team?.members;
    if (cmsMembers?.length) {
      return cmsMembers.map((m: any) => ({
        name:     isAr ? (m.name_ar || m.name) : (m.name || m.name_ar),
        role:     isAr ? (m.role_ar || m.role) : (m.role || m.role_ar),
        bio:      isAr ? (m.bio_ar  || m.bio)  : (m.bio  || m.bio_ar),
        imageUrl: m.imageUrl || "",
        emoji: "",
        socials: {
          linkedin: m.linkedin || "",
          twitter: m.twitter || "",
          instagram: m.instagram || "",
        },
      }));
    }
    return TEAM.map(m => {
      const t = isAr ? m.ar : m.en;
      return {
        name: t.name, role: t.role, bio: t.bio,
        imageUrl: "", emoji: m.emoji,
        socials: { linkedin: "", twitter: "", instagram: "" },
      };
    });
  })();

  const STATS = [
    { num: liveStats.members  > 0 ? `${liveStats.members.toLocaleString()}+` : "—", desc: isAr ? "عضو نشط على المنصة." : "Active members on the platform." },
    { num: liveStats.coaches  > 0 ? `${liveStats.coaches}+`                  : "—", desc: isAr ? "كوتش معتمد بشهادات موثقة." : "Vetted certified coaches." },
    { num: liveStats.programs > 0 ? `${liveStats.programs}+`                 : "—", desc: isAr ? "برنامج تدريب جاهز." : "Ready-made training programs." },
    { num: `${liveStats.rating}★`,                                                  desc: isAr ? "تقييم التطبيق." : "App rating from athletes." },
  ];

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-hero" style={{ overflow: "hidden", borderBottom: "1px solid var(--border)" }}>
        <div className="fwh-con" style={{ position: "relative", width: "100%" }}>
          <div className="fwh-section-meta">
            <span>{cms("hero", "metaLeft", isAr ? "من نحن · إصدار ٢٠٢٦" : "ABOUT · V.2026")}</span>
            <span>{cms("hero", "metaRight", isAr ? "قصتنا" : "Our Story")}</span>
          </div>
          <div className="fwh-kicker" style={{ marginBottom: 28 }}>
            {cms("hero", "badge", isAr ? "— من نحن" : "— Who We Are")}
          </div>
          {/* Hero heading: when admin has populated a `hero` section on the
              About page, use its heading + accent. Otherwise fall back to
              the seeded multi-line markup. */}
          <h1 className="fwh-hero-h1">
            {cmsSections.hero ? (
              <>
                {cms("hero", "heading", "")}
                {cms("hero", "headingAccent", "") && (
                  <> <em className="fwh-italic">{cms("hero", "headingAccent", "")}</em></>
                )}
              </>
            ) : isAr ? (
              <>نبني أفضل جيل <em className="fwh-italic">رياضي</em><br /><span className="fwh-stroke">في العالم العربي.</span></>
            ) : (
              <>Building Egypt's<br /><em className="fwh-italic">fittest</em><br /><span className="fwh-stroke">generation.</span></>
            )}
          </h1>
          <p className="fwh-hero-sub">
            {cms("hero", "subheading", isAr
              ? "فيت واي هاب منصة لياقة رقمية متكاملة تجمع التدريب المعتمد، التحليلات الذكية، وكوتشات حقيقيين — كل ذلك في تطبيق واحد."
              : "Fitway Hub is a complete digital fitness ecosystem combining certified training, smart analytics, and real human coaching — all in one app.")}
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <button className="fwh-btn" onClick={() => navigate(cmsSections.hero?.primaryBtnLink || "/auth/register")}>
              {cms("hero", "primaryBtnText", isAr ? "ابدأ مجاناً" : "Start Free Today")}
              <span className="fwh-btn-arr"><ArrowRight size={14} /></span>
            </button>
            <button className="fwh-btn-outline" onClick={() => navigate(cmsSections.hero?.secondaryBtnLink || "/blogs")}>
              <span>{cms("hero", "secondaryBtnText", isAr ? "اقرأ المدونة" : "Read the Blog")}</span>
              <span className="fwh-btn-outline-arr">↗</span>
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          STATS
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 32, height: 1, background: accent, display: "inline-block" }} />
              <span style={{ color: accent, textTransform: "none", letterSpacing: "0.02em", fontSize: 13, fontFamily: "var(--font-en)" }}>
                {isAr ? "— بالأرقام" : "— By the Numbers"}
              </span>
              <span>(02)</span>
            </span>
            <span>{isAr ? "نشاط مستمر" : "Continuous activity"}</span>
          </div>
          <h2 className="fwh-s-h" style={{ marginBottom: 56, maxWidth: 1000 }}>
            {isAr ? <>الأرقام <em className="fwh-italic">تحكي</em> القصة.</> : <>Numbers that <em className="fwh-italic">tell</em> the story.</>}
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
          MISSION
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section">
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span>Mission — 03</span>
            <span>{isAr ? "ما نؤمن به" : "What we believe"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)", gap: 64, alignItems: "start" }} className="fwh-about-split">
            <div>
              <div className="fwh-kicker" style={{ marginBottom: 24 }}>{isAr ? "— مهمتنا" : "— Our Mission"}</div>
              <h2 className="fwh-s-h">
                {isAr ? <>اللياقة لكل الناس، <em className="fwh-italic">مش بس الأثرياء.</em></>
                      : <>Fitness for everyone, <em className="fwh-italic">not just the privileged.</em></>}
              </h2>
              <p style={{ fontSize: 17, color: "var(--text-secondary)", lineHeight: 1.7, marginTop: 28, fontWeight: 400 }}>
                {isAr
                  ? "فيت واي هاب اتبنت على إيمان واحد: كل شخص يستحق وصول لتدريب احترافي. بنجسر الفجوة بين الكوتشات المعتمدين والناس اللي عايزين يغيروا حياتهم."
                  : "Fitway Hub was founded on one belief: everyone deserves access to expert fitness guidance. We bridge the gap between certified coaches and people who want to change their lives — regardless of budget, location, or experience level."}
              </p>
              <p style={{ fontSize: 17, color: "var(--text-secondary)", lineHeight: 1.7, marginTop: 16, fontWeight: 400 }}>
                {isAr
                  ? "من خطط التمرين المخصصة من كوتشات معتمدين لجلسات الكوتشينج الحية، كل ميزة بنبنيها مصممة تقربك من هدفك."
                  : "From personalised plans built by certified coaches to live coaching sessions, every feature we build is designed to move you closer to your goal."}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "32px 0 0", display: "flex", flexDirection: "column", gap: 14, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                {[
                  isAr ? "تدريب معتمد من خبراء حقيقيين" : "Certified training by real experts",
                  isAr ? "أسعار مناسبة لكل الميزانيات" : "Affordable for every budget",
                  isAr ? "مجتمع داعم بالعربي والإنجليزي" : "Supportive community in Arabic & English",
                ].map((item, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <CheckCircle size={18} strokeWidth={2.2} style={{ color: accent, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500 }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="fwh-card" style={{ padding: 0 }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <div className="fwh-card-eyebrow">{isAr ? "نظرة سريعة" : "At a glance / 03"}</div>
                <div className="fwh-card-title" style={{ fontSize: 22, marginTop: 6 }}>
                  {isAr ? "ملخص المنصة" : "Platform Snapshot"}
                </div>
              </div>
              {[
                { emoji: "🏋️", title: isAr ? "تمارين معتمدة" : "Certified Workouts", v: liveStats.programs > 0 ? `${liveStats.programs}+` : "—" },
                { emoji: "🧠", title: isAr ? "رؤى ذكية"      : "Smart Insights",     v: isAr ? "يومياً" : "Daily" },
                { emoji: "👥", title: isAr ? "كوتشات حقيقيين" : "Real Coaches",       v: liveStats.coaches > 0 ? `${liveStats.coaches}+` : "—" },
                { emoji: "📱", title: isAr ? "أجهزة مدعومة"   : "Platforms",          v: "iOS & Android" },
              ].map((item, i, arr) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 24px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 22 }}>{item.emoji}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.title}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: accent, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          VALUES
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span>Values — 04</span>
            <span>{isAr ? "ما يهمنا" : "What we stand for"}</span>
          </div>
          <div className="fwh-kicker" style={{ marginBottom: 24 }}>{isAr ? "— قيمنا" : "— Our Values"}</div>
          <h2 className="fwh-s-h" style={{ marginBottom: 56, maxWidth: 1000 }}>
            {isAr ? <>ما <em className="fwh-italic">يهمنا.</em></> : <>What we <em className="fwh-italic">stand for.</em></>}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {valueItems.map((v: any, i: number) => {
              const Icon = v.Icon || Heart;
              return (
                <div key={i} className="fwh-card">
                  <div className="fwh-card-eyebrow">{`0${i + 1} / ${isAr ? "قيمة" : "Value"}`}</div>
                  <Icon size={28} strokeWidth={1.6} style={{ color: accent, marginTop: 16, marginBottom: 16 }} />
                  <div className="fwh-card-title">{v.title}</div>
                  <div className="fwh-card-body">{v.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section">
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span>Features — 05</span>
            <span>{isAr ? "كل ما تحتاجه" : "Everything you need"}</span>
          </div>
          <div className="fwh-kicker" style={{ marginBottom: 24 }}>{isAr ? "— الميزات" : "— Features"}</div>
          <h2 className="fwh-s-h" style={{ marginBottom: 40, maxWidth: 1000 }}>
            {isAr ? <>كل اللي محتاجه <em className="fwh-italic">في مكان واحد.</em></>
                  : <>Everything in <em className="fwh-italic">one place.</em></>}
          </h2>
          <div>
            {featureItems.map((f: any, i: number) => {
              const Icon = f.Icon || Dumbbell;
              // Hover handlers — only attach when the feature has an admin-
              // uploaded screenshot, otherwise the row stays a plain block.
              const onEnter = () => f.imageUrl && setHoverImage(f.imageUrl);
              const onLeave = () => setHoverImage(null);
              return (
                <div
                  key={i}
                  className="fwh-service-row"
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                  style={{ cursor: f.imageUrl ? "none" : "default" }}
                  role="group"
                >
                  <div className="fwh-service-num">{String(i + 1).padStart(2, "0")} —</div>
                  <div className="fwh-service-title" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Icon size={22} strokeWidth={1.6} style={{ color: accent, flexShrink: 0 }} />
                    <span>{f.title}</span>
                  </div>
                  <div style={{
                    fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)",
                    fontFamily: "var(--font-en)",
                  }}>
                    {f.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          TIMELINE
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span>Journey — 06</span>
            <span>{isAr ? "رحلتنا" : "Our path"}</span>
          </div>
          <div className="fwh-kicker" style={{ marginBottom: 24 }}>{isAr ? "— رحلتنا" : "— Our Journey"}</div>
          <h2 className="fwh-s-h" style={{ marginBottom: 56, maxWidth: 1000 }}>
            {isAr ? <>من فكرة <em className="fwh-italic">إلى منصة.</em></>
                  : <>From idea <em className="fwh-italic">to platform.</em></>}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {timelineItems.map((item: any, i: number) => (
              <div key={i} className="fwh-card">
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}>
                  {String(i + 1).padStart(2, "0")} / {isAr ? "فصل" : "Chapter"}
                </div>
                <div style={{
                  fontFamily: "var(--font-heading)", fontSize: 56, fontWeight: 600,
                  lineHeight: 1, color: accent, marginTop: 12, letterSpacing: "-0.02em",
                }}>{item.year}</div>
                <div className="fwh-card-title" style={{ marginTop: 14 }}>{item.title}</div>
                <div className="fwh-card-body">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          TEAM
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section">
        <div className="fwh-con">
          <div className="fwh-section-meta">
            <span>Team — 07</span>
            <span>{isAr ? "الفريق" : "The team"}</span>
          </div>
          <div className="fwh-kicker" style={{ marginBottom: 24 }}>{isAr ? "— فريقنا" : "— Our Team"}</div>
          <h2 className="fwh-s-h" style={{ maxWidth: 1000 }}>
            {isAr ? <>بُني بواسطة <em className="fwh-italic">عشاق اللياقة.</em></>
                  : <>Built by <em className="fwh-italic">fitness lovers.</em></>}
          </h2>
          <p style={{ fontSize: 17, color: "var(--text-secondary)", maxWidth: 640, lineHeight: 1.55, fontWeight: 400, marginTop: 16, marginBottom: 56 }}>
            {isAr ? "فريقنا من الرياضيين والمدربين والمطورين كلهم بيؤمن بقوة اللياقة في تغيير الحياة."
                  : "Our team of athletes, coaches, and engineers all believe in fitness's power to transform lives."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {teamMembers.map((m: any, i: number) => (
              <div key={i} className="fwh-card">
                {/* Profile image: prefers admin-uploaded `imageUrl`, falls
                    back to the legacy emoji avatar if the team member has no
                    image set yet. */}
                {m.imageUrl ? (
                  <img
                    src={m.imageUrl}
                    alt={m.name}
                    loading="lazy"
                    style={{
                      width: 72, height: 72, borderRadius: "50%",
                      objectFit: "cover", marginBottom: 20,
                      border: "1px solid var(--border)",
                      background: "var(--bg-surface)",
                    }}
                    onError={(e) => {
                      // Defensive: if the URL fails (network / removed file),
                      // hide the broken-image icon rather than show it.
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div style={{
                    width: 72, height: 72,
                    background: accent, color: "#0a0a0a",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32, marginBottom: 20,
                    border: "1px solid var(--border)",
                  }}>
                    {m.emoji || m.name?.[0] || "?"}
                  </div>
                )}
                <div className="fwh-card-eyebrow">{`0${i + 1} / Team`}</div>
                <div className="fwh-card-title" style={{ marginTop: 6 }}>{m.name}</div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: accent, marginTop: 4, marginBottom: 14,
                  paddingBottom: 14, borderBottom: "1px solid var(--border)",
                }}>{m.role}</div>
                <div className="fwh-card-body">{m.bio}</div>
                {/* Socials (only render rows that have a value set) */}
                {(m.socials.linkedin || m.socials.twitter || m.socials.instagram) && (
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    {m.socials.instagram && (
                      <a href={m.socials.instagram} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on Instagram`}
                         style={{ color: "var(--text-secondary)" }}><Instagram size={16} /></a>
                    )}
                    {m.socials.twitter && (
                      <a href={m.socials.twitter} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on Twitter`}
                         style={{ color: "var(--text-secondary)" }}><Twitter size={16} /></a>
                    )}
                    {m.socials.linkedin && (
                      <a href={m.socials.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn`}
                         style={{ color: "var(--text-secondary)" }}><Facebook size={16} /></a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="fwh-section" style={{ borderTop: "1px solid var(--border)", textAlign: "center", padding: "120px 24px" }}>
        <div className="fwh-con">
          <div className="fwh-kicker" style={{ marginBottom: 24, justifyContent: "center", display: "inline-flex" }}>
            {isAr ? "— ابدأ الآن" : "— Start Now"}
          </div>
          <h2 className="fwh-hero-h1" style={{ fontSize: "clamp(64px, 9vw, 140px)" }}>
            {isAr ? <>مستعد <em className="fwh-italic">تبدأ رحلتك؟</em></>
                  : <>Ready to <em className="fwh-italic">start your journey?</em></>}
          </h2>
          <p className="fwh-hero-sub" style={{ margin: "20px auto 0", maxWidth: 580 }}>
            {isAr
              ? `انضم لـ ${liveStats.members > 0 ? liveStats.members.toLocaleString() + "+" : "آلاف من الأعضاء"} بيحولوا حياتهم مع فيت واي هاب.`
              : `Join ${liveStats.members > 0 ? liveStats.members.toLocaleString() + "+" : "thousands of"} members already transforming their lives with Fitway Hub.`}
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 40 }}>
            <button className="fwh-btn" onClick={() => navigate("/auth/register")}>
              {isAr ? "أنشئ حساب مجاني" : "Create Free Account"}
              <span className="fwh-btn-arr"><ArrowRight size={14} /></span>
            </button>
            <button className="fwh-btn-outline" onClick={() => navigate("/contact")}>
              <span>{isAr ? "تواصل معنا" : "Contact Us"}</span>
              <span className="fwh-btn-outline-arr">↗</span>
            </button>
          </div>
          {/* Social chips */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 56 }}>
            {[
              { icon: Instagram, href: "#", label: "Instagram" },
              { icon: Facebook,  href: "#", label: "Facebook" },
              { icon: Twitter,   href: "#", label: "Twitter" },
              { icon: Youtube,   href: "#", label: "YouTube" },
            ].map(({ icon: Icon, href, label }, i) => (
              <a
                key={i}
                href={href}
                aria-label={label}
                style={{
                  width: 44, height: 44,
                  border: "1px solid var(--border)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-primary)", textDecoration: "none",
                  transition: "all 250ms ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = accent; (e.currentTarget as HTMLAnchorElement).style.color = accent; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)"; }}
              >
                <Icon size={18} strokeWidth={1.6} />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CURSOR-FOLLOW HOVER PREVIEW (Features section)
          Floats next to the cursor while hovering a feature row whose CMS
          item has an `imageUrl`. Pointer-events: none so it never intercepts
          clicks; rendered at the document root so it escapes section overflow.
      ═══════════════════════════════════════════════════════════════════════ */}
      {hoverImage && (
        <div
          aria-hidden
          style={{
            position: "fixed",
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
            animation: "fwh-about-hover-pop 160ms ease-out",
          }}
        >
          <img src={hoverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <style>{`@keyframes fwh-about-hover-pop {
            from { opacity: 0; transform: scale(0.92); }
            to   { opacity: 1; transform: scale(1); }
          }`}</style>
        </div>
      )}

    </div>
  );
}
