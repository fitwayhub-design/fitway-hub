import type React from "react";
import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import UserLocationPicker from "@/components/app/UserLocationPicker";
import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";
import { Camera, Sun, Moon, Globe, LogOut, Shield, Bell, Edit2, Check, X, Settings, Activity, Save, Plus, Image as ImageIcon, Grid3x3, Info, SlidersHorizontal, Heart, MessageSquare, Ticket, MessageCircle, Dumbbell, CheckCircle2, PartyPopper, Zap } from "lucide-react";
import { avatarUrl } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ProfileTab = "posts" | "progress" | "about" | "settings";
type SettingsSection = "preferences" | "privacy" | "security";

export default function Profile() {
  const { user, token, logout, updateUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();

  const avatarRef = useRef<HTMLInputElement>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const nowRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Edit profile state
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    height: user?.height || "",
    weight: user?.weight || "",
    gender: user?.gender || "",
    dateOfBirth: (user as any)?.dateOfBirth || (user as any)?.date_of_birth || "",
    fitnessGoal: (user as any)?.fitnessGoal || (user as any)?.fitness_goal || "",
    activityLevel: (user as any)?.activityLevel || (user as any)?.activity_level || "",
    targetWeight: (user as any)?.targetWeight || (user as any)?.target_weight || "",
    weeklyGoal: (user as any)?.weeklyGoal || (user as any)?.weekly_goal || "",
  });

  // Before/Now photos
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [nowPhoto, setNowPhoto] = useState<string | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [showSecurity, setShowSecurity] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [stepGoalSaving, setStepGoalSaving] = useState(false);
  const [stepGoalDraft, setStepGoalDraft] = useState<number>((user as any)?.stepGoal || (user as any)?.step_goal || 10000);
  const [showProgressPhotos, setShowProgressPhotos] = useState(() => localStorage.getItem("profile_show_progress_photos") !== "0");
  const [showOnboardingData, setShowOnboardingData] = useState(() => localStorage.getItem("profile_show_onboarding_data") !== "0");
  const [showCommunityPostsCard, setShowCommunityPostsCard] = useState(() => localStorage.getItem("profile_show_community_posts") !== "0");
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem("app_notifications_enabled") !== "0");
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("app_reduced_motion") === "1");
  const [showLocationCard, setShowLocationCard] = useState(() => localStorage.getItem("app_show_location_card") !== "0");
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    otp: "",
  });
  // OTP flow state for password change: a code is sent to the user's
  // registered email, valid for 2 minutes (5 attempts).
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpRequesting, setOtpRequesting] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("preferences");

  useEffect(() => {
    setStepGoalDraft((user as any)?.stepGoal || (user as any)?.step_goal || 10000);
  }, [(user as any)?.stepGoal, (user as any)?.step_goal]);

  useEffect(() => {
    localStorage.setItem("app_notifications_enabled", notificationsEnabled ? "1" : "0");
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("app_reduced_motion", reducedMotion ? "1" : "0");
    document.documentElement.style.setProperty("scroll-behavior", reducedMotion ? "auto" : "smooth");
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem("app_show_location_card", showLocationCard ? "1" : "0");
  }, [showLocationCard]);

  useEffect(() => {
    localStorage.setItem("profile_show_progress_photos", showProgressPhotos ? "1" : "0");
  }, [showProgressPhotos]);

  useEffect(() => {
    localStorage.setItem("profile_show_onboarding_data", showOnboardingData ? "1" : "0");
  }, [showOnboardingData]);

  useEffect(() => {
    localStorage.setItem("profile_show_community_posts", showCommunityPostsCard ? "1" : "0");
  }, [showCommunityPostsCard]);

  useEffect(() => {
    if (!token) return;
    fetch(`${getApiBase()}/api/user/progress-photos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setBeforePhoto(d.before || null); setNowPhoto(d.now || null); }
      }).catch(() => {});
  }, [token]);

  useAutoRefresh(() => {
    if (!token) return;
    fetch(`${getApiBase()}/api/user/progress-photos`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setBeforePhoto(d.before || null); setNowPhoto(d.now || null); } })
      .catch(() => {});
  });

  useEffect(() => {
    if (!token || !user?.id) return;
    fetch(`${getApiBase()}/api/community/posts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((posts) => {
        const arr = Array.isArray(posts) ? posts : [];
        setCommunityPosts(arr.filter((p: any) => String(p.user_id) === String(user.id)));
      })
      .catch(() => setCommunityPosts([]));
  }, [token, user?.id]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { flash("❌ Pick an image file"); return; }
    if (file.size > 4 * 1024 * 1024) { flash("❌ Image must be under 4 MB"); return; }
    setUploading(true);
    try {
      // Read as data URL so we can store it inline on the user row — same
      // approach as branding images (no R2 / no ephemeral disk).
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ""));
        fr.onerror = () => reject(new Error("read failed"));
        fr.readAsDataURL(file);
      });
      const r = await fetch(`${getApiBase()}/api/user/profile`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: dataUrl }),
      });
      const d = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(d?.message || "upload failed");
      if (d.user) updateUser(d.user);
      flash("✅ Photo updated");
    } catch (err: any) {
      flash(`❌ ${err?.message || "Upload failed"}`);
    } finally {
      setUploading(false);
    }
  };

  const saveName = async () => {
    if (!nameVal.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/user/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: nameVal.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { flash(`❌ ${d?.message || "Failed"}`); setSaving(false); return; }
      if (d.user) updateUser(d.user);
      setEditName(false);
      flash("✅ Name updated");
    } catch { flash("❌ Failed"); }
    setSaving(false);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const body: any = {};
      if (profileForm.height) body.height = Number(profileForm.height);
      if (profileForm.weight) body.weight = Number(profileForm.weight);
      if (profileForm.gender) body.gender = profileForm.gender;
      if (profileForm.dateOfBirth) body.date_of_birth = profileForm.dateOfBirth;
      if (profileForm.fitnessGoal) body.fitness_goal = profileForm.fitnessGoal;
      if (profileForm.activityLevel) body.activity_level = profileForm.activityLevel;
      if (profileForm.targetWeight) body.target_weight = Number(profileForm.targetWeight);
      if (profileForm.weeklyGoal) body.weekly_goal = profileForm.weeklyGoal;
      const r = await fetch(`${getApiBase()}/api/user/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); if (d.user) updateUser(d.user); setEditProfile(false); flash("✅ Profile updated");
    } catch { flash("❌ Failed to update profile"); }
    setSaving(false);
  };

  const uploadProgressPhoto = async (type: "before" | "now", file: File) => {
    setPhotosLoading(true);
    const fd = new FormData(); fd.append("photo", file); fd.append("type", type);
    try {
      const r = await fetch(`${getApiBase()}/api/user/progress-photos`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (d.url) { type === "before" ? setBeforePhoto(d.url) : setNowPhoto(d.url); flash(`✅ ${type === "before" ? t("before_photo_updated") : t("now_photo_updated")}`); }
    } catch { flash(`❌ ${t("upload_failed")}`); }
    setPhotosLoading(false);
  };

  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const id = setTimeout(() => setOtpResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [otpResendCooldown]);

  const requestPasswordOtp = async () => {
    if (!securityForm.currentPassword || !securityForm.newPassword || !securityForm.confirmPassword) {
      flash(`❌ ${t("all_password_fields_required")}`);
      return;
    }
    if (securityForm.newPassword.length < 8) {
      flash(`❌ ${t("password_too_short")}`);
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      flash(`❌ ${t("password_confirmation_mismatch")}`);
      return;
    }
    setOtpRequesting(true);
    try {
      const r = await fetch(`${getApiBase()}/api/auth/change-password/request-otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        flash(`❌ ${d?.message || "Failed to send verification code"}`);
      } else {
        setOtpRequested(true);
        setOtpResendCooldown(30);
        flash(`✅ ${d.message || `Code sent to ${user?.email}`}`);
      }
    } catch {
      flash(`❌ Failed to send verification code`);
    }
    setOtpRequesting(false);
  };

  const saveSecuritySettings = async () => {
    if (!securityForm.otp || securityForm.otp.trim().length !== 6) {
      flash(`❌ Enter the 6-digit code sent to your email`);
      return;
    }
    setSecuritySaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/auth/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
          otp: securityForm.otp.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        flash(`❌ ${d?.message || t("failed_update_password")}`);
      } else {
        setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "", otp: "" });
        setOtpRequested(false);
        setOtpResendCooldown(0);
        flash(`✅ ${t("password_updated_success")}`);
      }
    } catch {
      flash(`❌ ${t("failed_update_password")}`);
    }
    setSecuritySaving(false);
  };

  const saveStepGoal = async () => {
    const stepGoal = Number(stepGoalDraft || 0);
    if (!stepGoal || stepGoal < 100) {
      flash(lang === "ar" ? "❌ هدف الخطوات لازم يكون 100 أو أكتر" : "❌ Step goal must be at least 100");
      return;
    }
    setStepGoalSaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/user/step-goal`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ step_goal: stepGoal }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        flash(`❌ ${d?.message || (lang === "ar" ? "فشل تحديث هدف الخطوات" : "Failed to update step goal")}`);
      } else {
        updateUser({ stepGoal: stepGoal, step_goal: stepGoal } as any);
        flash(lang === "ar" ? "✅ تم تحديث هدف الخطوات" : "✅ Step goal updated");
      }
    } catch {
      flash(lang === "ar" ? "❌ فشل تحديث هدف الخطوات" : "❌ Failed to update step goal");
    }
    setStepGoalSaving(false);
  };

  // Athletes may change their display name once in their lifetime. Coaches/admins
  // are not athletes here, so they keep the edit affordance regardless.
  const nameAlreadyChanged = Number((user as any)?.name_changed ?? (user as any)?.nameChanged ?? 0) === 1;
  const canChangeName = user?.role !== "user" || !nameAlreadyChanged;

  const bmi = user?.height && user?.weight ? (user.weight / ((user.height / 100) ** 2)).toFixed(1) : null;
  const bmiLabel = !bmi ? null : +bmi < 18.5 ? t("underweight") : +bmi < 25 ? t("normal_weight") : +bmi < 30 ? t("overweight") : t("obese");
  const bmiColor = !bmi ? "var(--text-muted)" : +bmi < 18.5 ? "var(--blue)" : +bmi < 25 ? "var(--green)" : +bmi < 30 ? "var(--amber)" : "var(--red)";

  const progressPhotoCount = (beforePhoto ? 1 : 0) + (nowPhoto ? 1 : 0);

  // Short labels — the full strings ("My Community Posts", "Onboarding Data",
  // "Progress Photos") overflowed each tab button at the available width and
  // bled into the next tab. The tab bar uses flex: 1 to distribute width
  // evenly, so the labels themselves have to fit; clipping with ellipsis on
  // the button below is the secondary safety net.
  const TABS: { key: ProfileTab; label: string; icon: any; count?: number }[] = [
    { key: "posts",    label: lang === "ar" ? "منشوراتي" : "Posts",    icon: Grid3x3,   count: communityPosts.length },
    { key: "progress", label: lang === "ar" ? "صور التقدم" : "Photos", icon: ImageIcon, count: progressPhotoCount },
    { key: "about",    label: lang === "ar" ? "بياناتي" : "About",     icon: Info },
    { key: "settings", label: lang === "ar" ? "الإعدادات" : "Settings", icon: Settings },
  ];

  const profileFields: { label: string; key: string; type: string; placeholder: string }[] = [
    { label: t("height_cm"), key: "height", type: "number", placeholder: "175" },
    { label: t("weight_kg"), key: "weight", type: "number", placeholder: "70" },
    { label: t("target_weight"), key: "targetWeight", type: "number", placeholder: "65" },
    { label: t("date_of_birth"), key: "dateOfBirth", type: "date", placeholder: "" },
  ];

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 pb-4">
      {/* ═══════════ HERO HEADER ═══════════ */}
      <Card className="relative mb-6 gap-0 overflow-hidden p-0 shadow-soft">
        {/* Cover */}
        <div className="relative h-24 overflow-hidden rounded-t-lg bg-muted">
          {/* FWH yellow accent stripe */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-primary" />
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          {/* Avatar — pulled up to overlap the cover (in-flow so it never
              collides with the stats row below). */}
          <div className="-mt-14 mb-3 inline-block">
            <div className="relative">
              <Avatar className="size-28 shadow-soft-md ring-4 ring-background">
                <AvatarImage src={avatarUrl(user)} alt={user?.name || "Profile"} />
                <AvatarFallback>{(user?.name || "U").slice(0, 1)}</AvatarFallback>
              </Avatar>
              <Button
                size="icon-sm"
                onClick={() => avatarRef.current?.click()}
                disabled={uploading}
                aria-label={lang === "ar" ? "تغيير الصورة" : "Change photo"}
                className="absolute -bottom-1 end-0 size-9 rounded-full ring-4 ring-background"
              >
                <Camera size={15} strokeWidth={2} />
              </Button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
          </div>

          {/* Name line — name on the left, theme/language/edit actions on the right */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[160px] flex-1">
              {editName ? (
                <div className="mb-1.5 flex items-center gap-2">
                  <Input value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus aria-label={lang === "ar" ? "الاسم" : "Name"} className="h-10 flex-1 text-[17px] font-bold" />
                  <Button size="icon-sm" onClick={saveName} disabled={saving} aria-label={lang === "ar" ? "حفظ الاسم" : "Save name"}><Check size={16} strokeWidth={2.5} /></Button>
                  <Button variant="secondary" size="icon-sm" onClick={() => { setEditName(false); setNameVal(user?.name || ""); }} aria-label={lang === "ar" ? "إلغاء" : "Cancel"}><X size={16} strokeWidth={2} /></Button>
                </div>
              ) : (
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <h1 className="text-[28px] leading-tight font-bold tracking-tight break-words">{user?.name}</h1>
                  {canChangeName ? (
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => { setEditName(true); setNameVal(user?.name || ""); }} aria-label={lang === "ar" ? "تعديل الاسم" : "Edit name"} title={lang === "ar" ? "يمكنك تغيير الاسم مرة واحدة فقط" : "You can change your name once"}><Edit2 size={15} strokeWidth={2} /></Button>
                  ) : (
                    <span className="text-muted-foreground/70" aria-hidden title={lang === "ar" ? "تم تغيير الاسم من قبل" : "Name already changed once"}><Shield size={13} strokeWidth={2} /></span>
                  )}
                </div>
              )}
              <p className="text-[13px] break-all text-muted-foreground">{user?.email}</p>
              {editName && (
                <p className="mt-1 text-[11px] text-amber-500">
                  {lang === "ar" ? "⚠️ يمكنك تغيير اسمك مرة واحدة فقط مدى الحياة." : "⚠️ You can change your name only once — lifetime."}
                </p>
              )}
              {(user as any)?.fitnessGoal && (
                <p className="mt-1.5 text-[13px] font-semibold text-primary">
                  🎯 {(user as any).fitnessGoal}
                </p>
              )}
            </div>

            {/* Quick actions: theme, language, edit profile */}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="icon-sm" onClick={toggleTheme} aria-label={lang === "ar" ? "تبديل المظهر" : "Toggle theme"}>
                {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
              </Button>
              <Button variant="secondary" size="icon-sm" onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label={lang === "ar" ? "تغيير اللغة" : "Change language"}>
                <Globe size={16} strokeWidth={2} />
              </Button>
              <Button
                variant={editProfile ? "default" : "outline"}
                size="sm"
                onClick={() => { setEditProfile(!editProfile); setActiveTab("about"); setProfileForm({ height: user?.height || "", weight: user?.weight || "", gender: user?.gender || "", dateOfBirth: (user as any)?.dateOfBirth || (user as any)?.date_of_birth || "", fitnessGoal: (user as any)?.fitnessGoal || (user as any)?.fitness_goal || "", activityLevel: (user as any)?.activityLevel || (user as any)?.activity_level || "", targetWeight: (user as any)?.targetWeight || (user as any)?.target_weight || "", weeklyGoal: (user as any)?.weeklyGoal || (user as any)?.weekly_goal || "" }); }}
              >
                <Edit2 size={14} strokeWidth={2} /> {editProfile ? t("cancel_editing") : t("edit_profile_info")}
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { label: t("points"), value: (user?.points || 0).toLocaleString() },
              { label: t("steps_today"), value: (user?.steps || 0).toLocaleString() },
              { label: t("bmi_label"), value: bmi || "—", sub: bmiLabel || "" },
            ].map((s) => (
              <div key={s.label} className="rounded-md bg-muted px-2.5 py-4 text-center">
                <p className="text-2xl leading-none font-bold tabular-nums tracking-tight">{s.value}</p>
                {(s as any).sub && <p className="mt-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">{(s as any).sub}</p>}
                <p className="mt-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {msg && (
        <div role="status" className={`mb-4 rounded-md px-3.5 py-2.5 text-[13px] font-semibold ${msg.startsWith("✅") ? "bg-[color-mix(in_srgb,var(--green)_14%,transparent)] text-[var(--green)]" : "bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-[var(--red)]"}`}>
          {msg}
        </div>
      )}

      {/* ═══════════ TABS ═══════════ */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="gap-5">
        <div className="sticky top-[var(--app-top-offset,0px)] z-[5] -mx-4 bg-background px-4 pt-1">
          <TabsList className="w-full">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.key} value={tab.key} className="min-w-0 px-1.5">
                  <Icon size={15} strokeWidth={2} />
                  <span className="truncate">{tab.label}</span>
                  {typeof tab.count === "number" && tab.count > 0 && (
                    <Badge variant="muted" className="px-1.5 py-0 text-[10px] data-[state=active]:bg-primary/15">{tab.count}</Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* ═══════════ TAB: POSTS ═══════════ */}
        <TabsContent value="posts" className="flex flex-col gap-5">
          <Card className="p-5">
            {communityPosts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Grid3x3 size={32} strokeWidth={2} className="mx-auto mb-2 text-muted-foreground" />
                <p className="mb-1 text-[15px] font-semibold text-foreground">{t("no_community_posts_yet")}</p>
                <Link to="/app/community" className="text-[13px] font-semibold text-primary transition-opacity hover:opacity-75">
                  {lang === "ar" ? "اذهب للمجتمع →" : "Go to Community →"}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {communityPosts.map((post: any) => (
                  <div key={post.id} className="rounded-md bg-muted px-3.5 py-3 shadow-soft-xs">
                    <div className="mb-2 flex items-center justify-between gap-2.5">
                      <p className="text-[11px] text-muted-foreground">{post.created_at ? new Date(post.created_at).toLocaleString() : ""}</p>
                      <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Heart size={12} strokeWidth={2} /> {post.likes || 0}</p>
                    </div>
                    {post.content && <p className={`text-[13px] leading-relaxed text-foreground ${post.media_url || post.hashtags ? "mb-2" : ""}`}>{post.content}</p>}
                    {post.media_url && (
                      <img src={post.media_url} alt={lang === "ar" ? "منشور" : "post"} className={`max-h-64 w-full rounded-md object-cover ${post.hashtags ? "mb-2" : ""}`} />
                    )}
                    {post.hashtags && <p className="text-[13px] break-words text-[var(--secondary)]">{post.hashtags}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent activity feed: forms, tickets, plan-comments, training
              events — the meeting wants this beside the community posts on
              the client profile. */}
          <RecentActivityCard token={token} lang={lang} />
        </TabsContent>

        {/* ═══════════ TAB: PROGRESS ═══════════ */}
        <TabsContent value="progress">
          <Card className="p-5">
            <p className="mb-3 text-[15px] font-semibold text-muted-foreground">
              {lang === "ar" ? "شارك قبل وبعد لرؤية تقدمك" : "Track your transformation"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("before_label")}</p>
                <button type="button" onClick={() => beforeRef.current?.click()}
                  className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-border transition active:scale-[0.99]">
                  {beforePhoto ? (
                    <img src={beforePhoto.startsWith("http") ? beforePhoto : `${getApiBase()}${beforePhoto}`} alt={t("before_label")} className="size-full object-cover" />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Plus size={24} strokeWidth={2} className="mx-auto" /><p className="mt-1 text-[11px]">{t("add_photo")}</p>
                    </div>
                  )}
                </button>
                <input ref={beforeRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadProgressPhoto("before", f); }} />
              </div>
              <div>
                <p className="mb-1.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("now_label")}</p>
                <button type="button" onClick={() => nowRef.current?.click()}
                  className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-border transition active:scale-[0.99]">
                  {nowPhoto ? (
                    <img src={nowPhoto.startsWith("http") ? nowPhoto : `${getApiBase()}${nowPhoto}`} alt={t("now_label")} className="size-full object-cover" />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Plus size={24} strokeWidth={2} className="mx-auto" /><p className="mt-1 text-[11px]">{t("add_photo")}</p>
                    </div>
                  )}
                </button>
                <input ref={nowRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadProgressPhoto("now", f); }} />
              </div>
            </div>
            {photosLoading && <p className="mt-2 text-center text-[13px] text-muted-foreground">{t("uploading_text")}</p>}
          </Card>
        </TabsContent>

        {/* ═══════════ TAB: ABOUT ═══════════ */}
        <TabsContent value="about" className="flex flex-col gap-4">
          {/* Body stats */}
          {(user?.height || user?.weight || user?.gender) && (
            <Card className="p-5">
              <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {lang === "ar" ? "بياناتك الجسدية" : "Body stats"}
              </p>
              <div className="flex gap-2">
                {user?.height && <div className="flex-1 rounded-md bg-muted p-2.5 text-center">
                  <p className="text-[15px] font-semibold">{user.height} cm</p>
                  <p className="text-[11px] text-muted-foreground">{t("height_label")}</p>
                </div>}
                {user?.weight && <div className="flex-1 rounded-md bg-muted p-2.5 text-center">
                  <p className="text-[15px] font-semibold">{user.weight} kg</p>
                  <p className="text-[11px] text-muted-foreground">{t("weight_label")}</p>
                </div>}
                {user?.gender && <div className="flex-1 rounded-md bg-muted p-2.5 text-center">
                  <p className="text-[15px] font-semibold">{user.gender === "male" ? "♂" : user.gender === "female" ? "♀" : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{t("gender")}</p>
                </div>}
              </div>
            </Card>
          )}

          {/* Edit profile form */}
          {editProfile && (
            <Card className="p-5">
              <p className="mb-4 text-[15px] font-semibold">{t("edit_profile_info")}</p>
              <div className="flex flex-col gap-4">
                {profileFields.map(f => (
                  <div key={f.key} className="grid gap-2">
                    <Label htmlFor={`profile-${f.key}`}>{f.label}</Label>
                    <Input id={`profile-${f.key}`} type={f.type} value={(profileForm as any)[f.key]} onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                  </div>
                ))}
                <div className="grid gap-2">
                  <Label htmlFor="profile-gender">{t("gender")}</Label>
                  <Select value={profileForm.gender || undefined} onValueChange={(v) => setProfileForm(p => ({ ...p, gender: v }))}>
                    <SelectTrigger id="profile-gender" className="w-full">
                      <SelectValue placeholder={t("select_prompt")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("male")}</SelectItem>
                      <SelectItem value="female">{t("female")}</SelectItem>
                      <SelectItem value="other">{t("other_gender")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-goal">{t("main_goal")}</Label>
                  <Select value={profileForm.fitnessGoal || undefined} onValueChange={(v) => setProfileForm(p => ({ ...p, fitnessGoal: v }))}>
                    <SelectTrigger id="profile-goal" className="w-full">
                      <SelectValue placeholder={t("select_prompt")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose_weight">{t("lose_weight")}</SelectItem>
                      <SelectItem value="gain_muscle">{t("gain_muscle_opt")}</SelectItem>
                      <SelectItem value="maintain">{t("maintain_opt")}</SelectItem>
                      <SelectItem value="improve_fitness">{t("improve_fitness_opt")}</SelectItem>
                      <SelectItem value="flexibility">{t("flexibility_goal")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-activity">{t("activity_level_label")}</Label>
                  <Select value={profileForm.activityLevel || undefined} onValueChange={(v) => setProfileForm(p => ({ ...p, activityLevel: v }))}>
                    <SelectTrigger id="profile-activity" className="w-full">
                      <SelectValue placeholder={t("select_prompt")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">{t("sedentary")}</SelectItem>
                      <SelectItem value="lightly_active">{t("lightly_active")}</SelectItem>
                      <SelectItem value="moderately_active">{t("moderately_active")}</SelectItem>
                      <SelectItem value="very_active">{t("very_active")}</SelectItem>
                      <SelectItem value="extra_active">{t("extra_active")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-weekly">{t("weekly_goal")}</Label>
                  <Select value={profileForm.weeklyGoal || undefined} onValueChange={(v) => setProfileForm(p => ({ ...p, weeklyGoal: v }))}>
                    <SelectTrigger id="profile-weekly" className="w-full">
                      <SelectValue placeholder={t("select_prompt")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">{t("lose_0_25")}</SelectItem>
                      <SelectItem value="0.5">{t("lose_0_5")}</SelectItem>
                      <SelectItem value="0.75">{t("lose_0_75")}</SelectItem>
                      <SelectItem value="1">{t("lose_1")}</SelectItem>
                      <SelectItem value="maintain">{t("maintain_weight_opt")}</SelectItem>
                      <SelectItem value="gain_0.25">{t("gain_0_25")}</SelectItem>
                      <SelectItem value="gain_0.5">{t("gain_0_5")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={saveProfile} disabled={saving} size="lg" className="w-full">
                  <Save size={16} strokeWidth={2} /> {saving ? t("saving_text") : t("save_profile_text")}
                </Button>
              </div>
            </Card>
          )}

          {/* Onboarding / About data */}
          <Card className="p-5">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("onboarding_data")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: t("date_of_birth"), value: (user as any)?.dateOfBirth || "—" },
                { label: t("main_goal"), value: (user as any)?.fitnessGoal || "—" },
                { label: t("activity_level_label"), value: (user as any)?.activityLevel || "—" },
                { label: t("computed_activity"), value: (user as any)?.computedActivityLevel || "—" },
                { label: t("target_weight"), value: (user as any)?.targetWeight ? `${(user as any).targetWeight} kg` : "—" },
                { label: t("weekly_goal"), value: (user as any)?.weeklyGoal || "—" },
                { label: t("step_goal_label"), value: user?.stepGoal ? `${user.stepGoal.toLocaleString()} steps/day` : "—" },
                { label: t("location"), value: [(user as any)?.city, (user as any)?.country].filter(Boolean).join(", ") || "—" },
              ].map((row) => (
                <div key={row.label} className="rounded-md bg-muted px-3 py-2.5">
                  <p className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">{row.label}</p>
                  <p className="text-[13px] font-semibold text-foreground">{row.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Location picker */}
          {showLocationCard && (
            <Card className="px-5">
              <UserLocationPicker
                token={token}
                savedLat={(user as any)?.latitude ?? null}
                savedCity={(user as any)?.city ?? null}
              />
            </Card>
          )}
        </TabsContent>

        {/* ═══════════ TAB: SETTINGS ═══════════ */}
        <TabsContent value="settings" className="flex flex-col gap-4">
          {/* Settings sub-nav — 3 equal columns so all three tabs fit on the
              narrowest phones without horizontal scroll. */}
          <Tabs value={settingsSection} onValueChange={(v) => setSettingsSection(v as SettingsSection)}>
            <TabsList className="w-full">
              {([
                { key: "preferences", label: lang === "ar" ? "التفضيلات" : "Preferences", icon: SlidersHorizontal },
                { key: "privacy", label: lang === "ar" ? "الخصوصية" : "Privacy", icon: Shield },
                { key: "security", label: lang === "ar" ? "الأمان" : "Security", icon: Shield },
              ] as { key: SettingsSection; label: string; icon: any }[]).map(s => {
                const Icon = s.icon;
                return (
                  <TabsTrigger key={s.key} value={s.key} className="min-w-0">
                    <Icon size={14} strokeWidth={2} /> <span className="truncate">{s.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Preferences */}
          {settingsSection === "preferences" && (
            <Card className="gap-0 p-0">
              {[
                { id: "pref-dark", icon: isDark ? Sun : Moon, label: lang === "ar" ? "الوضع الليلي" : "Dark Mode", value: isDark, onToggle: () => toggleTheme() },
                { id: "pref-lang", icon: Globe, label: lang === "ar" ? "اللغة العربية" : "Arabic Language", value: lang === "ar", onToggle: () => setLang(lang === "en" ? "ar" : "en") },
                { id: "pref-notif", icon: Bell, label: lang === "ar" ? "الإشعارات" : "Notifications", value: notificationsEnabled, onToggle: () => setNotificationsEnabled((v) => !v) },
                { id: "pref-motion", icon: Activity, label: lang === "ar" ? "تقليل الحركة" : "Reduced Motion", value: reducedMotion, onToggle: () => setReducedMotion((v) => !v) },
                { id: "pref-location", icon: Settings, label: lang === "ar" ? "إظهار إعدادات الموقع" : "Show Location Settings", value: showLocationCard, onToggle: () => setShowLocationCard((v) => !v) },
              ].map((item, i, arr) => {
                const Icon = item.icon;
                return (
                  <div key={item.id}>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
                        <Icon size={18} strokeWidth={2} className="text-muted-foreground" />
                      </span>
                      <Label htmlFor={item.id} className="flex-1 text-[15px] font-medium">{item.label}</Label>
                      <Switch id={item.id} checked={item.value} onCheckedChange={item.onToggle} />
                    </div>
                    {i < arr.length - 1 && <Separator />}
                  </div>
                );
              })}
            </Card>
          )}

          {/* Privacy */}
          {settingsSection === "privacy" && (
            <Card className="p-5">
              <p className="mb-3 text-[15px] font-semibold">{lang === "ar" ? "ما يظهر للآخرين" : "Profile Visibility"}</p>
              <div className="overflow-hidden rounded-md bg-muted">
                {[
                  { id: "priv-photos", label: lang === "ar" ? "إظهار صور التقدم" : "Show Progress Photos", value: showProgressPhotos, onToggle: () => setShowProgressPhotos((v) => !v) },
                  { id: "priv-onboarding", label: lang === "ar" ? "إظهار بيانات البداية" : "Show Onboarding Data", value: showOnboardingData, onToggle: () => setShowOnboardingData((v) => !v) },
                  { id: "priv-community", label: lang === "ar" ? "إظهار منشورات المجتمع" : "Show Community Posts", value: showCommunityPostsCard, onToggle: () => setShowCommunityPostsCard((v) => !v) },
                ].map((s, i, arr) => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between gap-3 px-3 py-3">
                      <Label htmlFor={s.id} className="text-[13px] font-semibold">{s.label}</Label>
                      <Switch id={s.id} checked={s.value} onCheckedChange={s.onToggle} />
                    </div>
                    {i < arr.length - 1 && <Separator className="bg-border/60" />}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 rounded-md bg-muted px-3 py-3">
                <Label htmlFor="step-goal" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {lang === "ar" ? "هدف الخطوات اليومي" : "Daily Step Goal"}
                </Label>
                <div className="flex gap-2">
                  <Input id="step-goal" type="number" min={100} value={stepGoalDraft} onChange={(e) => setStepGoalDraft(Number(e.target.value || 0))} className="flex-1 bg-card" />
                  <Button onClick={saveStepGoal} disabled={stepGoalSaving}>
                    {stepGoalSaving ? (lang === "ar" ? "جاري الحفظ" : "Saving") : (lang === "ar" ? "حفظ" : "Save")}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Security */}
          {settingsSection === "security" && (
            <Card className="p-5">
              <p className="mb-3 flex items-center gap-1.5 text-[15px] font-semibold">
                <Shield size={16} strokeWidth={2} /> {t("security_settings")}
              </p>
              <div className="flex flex-col gap-3">
                <div className="rounded-md bg-muted p-3.5">
                  <p className="mb-2.5 text-[13px] font-semibold">{t("email_address") || "Email address"}</p>
                  <div className="flex items-center gap-2">
                    <Input value={user?.email || ""} readOnly disabled aria-label={t("email_address") || "Email address"} className="bg-card" />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{t("email_locked_note") || "Your email is linked to your account and can't be changed."}</p>
                </div>

                <div className="rounded-md bg-muted p-3.5">
                  <p className="mb-2.5 text-[13px] font-semibold">{t("change_password")}</p>
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="sec-current-pw">{t("current_password")}</Label>
                      <Input id="sec-current-pw" type="password" value={securityForm.currentPassword} onChange={(e) => setSecurityForm((p) => ({ ...p, currentPassword: e.target.value }))} className="bg-card" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sec-new-pw">{t("new_password")}</Label>
                      <Input id="sec-new-pw" type="password" value={securityForm.newPassword} onChange={(e) => setSecurityForm((p) => ({ ...p, newPassword: e.target.value }))} className="bg-card" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sec-confirm-pw">{t("confirm_new_password")}</Label>
                      <Input id="sec-confirm-pw" type="password" value={securityForm.confirmPassword} onChange={(e) => setSecurityForm((p) => ({ ...p, confirmPassword: e.target.value }))} className="bg-card" />
                    </div>
                    {!otpRequested ? (
                      <Button onClick={requestPasswordOtp} disabled={otpRequesting} className="w-full">
                        {otpRequesting ? "Sending code..." : `Send code to ${user?.email}`}
                      </Button>
                    ) : (
                      <>
                        <div className="rounded-md bg-primary/10 px-3 py-2.5 text-[13px] text-muted-foreground">
                          We sent a 6-digit code to <strong className="text-foreground">{user?.email}</strong>. It expires in 2 minutes.
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="sec-otp">Verification code</Label>
                          <Input
                            id="sec-otp"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={securityForm.otp}
                            onChange={(e) => setSecurityForm((p) => ({ ...p, otp: e.target.value.replace(/\D/g, "") }))}
                            placeholder="000000"
                            className="bg-card text-center text-[16px] tracking-[0.4em]"
                          />
                        </div>
                        <Button onClick={saveSecuritySettings} disabled={securitySaving || securityForm.otp.length !== 6} className="w-full">
                          {securitySaving ? t("updating_text") : "Verify & update password"}
                        </Button>
                        <div className="flex items-center justify-between text-[13px]">
                          <Button type="button" variant="link" className="h-auto p-0 text-muted-foreground" onClick={() => { setOtpRequested(false); setSecurityForm((p) => ({ ...p, otp: "" })); setOtpResendCooldown(0); }}>← Cancel</Button>
                          <Button type="button" variant="link" className="h-auto p-0 font-semibold disabled:text-muted-foreground disabled:no-underline" onClick={requestPasswordOtp} disabled={otpResendCooldown > 0 || otpRequesting}>
                            {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend code"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Button onClick={() => navigate("/auth/forgot-password")} variant="secondary" className="w-full">
                  {t("forgot_password")}
                </Button>
              </div>
            </Card>
          )}

          {/* Logout */}
          <Button onClick={() => { logout(); navigate("/auth/login"); }} variant="destructive" size="lg" className="w-full">
            <LogOut size={17} strokeWidth={2} /> {t("sign_out")}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}


function RecentActivityCard({ token, lang }: { token: string | null; lang: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(getApiBase() + '/api/tickets/recent-activity', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { activity: [] })
      .then(d => setItems(d.activity || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token]);

  const labelFor = (it: any) => {
    if (it.kind === 'post')     return { label: 'Community post',   icon: MessageSquare };
    if (it.kind === 'ticket')   return { label: 'Ticket',           icon: Ticket };
    if (it.kind === 'comment')  return { label: 'Plan comment',     icon: MessageCircle };
    if (it.kind === 'training') {
      if (it.title === 'workout_started')  return { label: 'Started training',  icon: Dumbbell };
      if (it.title === 'workout_finished') return { label: 'Finished a workout', icon: CheckCircle2 };
      if (it.title === 'plan_finished')    return { label: 'Finished the plan', icon: PartyPopper };
      return { label: 'Training update', icon: Zap };
    }
    return { label: it.kind, icon: Activity };
  };

  return (
    <Card className="p-5">
      <p className="mb-3 text-[11px] tracking-wide text-muted-foreground uppercase">
        {lang === "ar" ? "آخر الأنشطة" : "Recent activity"}
      </p>
      {loading ? (
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing yet — open a ticket, comment on a plan, or finish a workout to see it here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.slice(0, 12).map((it: any) => {
            const meta = labelFor(it);
            const MetaIcon = meta.icon;
            const titlePreview = (it.title || '').slice(0, 80);
            return (
              <li key={`${it.kind}-${it.id}`} className="flex items-center gap-2.5 rounded-md bg-muted px-2.5 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-card text-muted-foreground">
                  <MetaIcon size={16} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">{meta.label}</p>
                  {titlePreview && <p className="truncate text-[13px] text-muted-foreground">{titlePreview}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(it.created_at).toLocaleDateString()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
