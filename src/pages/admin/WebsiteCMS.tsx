import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect, useRef, type ReactNode, type ChangeEvent } from "react";
import { Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Edit3, Save, X, Upload, Image, Globe, Layout, Type, AlignLeft, Grid, Layers, ExternalLink, Users, HelpCircle, Target, Tag } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface Section {
  id: number;
  page: string;
  type: string;
  label: string;
  content: any;
  sort_order: number;
  is_visible: number;
}

const PAGES = ["home", "about", "contact"] as const;
type Page = typeof PAGES[number];

const SECTION_TYPES: { type: string; label: string; icon: any; defaultContent: any }[] = [
  { type: "hero", label: "Hero Banner", icon: Layout,
    defaultContent: { badge: "", heading: "Your Heading Here", headingAccent: "Accent Text", subheading: "Your subheading text goes here.", primaryBtnText: "Get Started", primaryBtnLink: "/auth/register", secondaryBtnText: "Learn More", secondaryBtnLink: "/about", backgroundImage: "", widthMode: "boxed" } },
  { type: "portal_select", label: "Portal Selector (Athlete / Coach)", icon: Users,
    defaultContent: {
      eyebrow: "— Choose Your Path",
      eyebrow_ar: "— اختر مسارك",
      heading: "Athlete or Coach.",
      heading_ar: "رياضي أم مدرب.",
      headingAccent: "or",
      headingAccent_ar: "أم",
      athleteLabel: "I'm an Athlete",
      athleteLabel_ar: "أنا رياضي",
      athleteLink: "/auth/register?role=user",
      coachLabel: "I'm a Coach",
      coachLabel_ar: "أنا مدرب",
      coachLink: "/auth/register?role=coach",
    } },
  { type: "stats", label: "Stats Bar", icon: Grid,
    defaultContent: { items: [{ value: "1K+", label: "Members" }, { value: "50+", label: "Programs" }, { value: "4.9★", label: "Rating" }, { value: "98%", label: "Satisfaction" }] } },
  { type: "features", label: "Features Grid", icon: Grid,
    defaultContent: { sectionLabel: "Features", sectionLabel_ar: "المميزات", heading: "Everything you need in one app", heading_ar: "كل اللي محتاجه في تطبيق واحد", intro: "Workouts, certified coaches, smart analytics, community — all in one place.", intro_ar: "من التمارين للكوتشات للتحليلات والمجتمع — كل أدواتك في مكان واحد.", items: [
      { icon: "Dumbbell",   title: "Workouts",                     title_ar: "التمارين",                   desc: "Video-guided programs for every level with progress tracking and form tips.",                         desc_ar: "برامج بالفيديو لكل المستويات مع تتبع التقدم ونصائح الأداء." },
      { icon: "Users",      title: "Connect to Certified Coaches", title_ar: "تواصل مع كوتشات معتمدين",    desc: "Book 1-on-1 sessions with certified coaches for personalized plans and real accountability.",       desc_ar: "احجز جلسات فردية مع كوتشات معتمدين لخطط مخصصة ومتابعة حقيقية." },
      { icon: "BarChart",   title: "Smart Analytics",              title_ar: "تحليلات ذكية",                desc: "Visual dashboards track every step, calorie, and personal milestone in real time.",                  desc_ar: "لوحات بصرية تتابع كل خطوة وسعرة حرارية وإنجاز شخصي لحظة بلحظة." },
      { icon: "MessageCircle", title: "Community & Challenges",    title_ar: "المجتمع والتحديات",          desc: "Share progress, join challenges, and stay motivated with thousands of members.",                     desc_ar: "شارك تقدمك، انضم للتحديات، وابقَ متحمساً مع آلاف الأعضاء." },
    ] } },
  { type: "text_image", label: "Text + Image", icon: AlignLeft,
    defaultContent: { sectionLabel: "", heading: "Section Heading", text: "Your text content goes here.", bullets: ["Point one", "Point two", "Point three"], imageSide: "right", imageUrl: "", linkText: "Learn more", linkUrl: "/" } },
  { type: "cards", label: "Cards Grid", icon: Layers,
    defaultContent: { sectionLabel: "", heading: "Cards Title", items: [{ icon: "Target", title: "Card 1", desc: "Description here", color: "accent" }, { icon: "Eye", title: "Card 2", desc: "Description here", color: "blue" }] } },
  { type: "values", label: "Values Grid (About)", icon: Layers,
    defaultContent: {
      sectionLabel: "Values — 04",
      sectionLabel_ar: "القيم — ٠٤",
      sectionMeta: "What we stand for",
      sectionMeta_ar: "ما يهمنا",
      eyebrow: "— Our Values",
      eyebrow_ar: "— قيمنا",
      heading: "What we",
      heading_ar: "ما",
      headingAccent: "stand for.",
      headingAccent_ar: "يهمنا.",
      items: [
        { icon: "Heart",  title: "Human First", title_ar: "الإنسان أولاً",
          desc: "Every feature is built around real people, not metrics. We listen to our community.",
          desc_ar: "كل ميزة بنبنيها مصممة حوالين الناس الحقيقيين، مش الأرقام. بنسمع لمجتمعنا." },
      ],
    } },
  { type: "mission", label: "Mission (About)", icon: Target,
    defaultContent: {
      sectionLabel: "Mission — 03",
      sectionLabel_ar: "المهمة — ٠٣",
      sectionMeta: "What we believe",
      sectionMeta_ar: "ما نؤمن به",
      eyebrow: "— Our Mission",
      eyebrow_ar: "— مهمتنا",
      heading: "Fitness for everyone,",
      heading_ar: "اللياقة لكل الناس،",
      headingAccent: "not just the privileged.",
      headingAccent_ar: "مش بس الأثرياء.",
      body1: "Fitway Hub was founded on one belief: everyone deserves access to expert fitness guidance.",
      body1_ar: "فيت واي هاب اتبنت على إيمان واحد: كل شخص يستحق وصول لتدريب احترافي.",
      body2: "From personalised plans built by certified coaches to live coaching sessions, every feature we build is designed to move you closer to your goal.",
      body2_ar: "من خطط التمرين المخصصة من كوتشات معتمدين لجلسات الكوتشينج الحية، كل ميزة بنبنيها مصممة تقربك من هدفك.",
      bullets: [
        "Certified training by real experts",
        "Affordable for every budget",
        "Supportive community in Arabic & English",
      ],
      bullets_ar: [
        "تدريب معتمد من خبراء حقيقيين",
        "أسعار مناسبة لكل الميزانيات",
        "مجتمع داعم بالعربي والإنجليزي",
      ],
      snapshotEyebrow: "At a glance / 03",
      snapshotEyebrow_ar: "نظرة سريعة",
      snapshotTitle: "Platform Snapshot",
      snapshotTitle_ar: "ملخص المنصة",
      snapshotRows: [
        { emoji: "🏋️", title: "Certified Workouts", title_ar: "تمارين معتمدة", value: "—", value_ar: "—" },
        { emoji: "🧠", title: "Smart Insights",     title_ar: "رؤى ذكية",      value: "Daily", value_ar: "يومياً" },
        { emoji: "👥", title: "Real Coaches",       title_ar: "كوتشات حقيقيين", value: "—", value_ar: "—" },
        { emoji: "📱", title: "Platforms",          title_ar: "أجهزة مدعومة",   value: "iOS & Android", value_ar: "iOS و Android" },
      ],
    } },
  { type: "cta", label: "CTA Banner", icon: ExternalLink,
    defaultContent: { badge: "JOIN US", heading: "Your Call to Action", subheading: "Supporting text here.", btnText: "Get Started", btnLink: "/auth/register", widthMode: "boxed" } },
  { type: "contact_info", label: "Contact Info + FAQ", icon: Type,
    defaultContent: { phone: "+1 234 567 8900", email: "hello@example.com", chatHours: "9am – 5pm", faqs: [{ q: "Question here?", a: "Answer here." }] } },
  { type: "calculator", label: "Calorie Calculator", icon: Grid,
    defaultContent: { sectionLabel: "Free Tool", heading: "Calorie Calculator" } },
  { type: "latest_blogs", label: "Our Blog", icon: Type,
    defaultContent: { sectionLabel: "OUR BLOG", heading: "Latest Articles" } },
  { type: "team", label: "Team Section", icon: Users,
    defaultContent: {
      sectionLabel: "WHO WE ARE",
      heading: "Meet the Team",
      subheading: "The people behind the brand.",
      members: [
        { name: "Member Name", role: "Role", bio: "Short bio", imageUrl: "", linkedin: "", twitter: "", instagram: "" },
      ],
    } },
  { type: "timeline", label: "Timeline / Journey", icon: Layers,
    defaultContent: {
      sectionLabel: "Our Journey",
      sectionLabel_ar: "رحلتنا",
      heading: "From idea to platform.",
      heading_ar: "من فكرة إلى منصة.",
      items: [
        { year: "2022", title: "Chapter 1", title_ar: "الفصل ١",
          desc: "What happened in this year.", desc_ar: "ما حدث في هذا العام." },
      ],
    } },
  { type: "trust", label: "Trust Indicators", icon: Layers,
    defaultContent: {
      // No section heading by default — these are small badges below the hero.
      items: [
        { icon: "Award", label: "Certified", label_ar: "معتمد" },
      ],
    } },
  { type: "steps", label: "How It Works (Steps)", icon: Layers,
    defaultContent: {
      sectionLabel: "How It Works",
      sectionLabel_ar: "كيف يعمل",
      heading: "Start in 4 simple steps.",
      heading_ar: "ابدأ في ٤ خطوات بسيطة.",
      items: [
        { step: "01", icon: "Smartphone", title: "Create Account", title_ar: "أنشئ حساب",
          desc: "Sign up free in seconds.", desc_ar: "سجّل مجاناً في ثواني." },
      ],
    } },
  { type: "marquee", label: "Marquee Words (scrolling)", icon: Type,
    defaultContent: {
      // Comma-separated lists, one for each language.
      words: "FITNESS, COMMUNITY, RESULTS, COACHING",
      words_ar: "لياقة, مجتمع, نتائج, كوتشينج",
    } },
  { type: "rich_text", label: "Rich Text Block", icon: AlignLeft,
    defaultContent: {
      sectionLabel: "Section Label",
      sectionLabel_ar: "عنوان القسم",
      heading: "Section Heading",
      heading_ar: "عنوان القسم",
      body: "Paragraph text. Lines separated by blank lines render as separate paragraphs.",
      body_ar: "نص الفقرة. الأسطر المنفصلة بسطر فارغ تعرض كفقرات منفصلة.",
    } },
  { type: "testimonials", label: "Testimonials / Reviews", icon: Users,
    defaultContent: {
      sectionLabel: "Real Results",
      sectionLabel_ar: "نتائج حقيقية",
      heading: "Real people. Real transformations.",
      heading_ar: "أشخاص حقيقيون. تحوّلات مذهلة.",
      items: [
        // Each testimonial: name, name_ar, meta (e.g. "−15kg · 3 months"),
        // meta_ar, quote, quote_ar, imageUrl (admin upload).
        { name: "Member Name", name_ar: "اسم العضو", meta: "Result · Duration", meta_ar: "النتيجة · المدة",
          quote: "Their transformation story in their own words.", quote_ar: "قصة التحول بكلماتهم.", imageUrl: "" },
      ],
    } },
  { type: "carousel", label: "Image Carousel", icon: Image,
    defaultContent: {
      sectionLabel: "WHAT WE OFFER",
      heading: "Our Solutions",
      widthMode: "boxed",
      items: [
        { title: "Slide Title", desc: "Slide description", imageUrl: "" },
      ],
    } },
  { type: "faq", label: "FAQ Section", icon: HelpCircle,
    defaultContent: {
      sectionLabel: "FREQUENTLY ASKED QUESTIONS",
      heading: "Everything you need to know",
      subheading: "Answers to common questions",
      faqs: [
        { q: "Question here?", a: "Answer here." },
      ],
    } },
  { type: "html", label: "Custom HTML", icon: Type,
    defaultContent: { html: "<div><h2>Custom HTML Section</h2><p>Edit this in the admin panel.</p></div>" } },
];

const ICON_OPTIONS = ["Dumbbell", "Brain", "BarChart", "Users", "Target", "Eye", "Shield", "Globe", "BookOpen", "Heart", "Zap", "Star", "Award", "Activity", "Smartphone"];
const COLOR_OPTIONS = ["accent", "blue", "cyan", "amber", "red"];

/* Shared field-label class — small uppercase caption above each input. */
const fieldLabel = "text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";

interface Props {
  token: string | null;
  showMsg: (m: string) => void;
}

export default function WebsiteCMS({ token, showMsg }: Props) {
  const { t, lang } = useI18n();
  const l = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [activePage, setActivePage] = useState<Page>("home");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<any>({});
  const [editLabel, setEditLabel] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState(SECTION_TYPES[0].type);
  const [addLabel, setAddLabel] = useState(SECTION_TYPES[0].label);
  const [saving, setSaving] = useState(false);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingForm, setBrandingForm] = useState<Record<string, string>>({});
  const [appSettings, setAppSettings] = useState<any[]>([]);
  const [appSettingsForm, setAppSettingsForm] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const api = (path: string, opts?: RequestInit & { rawBody?: boolean }) => {
    const hdrs: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (!opts?.rawBody) hdrs["Content-Type"] = "application/json";
    return apiFetch(path, { ...opts, headers: { ...hdrs, ...(opts?.headers || {}) } });
  };

  const apiForm = (path: string, body: FormData) =>
    apiFetch(path, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });

  const loadBranding = async () => {
    setBrandingLoading(true);
    try {
      const r = await api("/api/admin/app-settings");
      const d = await r.json();
      const rows = (d?.settings || []) as any[];
      const brandingRows = rows.filter((s: any) => s.category === "branding");
      const map: Record<string, string> = {};
      for (const s of brandingRows) map[s.setting_key] = s.setting_value || "";
      setBrandingForm(map);
    } catch {
      showMsg(t("cms_failed_load_branding"));
    } finally {
      setBrandingLoading(false);
    }
  };

  const saveBranding = async () => {
    setBrandingSaving(true);
    try {
      // Colours, fonts and button-hover effect are intentionally NOT saved
      // here — they are hard-coded in the app theme and no longer editable.
      const keys = [
        "app_name", "app_tagline", "logo_url_en_light", "logo_url_en_dark", "logo_url_ar_light", "logo_url_ar_dark", "favicon_url", "footer_text", "copyright_text",
        "social_instagram", "social_facebook", "social_twitter", "social_youtube", "social_tiktok",
        "coming_soon_enabled", "coming_soon_bg_image", "coming_soon_text", "coming_soon_text_ar",
      ];

      for (const key of ["logo_url_en_light", "logo_url_en_dark", "logo_url_ar_light", "logo_url_ar_dark", "coming_soon_enabled", "coming_soon_bg_image", "coming_soon_text", "coming_soon_text_ar"]) {
        if (!(key in brandingForm)) {
          try {
            await api("/api/admin/app-settings/add", {
              method: "POST",
              body: JSON.stringify({ key, value: "", type: "text", category: "branding", label: key }),
            });
          } catch {
            // Ignore if key already exists.
          }
        }
      }

      const payload: Record<string, string> = {};
      for (const k of keys) payload[k] = brandingForm[k] || "";
      const r = await api("/api/admin/app-settings", { method: "PUT", body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("save failed");
      showMsg(t("cms_branding_saved"));
      window.dispatchEvent(new Event("branding:refresh"));
      loadBranding();
    } catch {
      showMsg(t("cms_failed_save_branding"));
    } finally {
      setBrandingSaving(false);
    }
  };

  const uploadBrandingImage = async (key: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    try {
      const resp = await apiFetch("/api/admin/upload-branding-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await resp.json().catch(() => ({} as any));
      if (!resp.ok || !d?.url) throw new Error(d?.message || `upload failed (${resp.status})`);
      setBrandingForm(prev => ({ ...prev, [key]: d.url }));

      if (!(key in brandingForm)) {
        try {
          await api("/api/admin/app-settings/add", {
            method: "POST",
            body: JSON.stringify({ key, value: "", type: "text", category: "branding", label: key }),
          });
        } catch {
          // Ignore if key already exists.
        }
      }

      // Persist the uploaded image URL immediately so branding context can read it.
      const saveResp = await api("/api/admin/app-settings", {
        method: "PUT",
        body: JSON.stringify({ [key]: d.url }),
      });
      if (!saveResp.ok) throw new Error("save failed");

      showMsg(t("cms_image_uploaded"));
      window.dispatchEvent(new Event("branding:refresh"));
      await loadBranding();
    } catch (err: any) {
      const reason = err?.message ? `: ${err.message}` : "";
      showMsg(`${t("cms_failed_upload_branding_image")}${reason}`);
    }
  };

  const fetchAppSettings = async () => {
    try {
      const r = await api("/api/admin/app-settings");
      const d = await r.json();
      const all = d.settings || [];
      setAppSettings(all);
      const form: Record<string, string> = {};
      all.forEach((s: any) => form[s.setting_key] = s.setting_value);
      setAppSettingsForm(form);
    } catch {}
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const r = await api(`/api/cms/admin/sections/${activePage}`);
    const d = await r.json();
    setSections(d.sections || []);
    setLoading(false);
  };

  useEffect(() => { load(); setEditingId(null); }, [activePage]);
  useAutoRefresh(() => load(true));
  useEffect(() => { loadBranding(); }, []);

  const toggleVisible = async (s: Section) => {
    await api(`/api/cms/admin/sections/${s.id}`, { method: "PUT", body: JSON.stringify({ is_visible: !s.is_visible }) });
    setSections(prev => prev.map(x => x.id === s.id ? { ...x, is_visible: x.is_visible ? 0 : 1 } : x));
  };

  const deleteSection = async (id: number) => {
    if (!confirm(t("cms_delete_section_confirm"))) return;
    await api(`/api/cms/admin/sections/${id}`, { method: "DELETE" });
    setSections(prev => prev.filter(x => x.id !== id));
    showMsg(t("cms_section_deleted"));
  };

  const moveSection = async (id: number, dir: "up" | "down") => {
    const idx = sections.findIndex(s => s.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sections.length - 1) return;
    const newSections = [...sections];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    const orders = newSections.map((s, i) => ({ id: s.id, sort_order: i + 1 }));
    setSections(newSections.map((s, i) => ({ ...s, sort_order: i + 1 })));
    await api("/api/cms/admin/sections/reorder", { method: "POST", body: JSON.stringify({ orders }) });
  };

  const startEdit = (s: Section) => {
    setEditingId(s.id);
    setEditContent(JSON.parse(JSON.stringify(s.content)));
    setEditLabel(s.label);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    await api(`/api/cms/admin/sections/${editingId}`, { method: "PUT", body: JSON.stringify({ label: editLabel, content: editContent }) });
    setSections(prev => prev.map(s => s.id === editingId ? { ...s, label: editLabel, content: editContent } : s));
    setEditingId(null);
    setSaving(false);
    showMsg(t("cms_section_saved"));
  };

  const addSection = async () => {
    const typeDef = SECTION_TYPES.find(t => t.type === addType)!;
    const r = await api("/api/cms/admin/sections", {
      method: "POST",
      body: JSON.stringify({ page: activePage, type: addType, label: addLabel || typeLabel(addType), content: typeDef.defaultContent }),
    });
    const d = await r.json();
    setSections(prev => [...prev, d.section]);
    setShowAddModal(false);
    setAddLabel("");
    showMsg(t("cms_section_added"));
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    const r = await apiForm("/api/cms/admin/upload-image", formData);
    const d = await r.json();
    if (d.url) {
      setEditContent((prev: any) => ({ ...prev, [field]: d.url }));
      showMsg(t("cms_image_uploaded"));
    }
    setUploadingFor(null);
  };

  // Section-background editor: appears for every section type, exposing a
  // theme-aware background image (dark + light + legacy single-image
  // fallback) plus per-theme opacity sliders. The website's `sectionBg(type)`
  // helper reads these fields and renders an absolute-positioned overlay
  // behind the section's content.
  const renderSectionBackgroundFields = () => {
    const c = editContent;
    const set = (field: string, value: any) =>
      setEditContent((prev: any) => ({ ...prev, [field]: value }));
    const bgField = (field: string, label: string) => (
      <div className="grid gap-2">
        <Label className={fieldLabel}>{label}</Label>
        <div className="flex gap-2">
          <Input className="flex-1" value={c[field] || ""} onChange={e => set(field, e.target.value)} placeholder={t("cms_paste_image_url") + "..."} />
          <Button type="button" variant="outline" size="icon" aria-label={`${t("upload")} — ${label}`} onClick={() => { setUploadingFor(field); fileInputRef.current?.click(); }}>
            <Upload size={16} strokeWidth={2} />
          </Button>
        </div>
        {c[field] && <img src={c[field]} alt="" className="mt-1 max-h-20 max-w-full rounded-md object-contain bg-muted ring-1 ring-inset ring-border" />}
      </div>
    );
    const opacityField = (field: string, label: string, fallback: number) => (
      <div className="grid gap-2">
        <Label className={fieldLabel}>{label}</Label>
        <div className="flex items-center gap-3">
          <Slider className="flex-1" min={0} max={1} step={0.05} value={[c[field] ?? fallback]} onValueChange={v => set(field, v[0])} aria-label={label} />
          <span className="w-9 text-end font-mono text-xs text-muted-foreground">
            {Math.round((c[field] ?? fallback) * 100)}%
          </span>
        </div>
      </div>
    );
    return (
      <div className="mt-4 flex flex-col gap-3 rounded-md bg-muted p-4">
        <p className="text-xs font-bold tracking-wide text-foreground uppercase">
          {l("Section Background", "خلفية القسم")}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {l(
            "Optional background image rendered behind this section's content. Upload separate images for dark and light theme, or a single fallback image used for both. Leave all empty for no background.",
            "صورة خلفية اختيارية تظهر خلف محتوى هذا القسم. ارفع صوراً منفصلة للوضع الداكن والفاتح، أو صورة واحدة احتياطية للوضعين. اتركها فارغة بدون خلفية.",
          )}
        </p>
        {bgField("backgroundImageDark", l("Background Image — Dark Mode", "صورة الخلفية — الوضع الداكن"))}
        {bgField("backgroundImageLight", l("Background Image — Light Mode", "صورة الخلفية — الوضع الفاتح"))}
        {bgField("backgroundImage", l("Background Image — Fallback (both themes)", "صورة الخلفية — احتياطية (للوضعين)"))}
        <div className="grid grid-cols-2 gap-3">
          {opacityField("backgroundOpacityDark", l("Overlay Opacity — Dark Mode", "شفافية الخلفية — الوضع الداكن"), 0.35)}
          {opacityField("backgroundOpacityLight", l("Overlay Opacity — Light Mode", "شفافية الخلفية — الوضع الفاتح"), 0.6)}
        </div>
      </div>
    );
  };

  // ── Content field editors by section type ────────────────────────────────────
  const renderContentEditor = (type: string) => {
    const c = editContent;
    const set = (field: string, value: any) => setEditContent((prev: any) => ({ ...prev, [field]: value }));

    const bilingualInput = (field: string, label: string, enPlaceholder = "", arPlaceholder = "") => (
      <div className="grid grid-cols-2 gap-2.5">
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{label} (EN)</Label>
          <Input value={c[field] || ""} onChange={e => set(field, e.target.value)} placeholder={enPlaceholder} />
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{label} (AR)</Label>
          <Input value={c[`${field}_ar`] || ""} onChange={e => set(`${field}_ar`, e.target.value)} placeholder={arPlaceholder} dir="rtl" />
        </div>
      </div>
    );

    const bilingualTextarea = (field: string, label: string, enPlaceholder = "", arPlaceholder = "") => (
      <div className="grid grid-cols-2 gap-2.5">
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{label} (EN)</Label>
          <Textarea className="resize-y" value={c[field] || ""} onChange={e => set(field, e.target.value)} placeholder={enPlaceholder} />
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{label} (AR)</Label>
          <Textarea className="resize-y" value={c[`${field}_ar`] || ""} onChange={e => set(`${field}_ar`, e.target.value)} placeholder={arPlaceholder} dir="rtl" />
        </div>
      </div>
    );

    const imageField = (field: string, label: string) => (
      <div className="grid gap-1.5">
        <Label className={fieldLabel}>{label}</Label>
        <div className="flex gap-2">
          <Input className="flex-1" value={c[field] || ""} onChange={e => set(field, e.target.value)} placeholder={t("cms_paste_image_url") + "..."} />
          <Button type="button" variant="outline" size="icon" aria-label={`${t("upload")} — ${label}`} onClick={() => { setUploadingFor(field); fileInputRef.current?.click(); }}>
            <Upload size={16} strokeWidth={2} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">JPG, PNG, or WebP — recommended 1200×630px, max 2 MB</p>
        {c[field] && <img src={c[field]} alt={t("preview")} className="mt-1 max-h-24 max-w-full rounded-md object-contain bg-muted ring-1 ring-inset ring-border" />}
      </div>
    );

    if (type === "hero") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("topMetaLeft", "Top Meta — Left (e.g. \"ELITE FITNESS PLATFORM · V.2026\")")}
        {bilingualInput("topMetaRight", "Top Meta — Right (e.g. date, leave blank for auto-date)")}
        {bilingualInput("badge", "Badge Text", "e.g. #1 FITNESS APP", "مثال: #١ تطبيق لياقة")}
        {bilingualInput("heading", "Heading")}
        {bilingualInput("headingAccent", "Heading Accent (colored)")}
        {bilingualTextarea("subheading", "Subheading")}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Primary Button Link", "رابط الزر الأساسي")}</Label><Input value={c.primaryBtnLink || ""} onChange={e => set("primaryBtnLink", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Secondary Button Link", "رابط الزر الثانوي")}</Label><Input value={c.secondaryBtnLink || ""} onChange={e => set("secondaryBtnLink", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Primary Button Text (EN)", "نص الزر الأساسي (EN)")}</Label><Input value={c.primaryBtnText || ""} onChange={e => set("primaryBtnText", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Primary Button Text (AR)", "نص الزر الأساسي (AR)")}</Label><Input value={c.primaryBtnText_ar || ""} onChange={e => set("primaryBtnText_ar", e.target.value)} dir="rtl" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Secondary Button Text (EN)", "نص الزر الثانوي (EN)")}</Label><Input value={c.secondaryBtnText || ""} onChange={e => set("secondaryBtnText", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Secondary Button Text (AR)", "نص الزر الثانوي (AR)")}</Label><Input value={c.secondaryBtnText_ar || ""} onChange={e => set("secondaryBtnText_ar", e.target.value)} dir="rtl" /></div>
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{l("Banner Width", "عرض البانر")}</Label>
          <Select value={c.widthMode || "boxed"} onValueChange={v => set("widthMode", v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="boxed">{l("Shrinked / Boxed", "مصغّر / داخل إطار")}</SelectItem>
              <SelectItem value="full">{l("Full Width", "عرض كامل")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Background images (dark/light/fallback) and overlay opacity are
            now rendered globally for every section by the shared
            `renderSectionBackgroundFields()` editor below. */}
      </div>
    );

    if (type === "stats") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Eyebrow (small text above heading)")}
        {bilingualInput("sectionMeta", "Right-Side Meta (small text on the right)")}
        {bilingualInput("heading", "Section Heading")}
        {bilingualInput("headingAccent", "Heading Accent (italic word)")}
        <div className="flex items-center justify-between gap-3">
          <Label className={fieldLabel}>{t("cms_stats_items")}</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => set("items", [...(c.items || []), { value: "0", label: "New Stat" }])}>
            <Plus size={14} strokeWidth={2} /> {t("add")}
          </Button>
        </div>
        {(c.items || []).map((item: any, i: number) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
            <Input value={item.value} onChange={e => { const items = [...c.items]; items[i] = { ...item, value: e.target.value }; set("items", items); }} placeholder="e.g. 1K+" />
            <div className="flex flex-col gap-1.5">
              <Input value={item.label} onChange={e => { const items = [...c.items]; items[i] = { ...item, label: e.target.value }; set("items", items); }} placeholder="Active Members (EN)" />
              <Input value={item.label_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, label_ar: e.target.value }; set("items", items); }} placeholder="الأعضاء النشطون (AR)" dir="rtl" />
            </div>
            <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("items", c.items.filter((_: any, j: number) => j !== i))}>
              <Trash2 size={16} strokeWidth={2} />
            </Button>
          </div>
        ))}
      </div>
    );

    if (type === "features" || type === "cards" || type === "values") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Eyebrow / Tag (small text above heading)")}
        {bilingualInput("sectionMeta", "Right-Side Meta (small text on the right)")}
        {bilingualInput("eyebrow", "Inline Kicker (e.g. \"— Our Values\")")}
        {bilingualInput("heading", "Section Heading")}
        {bilingualInput("headingAccent", "Heading Accent (italic word)")}
        {type === "features" && bilingualTextarea("intro", "Intro Paragraph")}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{type === "features" ? t("cms_feature_items") : t("cms_card_items")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("items", [...(c.items || []), { icon: "Dumbbell", title: "New Item", desc: "Description", color: "accent" }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_item")}
            </Button>
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="mb-2.5 rounded-md bg-muted p-3">
              <div className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <div className="grid gap-1">
                  <Label className={fieldLabel}>{t("icon")}</Label>
                  <Select value={item.icon || "__none"} onValueChange={v => { const items = [...c.items]; items[i] = { ...item, icon: v === "__none" ? "" : v }; set("items", items); }}>
                    <SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("none")}</SelectItem>
                      {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabel}>Title (EN)</Label>
                  <Input className="bg-card" value={item.title} onChange={e => { const items = [...c.items]; items[i] = { ...item, title: e.target.value }; set("items", items); }} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabel}>Title (AR)</Label>
                  <Input className="bg-card" value={item.title_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, title_ar: e.target.value }; set("items", items); }} dir="rtl" />
                </div>
                {type === "cards" && (
                  <div className="grid gap-1">
                    <Label className={fieldLabel}>{t("color")}</Label>
                    <Select value={item.color || "accent"} onValueChange={v => { const items = [...c.items]; items[i] = { ...item, color: v }; set("items", items); }}>
                      <SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map(co => <SelectItem key={co} value={co}>{co}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-end">
                  <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("items", c.items.filter((_: any, j: number) => j !== i))}>
                    <Trash2 size={16} strokeWidth={2} />
                  </Button>
                </div>
              </div>
              <div className="grid gap-1">
                <Label className={fieldLabel}>Description (EN)</Label>
                <Textarea className="min-h-[60px] resize-y bg-card" value={item.desc} onChange={e => { const items = [...c.items]; items[i] = { ...item, desc: e.target.value }; set("items", items); }} />
              </div>
              <div className="mt-2 grid gap-1">
                <Label className={fieldLabel}>Description (AR)</Label>
                <Textarea className="min-h-[60px] resize-y bg-card" value={item.desc_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, desc_ar: e.target.value }; set("items", items); }} dir="rtl" />
              </div>
              {type === "cards" && (
                <div className="mt-2 grid gap-1">
                  <Label className={fieldLabel}>{t("cms_card_image_url")} ({t("optional")})</Label>
                  <div className="flex gap-2">
                    <Input className="flex-1 bg-card" value={item.imageUrl || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, imageUrl: e.target.value }; set("items", items); }} placeholder="https://..." />
                    <Button type="button" variant="outline" size="icon" aria-label={t("upload")} onClick={() => { setUploadingFor(`items.${i}.imageUrl`); fileInputRef.current?.click(); }} className="bg-card">
                      <Upload size={16} strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              )}
              {type === "features" && (
                <div className="mt-2 grid gap-1">
                  <Label className={fieldLabel}>{l("Feature Screenshot", "صورة الميزة")} ({t("optional")})</Label>
                  <div className="flex gap-2">
                    <Input className="flex-1 bg-card" value={item.imageUrl || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, imageUrl: e.target.value }; set("items", items); }} placeholder="https://..." />
                    <Button type="button" variant="outline" size="icon" aria-label={t("upload")} onClick={() => { setUploadingFor(`items.${i}.imageUrl`); fileInputRef.current?.click(); }} className="bg-card">
                      <Upload size={16} strokeWidth={2} />
                    </Button>
                  </div>
                  {item.imageUrl && <img src={item.imageUrl} alt="Preview" className="mt-2 max-h-20 max-w-full rounded-md object-contain bg-card ring-1 ring-inset ring-border" />}
                  <p className="text-[10px] text-muted-foreground">Upload a screenshot from the app — shown on the homepage</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );

    if (type === "text_image") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Label")}
        {bilingualInput("heading", "Heading")}
        {bilingualTextarea("text", "Text Content")}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{t("cms_bullet_points")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("bullets", [...(c.bullets || []), "New bullet point"])}>
              <Plus size={14} strokeWidth={2} /> {t("add")}
            </Button>
          </div>
          {(c.bullets || []).map((b: string, i: number) => (
            <div key={i} className="mb-1.5 grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input value={b} onChange={e => { const bullets = [...(c.bullets || [])]; bullets[i] = e.target.value; set("bullets", bullets); }} placeholder="Bullet (EN)" />
              <Input value={(c.bullets_ar || [])[i] || ""} onChange={e => { const bulletsAr = [...(c.bullets_ar || [])]; bulletsAr[i] = e.target.value; set("bullets_ar", bulletsAr); }} placeholder="نقطة (AR)" dir="rtl" />
              <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("bullets", c.bullets.filter((_: any, j: number) => j !== i))}>
                <Trash2 size={16} strokeWidth={2} />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Image Side", "موضع الصورة")}</Label>
            <Select value={c.imageSide || "right"} onValueChange={v => set("imageSide", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">{t("right")}</SelectItem>
                <SelectItem value="left">{t("left")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Link Text (EN)", "نص الرابط (EN)")}</Label><Input value={c.linkText || ""} onChange={e => set("linkText", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Link Text (AR)", "نص الرابط (AR)")}</Label><Input value={c.linkText_ar || ""} onChange={e => set("linkText_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Link URL", "رابط URL")}</Label><Input value={c.linkUrl || ""} onChange={e => set("linkUrl", e.target.value)} /></div>
        </div>
        {imageField("imageUrl", "Section Image")}
      </div>
    );

    if (type === "portal_select") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("eyebrow", "Eyebrow / Tag", "— Choose Your Path", "— اختر مسارك")}
        {bilingualInput("heading", "Heading", "Athlete or Coach.", "رياضي أم مدرب.")}
        {bilingualInput("headingAccent", "Italic Accent Word", "or", "أم")}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Athlete Button Label (EN)", "زر الرياضي (EN)")}</Label><Input value={c.athleteLabel || ""} onChange={e => set("athleteLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Athlete Button Label (AR)", "زر الرياضي (AR)")}</Label><Input value={c.athleteLabel_ar || ""} onChange={e => set("athleteLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Athlete Link", "رابط الرياضي")}</Label><Input value={c.athleteLink || ""} onChange={e => set("athleteLink", e.target.value)} /></div>
          <div></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Coach Button Label (EN)", "زر المدرب (EN)")}</Label><Input value={c.coachLabel || ""} onChange={e => set("coachLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Coach Button Label (AR)", "زر المدرب (AR)")}</Label><Input value={c.coachLabel_ar || ""} onChange={e => set("coachLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Coach Link", "رابط المدرب")}</Label><Input value={c.coachLink || ""} onChange={e => set("coachLink", e.target.value)} /></div>
        </div>
      </div>
    );

    if (type === "cta") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Eyebrow (small text above heading)")}
        {bilingualInput("badge", "Badge Text", "e.g. JOIN OUR MEMBERS", "مثال: انضم الآن")}
        {bilingualInput("heading", "Heading")}
        {bilingualInput("headingAccent", "Heading Accent (italic word)")}
        {bilingualTextarea("subheading", "Subheading")}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Primary Button Text (EN)", "نص الزر الأساسي (EN)")}</Label><Input value={c.btnText || ""} onChange={e => set("btnText", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Primary Button Text (AR)", "نص الزر الأساسي (AR)")}</Label><Input value={c.btnText_ar || ""} onChange={e => set("btnText_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Primary Button Link", "رابط الزر الأساسي")}</Label><Input value={c.btnLink || ""} onChange={e => set("btnLink", e.target.value)} /></div>
          <div></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Secondary Button Text (EN)", "نص الزر الثانوي (EN)")}</Label><Input value={c.secondaryBtnText || ""} onChange={e => set("secondaryBtnText", e.target.value)} placeholder="e.g. Contact Us" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Secondary Button Text (AR)", "نص الزر الثانوي (AR)")}</Label><Input value={c.secondaryBtnText_ar || ""} onChange={e => set("secondaryBtnText_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Secondary Button Link", "رابط الزر الثانوي")}</Label><Input value={c.secondaryBtnLink || ""} onChange={e => set("secondaryBtnLink", e.target.value)} placeholder="/contact" /></div>
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{l("Banner Width", "عرض البانر")}</Label>
          <Select value={c.widthMode || "boxed"} onValueChange={v => set("widthMode", v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="boxed">{l("Shrinked / Boxed", "مصغّر / داخل إطار")}</SelectItem>
              <SelectItem value="full">{l("Full Width", "عرض كامل")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );

    if (type === "contact_info") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("formTitle", "Form Title", "Send us a message", "راسلنا")}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="grid gap-1.5"><Label className={fieldLabel}>Name Label (EN)</Label><Input value={c.nameLabel || ""} onChange={e => set("nameLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Name Label (AR)</Label><Input value={c.nameLabel_ar || ""} onChange={e => set("nameLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Email Label (EN)</Label><Input value={c.emailLabel || ""} onChange={e => set("emailLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Email Label (AR)</Label><Input value={c.emailLabel_ar || ""} onChange={e => set("emailLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Name Placeholder (EN)</Label><Input value={c.namePlaceholder || ""} onChange={e => set("namePlaceholder", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Name Placeholder (AR)</Label><Input value={c.namePlaceholder_ar || ""} onChange={e => set("namePlaceholder_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Email Placeholder (EN)</Label><Input value={c.emailPlaceholder || ""} onChange={e => set("emailPlaceholder", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Email Placeholder (AR)</Label><Input value={c.emailPlaceholder_ar || ""} onChange={e => set("emailPlaceholder_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Subject Label (EN)</Label><Input value={c.subjectLabel || ""} onChange={e => set("subjectLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Subject Label (AR)</Label><Input value={c.subjectLabel_ar || ""} onChange={e => set("subjectLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Message Label (EN)</Label><Input value={c.messageLabel || ""} onChange={e => set("messageLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Message Label (AR)</Label><Input value={c.messageLabel_ar || ""} onChange={e => set("messageLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Message Placeholder (EN)</Label><Input value={c.messagePlaceholder || ""} onChange={e => set("messagePlaceholder", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Message Placeholder (AR)</Label><Input value={c.messagePlaceholder_ar || ""} onChange={e => set("messagePlaceholder_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Send Button Text (EN)</Label><Input value={c.sendBtnText || ""} onChange={e => set("sendBtnText", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Send Button Text (AR)</Label><Input value={c.sendBtnText_ar || ""} onChange={e => set("sendBtnText_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Quick Contact Title (EN)</Label><Input value={c.quickContactTitle || ""} onChange={e => set("quickContactTitle", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Quick Contact Title (AR)</Label><Input value={c.quickContactTitle_ar || ""} onChange={e => set("quickContactTitle_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Live Chat Label (EN)</Label><Input value={c.liveChatLabel || ""} onChange={e => set("liveChatLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Live Chat Label (AR)</Label><Input value={c.liveChatLabel_ar || ""} onChange={e => set("liveChatLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>WhatsApp Label (EN)</Label><Input value={c.whatsappLabel || ""} onChange={e => set("whatsappLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>WhatsApp Label (AR)</Label><Input value={c.whatsappLabel_ar || ""} onChange={e => set("whatsappLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Email Row Label (EN)</Label><Input value={c.emailContactLabel || ""} onChange={e => set("emailContactLabel", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Email Row Label (AR)</Label><Input value={c.emailContactLabel_ar || ""} onChange={e => set("emailContactLabel_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>FAQ Title (EN)</Label><Input value={c.faqTitle || ""} onChange={e => set("faqTitle", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>FAQ Title (AR)</Label><Input value={c.faqTitle_ar || ""} onChange={e => set("faqTitle_ar", e.target.value)} dir="rtl" /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Subject Options (EN, comma-separated)</Label><Input value={(c.subjectOptions || []).join(", ")} onChange={e => set("subjectOptions", e.target.value.split(",").map((v: string) => v.trim()).filter(Boolean))} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>Subject Options (AR, comma-separated)</Label><Input value={(c.subjectOptions_ar || []).join(", ")} onChange={e => set("subjectOptions_ar", e.target.value.split(",").map((v: string) => v.trim()).filter(Boolean))} dir="rtl" /></div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Phone / WhatsApp", "الهاتف / واتساب")}</Label><Input value={c.phone || ""} onChange={e => set("phone", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Email", "البريد الإلكتروني")}</Label><Input value={c.email || ""} onChange={e => set("email", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Chat Hours", "ساعات الدردشة")}</Label><Input value={c.chatHours || ""} onChange={e => set("chatHours", e.target.value)} /></div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{t("cms_faq_items")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("faqs", [...(c.faqs || []), { q: "New question?", a: "Answer here." }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_faq")}
            </Button>
          </div>
          {(c.faqs || []).map((faq: any, i: number) => (
            <div key={i} className="mb-2 rounded-md bg-muted p-3">
              <div className="mb-2 flex items-start gap-2">
                <div className="flex-1">
                  <Label className={fieldLabel}>Question (EN)</Label>
                  <Input className="mt-1 bg-card" value={faq.q} onChange={e => { const faqs = [...c.faqs]; faqs[i] = { ...faq, q: e.target.value }; set("faqs", faqs); }} />
                  <Label className={`${fieldLabel} mt-1.5 block`}>Question (AR)</Label>
                  <Input className="mt-1 bg-card" value={faq.q_ar || ""} onChange={e => { const faqs = [...c.faqs]; faqs[i] = { ...faq, q_ar: e.target.value }; set("faqs", faqs); }} dir="rtl" />
                </div>
                <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} className="mt-5" onClick={() => set("faqs", c.faqs.filter((_: any, j: number) => j !== i))}>
                  <Trash2 size={16} strokeWidth={2} />
                </Button>
              </div>
              <Label className={fieldLabel}>Answer (EN)</Label>
              <Textarea className="mt-1 min-h-[60px] resize-y bg-card" value={faq.a} onChange={e => { const faqs = [...c.faqs]; faqs[i] = { ...faq, a: e.target.value }; set("faqs", faqs); }} />
              <Label className={`${fieldLabel} mt-1.5 block`}>Answer (AR)</Label>
              <Textarea className="mt-1 min-h-[60px] resize-y bg-card" value={faq.a_ar || ""} onChange={e => { const faqs = [...c.faqs]; faqs[i] = { ...faq, a_ar: e.target.value }; set("faqs", faqs); }} dir="rtl" />
            </div>
          ))}
        </div>
      </div>
    );

    if (type === "calculator") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Label")}
        {bilingualInput("heading", "Heading")}
        <p className="text-xs text-muted-foreground">{t("cms_calculator_embed_note")}</p>
      </div>
    );

    if (type === "mission") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Eyebrow / Tag (e.g. \"Mission — 03\")")}
        {bilingualInput("sectionMeta", "Right-Side Meta (e.g. \"What we believe\")")}
        {bilingualInput("eyebrow", "Inline Kicker (e.g. \"— Our Mission\")")}
        {bilingualInput("heading", "Section Heading")}
        {bilingualInput("headingAccent", "Heading Accent (italic word)")}
        {bilingualTextarea("body1", "First Paragraph")}
        {bilingualTextarea("body2", "Second Paragraph")}
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{l("Bullet Points (EN — one per line)", "النقاط (EN — كل نقطة في سطر)")}</Label>
          <Textarea className="resize-y" value={(c.bullets || []).join("\n")} onChange={e => set("bullets", e.target.value.split("\n").map((v: string) => v.trim()).filter(Boolean))} />
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{l("Bullet Points (AR — one per line)", "النقاط (AR — كل نقطة في سطر)")}</Label>
          <Textarea className="resize-y" dir="rtl" value={(c.bullets_ar || []).join("\n")} onChange={e => set("bullets_ar", e.target.value.split("\n").map((v: string) => v.trim()).filter(Boolean))} />
        </div>
        <div className="mt-2 rounded-md bg-muted p-3">
          <p className="mb-3 text-xs text-muted-foreground">{l("Sidebar snapshot card — title + small rows.", "بطاقة الملخص الجانبية — العنوان + الصفوف الصغيرة.")}</p>
          {bilingualInput("snapshotEyebrow", "Snapshot Eyebrow")}
          <div className="mt-2.5">{bilingualInput("snapshotTitle", "Snapshot Title")}</div>
          <div className="mt-2.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label className={fieldLabel}>{l("Snapshot Rows", "صفوف الملخص")}</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => set("snapshotRows", [...(c.snapshotRows || []), { emoji: "✨", title: "Item", title_ar: "", value: "—", value_ar: "—" }])}>
                <Plus size={14} strokeWidth={2} /> {t("add")}
              </Button>
            </div>
            {(c.snapshotRows || []).map((row: any, i: number) => (
              <div key={i} className="mb-1.5 grid grid-cols-[60px_1fr_1fr_1fr_1fr_auto] gap-1.5">
                <Input className="bg-card" value={row.emoji || ""} onChange={e => { const rows = [...c.snapshotRows]; rows[i] = { ...row, emoji: e.target.value }; set("snapshotRows", rows); }} placeholder="🏋️" />
                <Input className="bg-card" value={row.title || ""} onChange={e => { const rows = [...c.snapshotRows]; rows[i] = { ...row, title: e.target.value }; set("snapshotRows", rows); }} placeholder="Title (EN)" />
                <Input className="bg-card" dir="rtl" value={row.title_ar || ""} onChange={e => { const rows = [...c.snapshotRows]; rows[i] = { ...row, title_ar: e.target.value }; set("snapshotRows", rows); }} placeholder="العنوان (AR)" />
                <Input className="bg-card" value={row.value || ""} onChange={e => { const rows = [...c.snapshotRows]; rows[i] = { ...row, value: e.target.value }; set("snapshotRows", rows); }} placeholder="Value (EN)" />
                <Input className="bg-card" dir="rtl" value={row.value_ar || ""} onChange={e => { const rows = [...c.snapshotRows]; rows[i] = { ...row, value_ar: e.target.value }; set("snapshotRows", rows); }} placeholder="القيمة (AR)" />
                <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("snapshotRows", c.snapshotRows.filter((_: any, j: number) => j !== i))}>
                  <Trash2 size={16} strokeWidth={2} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    if (type === "latest_blogs") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Label")}
        {bilingualInput("heading", "Heading")}
        <p className="text-xs text-muted-foreground">{l("This section auto-loads the latest blog posts from the public API.", "يحمّل هذا القسم أحدث مقالات المدونة تلقائيًا من الواجهة العامة.")}</p>
      </div>
    );

    // ── Timeline editor (year + bilingual title/desc) ─────────────────────
    if (type === "timeline") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Eyebrow / Tag (small text above heading)")}
        {bilingualInput("sectionMeta", "Right-Side Meta (small text on the right)")}
        {bilingualInput("eyebrow", "Inline Kicker (e.g. \"— Our Journey\")")}
        {bilingualInput("heading", "Section Heading")}
        {bilingualInput("headingAccent", "Heading Accent (italic word)")}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{l("Timeline Items", "عناصر الجدول الزمني")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("items", [...(c.items || []), { year: "2026", title: "New chapter", title_ar: "", desc: "", desc_ar: "" }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_item")}
            </Button>
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="mb-2.5 rounded-md bg-muted p-3">
              <div className="mb-2 grid grid-cols-[120px_1fr_1fr_auto] gap-2">
                <div className="grid gap-1"><Label className={fieldLabel}>{l("Year", "السنة")}</Label>
                  <Input className="bg-card" value={item.year || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, year: e.target.value }; set("items", items); }} placeholder="2024" /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Title (EN)</Label>
                  <Input className="bg-card" value={item.title || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, title: e.target.value }; set("items", items); }} /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Title (AR)</Label>
                  <Input className="bg-card" dir="rtl" value={item.title_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, title_ar: e.target.value }; set("items", items); }} /></div>
                <div className="flex items-end">
                  <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("items", c.items.filter((_: any, j: number) => j !== i))}>
                    <Trash2 size={16} strokeWidth={2} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1"><Label className={fieldLabel}>Description (EN)</Label>
                  <Textarea className="min-h-[60px] resize-y bg-card" value={item.desc || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, desc: e.target.value }; set("items", items); }} /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Description (AR)</Label>
                  <Textarea className="min-h-[60px] resize-y bg-card" dir="rtl" value={item.desc_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, desc_ar: e.target.value }; set("items", items); }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    // ── Trust indicators editor (icon + bilingual label) ──────────────────
    if (type === "trust") return (
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{l("Trust Indicators", "مؤشرات الثقة")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("items", [...(c.items || []), { icon: "Award", label: "New Badge", label_ar: "" }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_item")}
            </Button>
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <Select value={item.icon || "__none"} onValueChange={v => { const items = [...c.items]; items[i] = { ...item, icon: v === "__none" ? "" : v }; set("items", items); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("none")}</SelectItem>
                  {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={item.label || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, label: e.target.value }; set("items", items); }} placeholder="Label (EN)" />
              <Input dir="rtl" value={item.label_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, label_ar: e.target.value }; set("items", items); }} placeholder="التسمية (AR)" />
              <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("items", c.items.filter((_: any, j: number) => j !== i))}>
                <Trash2 size={16} strokeWidth={2} />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );

    // ── Steps editor (step + icon + bilingual title/desc) ─────────────────
    if (type === "steps") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Eyebrow (small text above heading)")}
        {bilingualInput("sectionMeta", "Right-Side Meta (small text on the right)")}
        {bilingualInput("heading", "Section Heading")}
        {bilingualInput("headingAccent", "Heading Accent (italic word)")}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{l("Steps", "الخطوات")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("items", [...(c.items || []), { step: String((c.items?.length || 0) + 1).padStart(2, "0"), icon: "Smartphone", title: "Step", title_ar: "", desc: "", desc_ar: "" }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_item")}
            </Button>
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="mb-2.5 rounded-md bg-muted p-3">
              <div className="mb-2 grid grid-cols-[100px_140px_1fr_1fr_auto] gap-2">
                <div className="grid gap-1"><Label className={fieldLabel}>Step #</Label>
                  <Input className="bg-card" value={item.step || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, step: e.target.value }; set("items", items); }} placeholder="01" /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>{t("icon")}</Label>
                  <Select value={item.icon || "__none"} onValueChange={v => { const items = [...c.items]; items[i] = { ...item, icon: v === "__none" ? "" : v }; set("items", items); }}>
                    <SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("none")}</SelectItem>
                      {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Title (EN)</Label>
                  <Input className="bg-card" value={item.title || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, title: e.target.value }; set("items", items); }} /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Title (AR)</Label>
                  <Input className="bg-card" dir="rtl" value={item.title_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, title_ar: e.target.value }; set("items", items); }} /></div>
                <div className="flex items-end">
                  <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("items", c.items.filter((_: any, j: number) => j !== i))}>
                    <Trash2 size={16} strokeWidth={2} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1"><Label className={fieldLabel}>Description (EN)</Label>
                  <Textarea className="min-h-[60px] resize-y bg-card" value={item.desc || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, desc: e.target.value }; set("items", items); }} /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Description (AR)</Label>
                  <Textarea className="min-h-[60px] resize-y bg-card" dir="rtl" value={item.desc_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, desc_ar: e.target.value }; set("items", items); }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    // ── Marquee words (comma-separated, bilingual) ────────────────────────
    if (type === "marquee") return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{l("Comma-separated list of words for the scrolling banner.", "قائمة كلمات مفصولة بفواصل للشريط المتحرك.")}</p>
        <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Words (EN)", "الكلمات (EN)")}</Label>
          <Input value={c.words || ""} onChange={e => set("words", e.target.value)} placeholder="WORD ONE, WORD TWO" /></div>
        <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Words (AR)", "الكلمات (AR)")}</Label>
          <Input dir="rtl" value={c.words_ar || ""} onChange={e => set("words_ar", e.target.value)} placeholder="كلمة, كلمة" /></div>
      </div>
    );

    // ── Rich text block (bilingual) ───────────────────────────────────────
    if (type === "rich_text") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Label")}
        {bilingualInput("heading", "Heading")}
        <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Body (EN)", "النص (EN)")}</Label>
          <Textarea className="min-h-[140px] resize-y" value={c.body || ""} onChange={e => set("body", e.target.value)} /></div>
        <div className="grid gap-1.5"><Label className={fieldLabel}>{l("Body (AR)", "النص (AR)")}</Label>
          <Textarea className="min-h-[140px] resize-y" dir="rtl" value={c.body_ar || ""} onChange={e => set("body_ar", e.target.value)} /></div>
      </div>
    );

    // ── Testimonials editor ───────────────────────────────────────────────
    // Mirrors the `team` template (per-item image + bilingual fields), but
    // the items represent customer reviews rather than staff. Used by the
    // Home page "Real Results" section.
    if (type === "testimonials") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Eyebrow (small text above heading)")}
        {bilingualInput("sectionMeta", "Right-Side Meta (small text on the right)")}
        {bilingualInput("heading", "Section Heading")}
        {bilingualInput("headingAccent", "Heading Accent (italic word)")}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{l("Testimonials", "آراء العملاء")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("items", [...(c.items || []), { name: "Member Name", name_ar: "", meta: "", meta_ar: "", quote: "", quote_ar: "", imageUrl: "" }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_item")}
            </Button>
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="mb-2.5 rounded-md bg-muted p-3">
              <div className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                <div className="grid gap-1">
                  <Label className={fieldLabel}>{l("Name (EN)", "الاسم (EN)")}</Label>
                  <Input className="bg-card" value={item.name || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, name: e.target.value }; set("items", items); }} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabel}>{l("Name (AR)", "الاسم (AR)")}</Label>
                  <Input className="bg-card" dir="rtl" value={item.name_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, name_ar: e.target.value }; set("items", items); }} />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("items", c.items.filter((_: any, j: number) => j !== i))}>
                    <Trash2 size={16} strokeWidth={2} />
                  </Button>
                </div>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className={fieldLabel}>{l("Meta (EN) — e.g. '−15kg · 3 months'", "الوصف (EN)")}</Label>
                  <Input className="bg-card" value={item.meta || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, meta: e.target.value }; set("items", items); }} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabel}>{l("Meta (AR)", "الوصف (AR)")}</Label>
                  <Input className="bg-card" dir="rtl" value={item.meta_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, meta_ar: e.target.value }; set("items", items); }} />
                </div>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className={fieldLabel}>{l("Quote (EN)", "الاقتباس (EN)")}</Label>
                  <Textarea className="min-h-[70px] resize-y bg-card" value={item.quote || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, quote: e.target.value }; set("items", items); }} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabel}>{l("Quote (AR)", "الاقتباس (AR)")}</Label>
                  <Textarea className="min-h-[70px] resize-y bg-card" dir="rtl" value={item.quote_ar || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, quote_ar: e.target.value }; set("items", items); }} />
                </div>
              </div>
              <div className="grid gap-1">
                <Label className={fieldLabel}>{l("Profile Photo", "الصورة الشخصية")} ({t("optional")})</Label>
                <div className="flex gap-2">
                  <Input className="flex-1 bg-card" value={item.imageUrl || ""} onChange={e => { const items = [...c.items]; items[i] = { ...item, imageUrl: e.target.value }; set("items", items); }} placeholder="https://..." />
                  <Button type="button" variant="outline" size="icon" aria-label={t("upload")} onClick={() => { setUploadingFor(`items.${i}.imageUrl`); fileInputRef.current?.click(); }} className="bg-card">
                    <Upload size={16} strokeWidth={2} />
                  </Button>
                </div>
                {item.imageUrl && <img src={item.imageUrl} alt="Preview" className="mt-2 size-14 rounded-full object-cover bg-card ring-1 ring-inset ring-border" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    if (type === "team") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Eyebrow / Tag (small text above heading)")}
        {bilingualInput("sectionMeta", "Right-Side Meta (small text on the right)")}
        {bilingualInput("eyebrow", "Inline Kicker (e.g. \"— Our Team\")")}
        {bilingualInput("heading", "Section Heading")}
        {bilingualInput("headingAccent", "Heading Accent (italic word)")}
        {bilingualTextarea("subheading", "Subheading")}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{t("cms_team_members")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("members", [...(c.members || []), { name: "New Member", role: "Role", bio: "Bio", imageUrl: "", linkedin: "", twitter: "", instagram: "" }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_member")}
            </Button>
          </div>
          {(c.members || []).map((member: any, i: number) => (
            <div key={i} className="mb-2.5 rounded-md bg-muted p-3">
              <div className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                <div className="grid gap-1">
                  <Label className={fieldLabel}>Name (EN)</Label>
                  <Input className="bg-card" value={member.name || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, name: e.target.value }; set("members", members); }} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabel}>Name (AR)</Label>
                  <Input className="bg-card" dir="rtl" value={member.name_ar || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, name_ar: e.target.value }; set("members", members); }} />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("members", (c.members || []).filter((_: any, j: number) => j !== i))}>
                    <Trash2 size={16} strokeWidth={2} />
                  </Button>
                </div>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className={fieldLabel}>Role (EN)</Label>
                  <Input className="bg-card" value={member.role || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, role: e.target.value }; set("members", members); }} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabel}>Role (AR)</Label>
                  <Input className="bg-card" dir="rtl" value={member.role_ar || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, role_ar: e.target.value }; set("members", members); }} />
                </div>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className={fieldLabel}>Bio (EN)</Label>
                  <Textarea className="min-h-[60px] resize-y bg-card" value={member.bio || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, bio: e.target.value }; set("members", members); }} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabel}>Bio (AR)</Label>
                  <Textarea className="min-h-[60px] resize-y bg-card" dir="rtl" value={member.bio_ar || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, bio_ar: e.target.value }; set("members", members); }} />
                </div>
              </div>
              <div className="mb-2 grid gap-1">
                <Label className={fieldLabel}>{t("cms_member_image_url")}</Label>
                <div className="flex gap-2">
                  <Input className="flex-1 bg-card" value={member.imageUrl || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, imageUrl: e.target.value }; set("members", members); }} placeholder="https://..." />
                  <Button type="button" variant="outline" size="icon" aria-label={t("upload")} onClick={() => { setUploadingFor(`members.${i}.imageUrl`); fileInputRef.current?.click(); }} className="bg-card">
                    <Upload size={16} strokeWidth={2} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1"><Label className={fieldLabel}>LinkedIn</Label><Input className="bg-card" value={member.linkedin || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, linkedin: e.target.value }; set("members", members); }} /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Twitter / X</Label><Input className="bg-card" value={member.twitter || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, twitter: e.target.value }; set("members", members); }} /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Instagram</Label><Input className="bg-card" value={member.instagram || ""} onChange={e => { const members = [...(c.members || [])]; members[i] = { ...member, instagram: e.target.value }; set("members", members); }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    if (type === "carousel") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Label")}
        {bilingualInput("heading", "Heading")}
        <div className="grid gap-1.5">
          <Label className={fieldLabel}>{l("Banner Width", "عرض البانر")}</Label>
          <Select value={c.widthMode || "boxed"} onValueChange={v => set("widthMode", v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="boxed">{l("Shrinked / Boxed", "مصغّر / داخل إطار")}</SelectItem>
              <SelectItem value="full">{l("Full Width", "عرض كامل")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{t("cms_carousel_items")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("items", [...(c.items || []), { title: "New Slide", desc: "Description", imageUrl: "" }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_slide")}
            </Button>
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="mb-2.5 rounded-md bg-muted p-3">
              <div className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                <div className="grid gap-1"><Label className={fieldLabel}>Title (EN)</Label><Input className="bg-card" value={item.title || ""} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...item, title: e.target.value }; set("items", items); }} /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Title (AR)</Label><Input className="bg-card" dir="rtl" value={item.title_ar || ""} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...item, title_ar: e.target.value }; set("items", items); }} /></div>
                <div className="flex items-end">
                  <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} onClick={() => set("items", (c.items || []).filter((_: any, j: number) => j !== i))}>
                    <Trash2 size={16} strokeWidth={2} />
                  </Button>
                </div>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div className="grid gap-1"><Label className={fieldLabel}>Description (EN)</Label><Textarea className="min-h-[60px] resize-y bg-card" value={item.desc || ""} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...item, desc: e.target.value }; set("items", items); }} /></div>
                <div className="grid gap-1"><Label className={fieldLabel}>Description (AR)</Label><Textarea className="min-h-[60px] resize-y bg-card" dir="rtl" value={item.desc_ar || ""} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...item, desc_ar: e.target.value }; set("items", items); }} /></div>
              </div>
              <div className="grid gap-1">
                <Label className={fieldLabel}>{t("cms_slide_image_url")}</Label>
                <div className="flex gap-2">
                  <Input className="flex-1 bg-card" value={item.imageUrl || ""} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...item, imageUrl: e.target.value }; set("items", items); }} placeholder="https://..." />
                  <Button type="button" variant="outline" size="icon" aria-label={t("upload")} onClick={() => { setUploadingFor(`items.${i}.imageUrl`); fileInputRef.current?.click(); }} className="bg-card">
                    <Upload size={16} strokeWidth={2} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    if (type === "faq") return (
      <div className="flex flex-col gap-3">
        {bilingualInput("sectionLabel", "Section Label")}
        {bilingualInput("heading", "Heading")}
        {bilingualTextarea("subheading", "Subheading")}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label className={fieldLabel}>{t("cms_faq_items")}</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => set("faqs", [...(c.faqs || []), { q: "New question?", a: "Answer here." }])}>
              <Plus size={14} strokeWidth={2} /> {t("cms_add_faq")}
            </Button>
          </div>
          {(c.faqs || []).map((faq: any, i: number) => (
            <div key={i} className="mb-2 rounded-md bg-muted p-3">
              <div className="mb-2 flex items-start gap-2">
                <div className="flex-1">
                  <Label className={fieldLabel}>Question (EN)</Label>
                  <Input className="mt-1 bg-card" value={faq.q || ""} onChange={e => { const faqs = [...(c.faqs || [])]; faqs[i] = { ...faq, q: e.target.value }; set("faqs", faqs); }} />
                  <Label className={`${fieldLabel} mt-1.5 block`}>Question (AR)</Label>
                  <Input className="mt-1 bg-card" dir="rtl" value={faq.q_ar || ""} onChange={e => { const faqs = [...(c.faqs || [])]; faqs[i] = { ...faq, q_ar: e.target.value }; set("faqs", faqs); }} />
                </div>
                <Button type="button" variant="destructive" size="icon" aria-label={t("delete")} className="mt-5" onClick={() => set("faqs", (c.faqs || []).filter((_: any, j: number) => j !== i))}>
                  <Trash2 size={16} strokeWidth={2} />
                </Button>
              </div>
              <Label className={fieldLabel}>Answer (EN)</Label>
              <Textarea className="mt-1 min-h-[60px] resize-y bg-card" value={faq.a || ""} onChange={e => { const faqs = [...(c.faqs || [])]; faqs[i] = { ...faq, a: e.target.value }; set("faqs", faqs); }} />
              <Label className={`${fieldLabel} mt-1.5 block`}>Answer (AR)</Label>
              <Textarea className="mt-1 min-h-[60px] resize-y bg-card" dir="rtl" value={faq.a_ar || ""} onChange={e => { const faqs = [...(c.faqs || [])]; faqs[i] = { ...faq, a_ar: e.target.value }; set("faqs", faqs); }} />
            </div>
          ))}
        </div>
      </div>
    );

    if (type === "html") return (
      <div className="grid gap-1.5">
        <Label className={fieldLabel}>Custom HTML (EN)</Label>
        <Textarea className="min-h-[160px] resize-y font-mono text-xs" value={c.html || ""} onChange={e => set("html", e.target.value)} />
        <Label className={`${fieldLabel} mt-2.5 block`}>Custom HTML (AR)</Label>
        <Textarea className="min-h-[160px] resize-y font-mono text-xs" value={c.html_ar || ""} onChange={e => set("html_ar", e.target.value)} dir="rtl" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">⚠️ {t("cms_html_warning")}</p>
      </div>
    );

    return <p className="text-[13px] text-muted-foreground">{t("cms_no_editor_for_type")} "{type}".</p>;
  };

  const typeInfo = (type: string) => SECTION_TYPES.find(t => t.type === type);
  const typeLabel = (type: string) => ({
    hero: t("cms_type_hero"),
    stats: t("cms_type_stats"),
    features: t("cms_type_features"),
    text_image: t("cms_type_text_image"),
    cards: t("cms_type_cards"),
    cta: t("cms_type_cta"),
    contact_info: t("cms_type_contact_info"),
    calculator: t("cms_type_calculator"),
    latest_blogs: t("cms_type_latest_blogs"),
    team: t("cms_type_team"),
    carousel: t("cms_type_carousel"),
    faq: t("cms_type_faq"),
    html: t("cms_type_html"),
  } as Record<string, string>)[type] || type;

  return (
    <div className="space-y-6">
      {/* Hidden file input for image uploads */}
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={e => {
        if (!uploadingFor) return;
        // Handle nested path like "items.0.imageUrl" or "members.0.imageUrl"
        if (uploadingFor.startsWith("items.") || uploadingFor.startsWith("members.")) {
          const parts = uploadingFor.split(".");
          const listName = parts[0];
          const idx = parseInt(parts[1]);
          const field = parts[2];
          const file = e.target.files?.[0];
          if (!file) return;
          const formData = new FormData();
          formData.append("image", file);
          apiFetch("/api/cms/admin/upload-image", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData })
            .then(r => r.json())
            .then(d => {
              if (d.url) {
                const list = [...(editContent[listName] || [])];
                list[idx] = { ...list[idx], [field]: d.url };
                setEditContent((prev: any) => ({ ...prev, [listName]: list }));
                showMsg(t("cms_image_uploaded"));
              }
            });
        } else {
          handleImageUpload(e, uploadingFor);
        }
        e.target.value = "";
      }} />

      {/* Page Selector */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Globe size={20} strokeWidth={2} className="text-primary" /> {t("website_cms")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {PAGES.map(p => (
            <Button key={p} variant={activePage === p ? "default" : "outline"} size="sm" onClick={() => setActivePage(p)} className="capitalize">
              {p === "home" ? "🏠" : p === "about" ? "📖" : "📞"} {p === "home" ? t("nav_home") : p === "about" ? t("about") : t("contact")}
            </Button>
          ))}
          <Button asChild variant="outline" size="sm" className="ms-auto">
            <a href={`/${activePage === "home" ? "" : activePage}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} strokeWidth={2} /> {t("preview")}
            </a>
          </Button>
        </div>
      </div>

      {/* Branding Editor */}
      <Card className="gap-0 p-5">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold"><Tag size={16} strokeWidth={2} className="text-muted-foreground" /> {t("cms_branding_editor")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("cms_branding_editor_desc")}</p>
          </div>
          <Button onClick={saveBranding} disabled={brandingSaving || brandingLoading}>
            <Save size={16} strokeWidth={2} /> {brandingSaving ? t("saving") : t("cms_save_branding")}
          </Button>
        </div>

        {brandingLoading ? (
          <p className="text-[13px] text-muted-foreground">{t("cms_loading_branding")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold tracking-wider text-primary uppercase">{t("cms_identity")}</p>
              <div className="grid gap-1.5"><Label className={fieldLabel}>{t("cms_app_name")}</Label><Input value={brandingForm.app_name || ""} onChange={e => setBrandingForm(v => ({ ...v, app_name: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label className={fieldLabel}>{t("cms_tagline")}</Label><Input value={brandingForm.app_tagline || ""} onChange={e => setBrandingForm(v => ({ ...v, app_tagline: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label className={fieldLabel}>{t("cms_footer_text")}</Label><Textarea className="resize-y" value={brandingForm.footer_text || ""} onChange={e => setBrandingForm(v => ({ ...v, footer_text: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label className={fieldLabel}>{t("cms_copyright_text")}</Label><Input value={brandingForm.copyright_text || ""} onChange={e => setBrandingForm(v => ({ ...v, copyright_text: e.target.value }))} /></div>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold tracking-wider text-primary uppercase">{t("cms_logo_favicon")}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "logo_url_en_light", label: "🇬🇧 English — Light Mode" },
                  { key: "logo_url_en_dark",  label: "🇬🇧 English — Dark Mode" },
                  { key: "logo_url_ar_light", label: "🇪🇬 Arabic — Light Mode" },
                  { key: "logo_url_ar_dark",  label: "🇪🇬 Arabic — Dark Mode" },
                ].map(({ key, label }) => (
                  <div key={key} className="rounded-md bg-muted p-3">
                    <Label className={`${fieldLabel} block`}>{label}</Label>
                    <div className="mt-1.5 flex gap-1.5">
                      <Button asChild variant="outline" size="sm" className="bg-card">
                        <label className="cursor-pointer whitespace-nowrap">
                          <Upload size={14} strokeWidth={2} /> {t("upload")}
                          <input type="file" hidden accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadBrandingImage(key, f); }} />
                        </label>
                      </Button>
                      <Input className="flex-1 bg-card text-[11px]" value={brandingForm[key] || ""} onChange={e => setBrandingForm(v => ({ ...v, [key]: e.target.value }))} placeholder="URL or upload" />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">PNG or SVG — recommended 200×60px, transparent background</p>
                    <div className="mt-2 grid min-h-11 place-items-center rounded-md bg-card p-1.5 ring-1 ring-inset ring-border">
                      {brandingForm[key] ? <img src={brandingForm[key]} alt={label} className="max-h-10 max-w-full object-contain" /> : <span className="text-[11px] text-muted-foreground">No logo</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-1.5">
                <Label className={fieldLabel}>{t("cms_favicon")}</Label>
                <div className="flex gap-2">
                  <Input className="flex-1" value={brandingForm.favicon_url || ""} onChange={e => setBrandingForm(v => ({ ...v, favicon_url: e.target.value }))} placeholder="/uploads/favicon.png" />
                  <Button asChild variant="outline" size="sm">
                    <label className="cursor-pointer">
                      <Upload size={14} strokeWidth={2} /> {t("upload")}
                      <input type="file" hidden accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadBrandingImage("favicon_url", f); }} />
                    </label>
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">PNG or ICO — 32×32px or 64×64px, square</p>
                {brandingForm.favicon_url ? <img src={brandingForm.favicon_url} alt="favicon" className="mt-2 size-7 rounded-md bg-muted p-1 ring-1 ring-inset ring-border" /> : null}
              </div>
            </div>

            {/* Colors, fonts and button hover effect are now hard-coded in the
                app theme and are intentionally not editable from the CMS. */}

            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold tracking-wider text-primary uppercase">{t("cms_social_links")}</p>
              <div className="grid gap-1.5"><Label className={fieldLabel}>{t("cms_instagram")}</Label><Input value={brandingForm.social_instagram || ""} onChange={e => setBrandingForm(v => ({ ...v, social_instagram: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label className={fieldLabel}>{t("cms_facebook")}</Label><Input value={brandingForm.social_facebook || ""} onChange={e => setBrandingForm(v => ({ ...v, social_facebook: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label className={fieldLabel}>{t("cms_twitter")}</Label><Input value={brandingForm.social_twitter || ""} onChange={e => setBrandingForm(v => ({ ...v, social_twitter: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label className={fieldLabel}>{t("cms_youtube")}</Label><Input value={brandingForm.social_youtube || ""} onChange={e => setBrandingForm(v => ({ ...v, social_youtube: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label className={fieldLabel}>TikTok</Label><Input value={brandingForm.social_tiktok || ""} onChange={e => setBrandingForm(v => ({ ...v, social_tiktok: e.target.value }))} placeholder="https://tiktok.com/@yourhandle" /></div>
            </div>

            {/* Coming Soon Mode — toggles a public-site holding page with admin-uploaded background */}
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-bold tracking-wider text-primary uppercase">Coming Soon Mode</p>
              <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                <div className="min-w-0">
                  <Label htmlFor="coming-soon-toggle" className="text-[13px] font-semibold">Show Coming Soon page</Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Type "adminlogin" on the page to bypass.</p>
                </div>
                <Switch id="coming-soon-toggle" checked={brandingForm.coming_soon_enabled === "1"} onCheckedChange={v => setBrandingForm(prev => ({ ...prev, coming_soon_enabled: v ? "1" : "0" }))} aria-label="Show Coming Soon page" />
              </div>
              <div className="grid gap-1.5">
                <Label className={fieldLabel}>Headline (English)</Label>
                <Input value={brandingForm.coming_soon_text || ""} onChange={e => setBrandingForm(v => ({ ...v, coming_soon_text: e.target.value }))} placeholder="COMING SOON" />
              </div>
              <div className="grid gap-1.5">
                <Label className={fieldLabel}>Headline (Arabic)</Label>
                <Input dir="rtl" value={brandingForm.coming_soon_text_ar || ""} onChange={e => setBrandingForm(v => ({ ...v, coming_soon_text_ar: e.target.value }))} placeholder="قريباً" />
              </div>
              <div className="grid gap-1.5">
                <Label className={fieldLabel}>Background image</Label>
                <div className="flex gap-2">
                  <Input className="flex-1" value={brandingForm.coming_soon_bg_image || ""} onChange={e => setBrandingForm(v => ({ ...v, coming_soon_bg_image: e.target.value }))} placeholder="URL or upload" />
                  <Button asChild variant="outline" size="sm">
                    <label className="cursor-pointer whitespace-nowrap">
                      <Upload size={14} strokeWidth={2} /> Upload
                      <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) uploadBrandingImage("coming_soon_bg_image", f); e.target.value = ""; }} />
                    </label>
                  </Button>
                </div>
                {brandingForm.coming_soon_bg_image && (
                  <div className="mt-2 aspect-video w-full overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-border">
                    <img src={brandingForm.coming_soon_bg_image} alt="" className="size-full object-cover" />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Facebook and Instagram icons on the page link to whatever you set in the <strong>Social links</strong> column above.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Sections List */}
      {loading ? (
        <Card className="p-10 text-center text-[13px] text-muted-foreground">{t("cms_loading_sections")}</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map((s, idx) => {
            const info = typeInfo(s.type);
            const IconComp = info?.icon || Layout;
            const isEditing = editingId === s.id;
            return (
              <Card key={s.id} className={`gap-0 overflow-hidden p-0 ${isEditing ? "ring-1 ring-inset ring-primary/40" : ""}`}>
                {/* Section Header */}
                <div className={`flex items-center gap-3 px-4 py-3.5 ${isEditing ? "bg-primary/10" : ""}`}>
                  <div className={`grid size-9 shrink-0 place-items-center rounded-md ${s.is_visible ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <IconComp size={16} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{s.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{typeLabel(s.type)} · {t("order")} {idx + 1}</p>
                  </div>
                  {/* Visibility badge */}
                  <Badge variant={s.is_visible ? "default" : "muted"}>
                    {s.is_visible ? t("visible") : t("hidden")}
                  </Badge>
                  {/* Controls */}
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon-sm" title={t("move_up")} aria-label={t("move_up")} onClick={() => moveSection(s.id, "up")} disabled={idx === 0}>
                      <ChevronUp size={16} strokeWidth={2} />
                    </Button>
                    <Button variant="outline" size="icon-sm" title={t("move_down")} aria-label={t("move_down")} onClick={() => moveSection(s.id, "down")} disabled={idx === sections.length - 1}>
                      <ChevronDown size={16} strokeWidth={2} />
                    </Button>
                    <Button variant="outline" size="icon-sm" title={s.is_visible ? t("hide") : t("show")} aria-label={s.is_visible ? t("hide") : t("show")} onClick={() => toggleVisible(s)} className={s.is_visible ? "text-primary ring-primary/40" : ""}>
                      {s.is_visible ? <Eye size={16} strokeWidth={2} /> : <EyeOff size={16} strokeWidth={2} />}
                    </Button>
                    <Button variant="outline" size="icon-sm" title={isEditing ? t("close") : t("edit")} aria-label={isEditing ? t("close") : t("edit")} onClick={() => isEditing ? setEditingId(null) : startEdit(s)} className={isEditing ? "bg-primary/15 text-primary ring-primary/40" : ""}>
                      {isEditing ? <X size={16} strokeWidth={2} /> : <Edit3 size={16} strokeWidth={2} />}
                    </Button>
                    <Button variant="outline" size="icon-sm" title={t("delete")} aria-label={t("delete")} onClick={() => deleteSection(s.id)} className="text-destructive ring-destructive/40 hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 size={16} strokeWidth={2} />
                    </Button>
                  </div>
                </div>

                {/* Section Content Editor */}
                {isEditing && (
                  <div className="bg-muted px-5 py-4">
                    <Separator className="mb-4" />
                    <div className="mb-3.5 grid gap-1.5">
                      <Label className={fieldLabel}>{t("cms_section_label_admin")}</Label>
                      <Input className="bg-card" value={editLabel} onChange={e => setEditLabel(e.target.value)} />
                    </div>
                    <div className="mb-4">
                      <Label className={`${fieldLabel} mb-2.5 block`}>{t("content")}</Label>
                      {renderContentEditor(s.type)}
                      {renderSectionBackgroundFields()}
                    </div>
                    <div className="flex gap-2.5">
                      <Button onClick={saveEdit} disabled={saving}>
                        <Save size={16} strokeWidth={2} /> {saving ? t("saving") : t("save_changes")}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingId(null)}>
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Add Section Button */}
          <Button variant="ghost" onClick={() => { setAddLabel(typeLabel(addType)); setShowAddModal(true); }}
            className="h-14 text-muted-foreground hover:text-primary">
            <Plus size={18} strokeWidth={2} /> {t("cms_add_new_section")}
          </Button>
        </div>
      )}

      {/* Add Section Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("cms_add_new_section")}</DialogTitle>
            <DialogDescription className="sr-only">{t("cms_section_type_layout")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label className={fieldLabel}>{t("cms_section_type_layout")}</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                {SECTION_TYPES.map(st => {
                  const Ic = st.icon;
                  const sel = addType === st.type;
                  return (
                    <button key={st.type} type="button" onClick={() => { setAddType(st.type); setAddLabel(typeLabel(st.type)); }}
                      className={`rounded-md p-3 text-start transition-colors ${sel ? "bg-primary/15 ring-1 ring-inset ring-primary/40" : "bg-muted hover:bg-accent"}`}>
                      <Ic size={16} strokeWidth={2} className={sel ? "text-primary" : "text-muted-foreground"} />
                      <p className={`mt-1.5 text-xs font-semibold ${sel ? "text-primary" : "text-foreground"}`}>{typeLabel(st.type)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-section-label" className={fieldLabel}>{t("cms_section_label_admin_ref")}</Label>
              <Input id="add-section-label" value={addLabel} onChange={e => setAddLabel(e.target.value)} placeholder={typeLabel(addType)} />
            </div>
            <div className="flex gap-2.5">
              <Button onClick={addSection}>
                <Plus size={16} strokeWidth={2} /> {t("cms_add_section")}
              </Button>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
