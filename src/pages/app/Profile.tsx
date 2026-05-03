import type React from "react";
import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import UserLocationPicker from "@/components/app/UserLocationPicker";
import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";
import { Camera, Sun, Moon, Globe, LogOut, Shield, Bell, Edit2, Check, X, Settings, Activity, Save, Plus, Image as ImageIcon, Grid3x3, Info, SlidersHorizontal, Heart } from "lucide-react";
import { avatarUrl } from "@/lib/avatar";

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
  const [emailSaving, setEmailSaving] = useState(false);
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
  });
  const [emailForm, setEmailForm] = useState({
    currentPassword: "",
    newEmail: user?.email || "",
  });
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("preferences");

  useEffect(() => {
    setEmailForm((prev) => ({ ...prev, newEmail: user?.email || "" }));
  }, [user?.email]);

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
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("avatar", file);
    try {
      const r = await fetch(`${getApiBase()}/api/user/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json(); if (d.user) updateUser(d.user); flash("✅ Photo updated");
    } catch { flash("❌ Upload failed"); }
    setUploading(false);
  };

  const saveName = async () => {
    if (!nameVal.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/user/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: nameVal.trim() }) });
      const d = await r.json(); if (d.user) updateUser(d.user); setEditName(false); flash("✅ Name updated");
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

  const saveSecuritySettings = async () => {
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
    setSecuritySaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/auth/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        flash(`❌ ${d?.message || t("failed_update_password")}`);
      } else {
        setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        flash(`✅ ${t("password_updated_success")}`);
      }
    } catch {
      flash(`❌ ${t("failed_update_password")}`);
    }
    setSecuritySaving(false);
  };

  const saveEmailSettings = async () => {
    if (!emailForm.currentPassword || !emailForm.newEmail.trim()) {
      flash(`❌ ${t("current_password_new_email_required")}`);
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailForm.newEmail.trim())) {
      flash(`❌ ${t("valid_email_address")}`);
      return;
    }
    setEmailSaving(true);
    try {
      const r = await fetch(`${getApiBase()}/api/auth/change-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: emailForm.currentPassword,
          newEmail: emailForm.newEmail.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        flash(`❌ ${d?.message || t("failed_update_email")}`);
      } else {
        updateUser({ email: d?.email || emailForm.newEmail.trim() } as any);
        setEmailForm({ currentPassword: "", newEmail: d?.email || emailForm.newEmail.trim() });
        flash(`✅ ${t("email_updated_success")}`);
      }
    } catch {
      flash(`❌ ${t("failed_update_email")}`);
    }
    setEmailSaving(false);
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

  const bmi = user?.height && user?.weight ? (user.weight / ((user.height / 100) ** 2)).toFixed(1) : null;
  const bmiLabel = !bmi ? null : +bmi < 18.5 ? t("underweight") : +bmi < 25 ? t("normal_weight") : +bmi < 30 ? t("overweight") : t("obese");
  const bmiColor = !bmi ? "var(--text-muted)" : +bmi < 18.5 ? "var(--blue)" : +bmi < 25 ? "var(--green)" : +bmi < 30 ? "var(--amber)" : "var(--red)";

  const progressPhotoCount = (beforePhoto ? 1 : 0) + (nowPhoto ? 1 : 0);

  const TABS: { key: ProfileTab; label: string; icon: any; count?: number }[] = [
    { key: "posts",    label: t("my_community_posts") || "Posts", icon: Grid3x3, count: communityPosts.length },
    { key: "progress", label: t("progress_photos") || "Progress", icon: ImageIcon, count: progressPhotoCount },
    { key: "about",    label: t("onboarding_data") || "About",    icon: Info },
    { key: "settings", label: lang === "ar" ? "الإعدادات" : "Settings", icon: Settings },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 32 }}>
      {/* ═══════════ HERO HEADER ═══════════ */}
      <div style={{ position: "relative", marginBottom: 70 }}>
        {/* Cover gradient */}
        <div style={{
          height: 160,
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          position: "relative",
        }}>
          {/* FWH yellow accent stripe */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "var(--main)" }} />
          {/* Top-right quick actions over cover */}
          <div style={{ position: "absolute", top: 56, [lang === "ar" ? "left" : "right"]: 16, display: "flex", gap: 8 }}>
            <button onClick={toggleTheme} aria-label="theme"
              style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)" }}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label="lang"
              style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)", fontSize: 13 }}>
              {lang === "en" ? "🇸🇦" : "🇬🇧"}
            </button>
          </div>
        </div>

        {/* Avatar overlapping cover */}
        <div style={{ position: "absolute", [lang === "ar" ? "right" : "left"]: 20, bottom: -56, zIndex: 2 }}>
          <div style={{ position: "relative" }}>
            <img src={avatarUrl(user)} alt=""
              style={{ width: 112, height: 112, borderRadius: "50%", objectFit: "cover", border: "4px solid var(--bg-primary)", background: "var(--bg-surface)", boxShadow: "0 6px 20px rgba(0,0,0,0.3)" }} />
            <button onClick={() => avatarRef.current?.click()} disabled={uploading}
              style={{ position: "absolute", bottom: 2, [lang === "ar" ? "left" : "right"]: 2, width: 32, height: 32, borderRadius: "50%", background: "var(--main)", border: "3px solid var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Camera size={14} color="#0A0A0B" />
            </button>
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />
          </div>
        </div>

        {/* Identity info under cover */}
        <div style={{ padding: "12px 20px 0", marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180, paddingTop: 64 }}>
              {editName ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <input value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 17, fontWeight: 800, outline: "none" }} />
                  <button onClick={saveName} disabled={saving} style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} color="#0A0A0B" /></button>
                  <button onClick={() => { setEditName(false); setNameVal(user?.name || ""); }} style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <h1 style={{ fontSize: 32, fontWeight: 300, fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", letterSpacing: "-0.02em", lineHeight: 1.0, textTransform: "uppercase", margin: 0 }}>{user?.name}</h1>
                  <button onClick={() => { setEditName(true); setNameVal(user?.name || ""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><Edit2 size={13} /></button>
                </div>
              )}
              <p style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 10, color: "var(--text-muted)", margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>{user?.email}</p>
              {(user as any)?.fitnessGoal && (
                <p style={{ fontSize: 12, color: "var(--accent)", margin: "4px 0 0", fontWeight: 600 }}>
                  🎯 {(user as any).fitnessGoal}
                </p>
              )}
            </div>
            <button onClick={() => { setEditProfile(!editProfile); setActiveTab("about"); setProfileForm({ height: user?.height || "", weight: user?.weight || "", gender: user?.gender || "", dateOfBirth: (user as any)?.dateOfBirth || (user as any)?.date_of_birth || "", fitnessGoal: (user as any)?.fitnessGoal || (user as any)?.fitness_goal || "", activityLevel: (user as any)?.activityLevel || (user as any)?.activity_level || "", targetWeight: (user as any)?.targetWeight || (user as any)?.target_weight || "", weeklyGoal: (user as any)?.weeklyGoal || (user as any)?.weekly_goal || "" }); }}
              style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid var(--main)", background: editProfile ? "var(--main)" : "transparent", color: editProfile ? "#0A0A0B" : "var(--main)", fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontWeight: 600, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Edit2 size={13} /> {editProfile ? t("cancel_editing") : t("edit_profile_info")}
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginTop: 20 }}>
            {[
              { label: t("points"), value: (user?.points || 0).toLocaleString() },
              { label: t("steps_today"), value: (user?.steps || 0).toLocaleString() },
              { label: t("bmi_label"), value: bmi || "—", sub: bmiLabel || "" },
            ].map((s, i) => (
              <div key={s.label} style={{ background: "var(--bg-card)", padding: "16px 10px", textAlign: "center", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
                <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.0, color: "var(--text-primary)", margin: 0 }}>{s.value}</p>
                {(s as any).sub && <p style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 9, color: "var(--main)", fontWeight: 600, margin: "4px 0 0", letterSpacing: "0.16em", textTransform: "uppercase" }}>{(s as any).sub}</p>}
                <p style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 9, color: "var(--text-muted)", marginTop: 6, letterSpacing: "0.18em", textTransform: "uppercase" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {msg && <div style={{ margin: "0 16px 12px", padding: "10px 14px", borderRadius: 12, background: msg.startsWith("✅") ? "rgba(74,222,128,0.1)" : "rgba(251,113,133,0.1)", border: `1px solid ${msg.startsWith("✅") ? "var(--green)" : "var(--red)"}`, fontSize: 13, fontWeight: 600, color: msg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{msg}</div>}

      {/* ═══════════ TAB NAV ═══════════ */}
      <div style={{ margin: "0 16px 20px", position: "sticky", top: 0, zIndex: 5, background: "var(--bg-primary)", paddingTop: 4 }}>
        <div role="tablist" style={{ display: "flex", gap: 0, padding: 0, borderRadius: 12, background: "transparent", borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, minWidth: 82,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "12px 10px", borderRadius: 12,
                  border: "none",
                  borderBottom: active ? "2px solid var(--main)" : "2px solid transparent",
                  cursor: "pointer",
                  background: "transparent",
                  color: active ? "var(--main)" : "var(--text-muted)",
                  fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)",
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}>
                <Icon size={13} />
                <span>{tab.label}</span>
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 12, border: "1px solid currentColor", color: active ? "var(--main)" : "var(--text-muted)" }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ TAB: POSTS ═══════════ */}
      {activeTab === "posts" && (
        <div style={{ margin: "0 16px 20px", padding: "16px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {communityPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 16px" }}>
              <Grid3x3 size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{t("no_community_posts_yet")}</p>
              <Link to="/app/community" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                {lang === "ar" ? "اذهب للمجتمع →" : "Go to Community →"}
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {communityPosts.map((post: any) => (
                <div key={post.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{post.created_at ? new Date(post.created_at).toLocaleString() : ""}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 3 }}><Heart size={11} /> {post.likes || 0}</p>
                  </div>
                  {post.content && <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: post.media_url || post.hashtags ? 8 : 0 }}>{post.content}</p>}
                  {post.media_url && (
                    <img src={post.media_url} alt="post" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)", marginBottom: post.hashtags ? 8 : 0 }} />
                  )}
                  {post.hashtags && <p style={{ fontSize: 12, color: "var(--blue)", wordBreak: "break-word", margin: 0 }}>{post.hashtags}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: PROGRESS ═══════════ */}
      {activeTab === "progress" && (
        <div style={{ margin: "0 16px 20px", padding: "16px", borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text-muted)" }}>
            {lang === "ar" ? "شارك قبل وبعد لرؤية تقدمك" : "Track your transformation"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("before_label")}</p>
              <div onClick={() => beforeRef.current?.click()}
                style={{ width: "100%", aspectRatio: "3/4", borderRadius: 14, border: "2px dashed var(--border)", background: "var(--bg-surface)", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {beforePhoto ? (
                  <img src={beforePhoto.startsWith("http") ? beforePhoto : `${getApiBase()}${beforePhoto}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    <Plus size={24} /><p style={{ fontSize: 11, marginTop: 4 }}>{t("add_photo")}</p>
                  </div>
                )}
              </div>
              <input ref={beforeRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadProgressPhoto("before", f); }} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("now_label")}</p>
              <div onClick={() => nowRef.current?.click()}
                style={{ width: "100%", aspectRatio: "3/4", borderRadius: 14, border: "2px dashed var(--border)", background: "var(--bg-surface)", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {nowPhoto ? (
                  <img src={nowPhoto.startsWith("http") ? nowPhoto : `${getApiBase()}${nowPhoto}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    <Plus size={24} /><p style={{ fontSize: 11, marginTop: 4 }}>{t("add_photo")}</p>
                  </div>
                )}
              </div>
              <input ref={nowRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadProgressPhoto("now", f); }} />
            </div>
          </div>
          {photosLoading && <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t("uploading_text")}</p>}
        </div>
      )}

      {/* ═══════════ TAB: ABOUT ═══════════ */}
      {activeTab === "about" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, margin: "0 16px 20px" }}>
          {/* Body stats */}
          {(user?.height || user?.weight || user?.gender) && (
            <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                {lang === "ar" ? "بياناتك الجسدية" : "Body stats"}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {user?.height && <div style={{ flex: 1, padding: "10px", borderRadius: 10, background: "var(--bg-surface)", textAlign: "center" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{user.height} cm</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{t("height_label")}</p>
                </div>}
                {user?.weight && <div style={{ flex: 1, padding: "10px", borderRadius: 10, background: "var(--bg-surface)", textAlign: "center" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{user.weight} kg</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{t("weight_label")}</p>
                </div>}
                {user?.gender && <div style={{ flex: 1, padding: "10px", borderRadius: 10, background: "var(--bg-surface)", textAlign: "center" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{user.gender === "male" ? "♂" : user.gender === "female" ? "♀" : "—"}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{t("gender")}</p>
                </div>}
              </div>
            </div>
          )}

          {/* Edit profile form */}
          {editProfile && (
            <div style={{ padding: 16, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--accent)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t("edit_profile_info")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: t("height_cm"), key: "height", type: "number", placeholder: "175" },
                  { label: t("weight_kg"), key: "weight", type: "number", placeholder: "70" },
                  { label: t("target_weight"), key: "targetWeight", type: "number", placeholder: "65" },
                  { label: t("date_of_birth"), key: "dateOfBirth", type: "date", placeholder: "" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{f.label}</label>
                    <input type={f.type} value={(profileForm as any)[f.key]} onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("gender")}</label>
                  <select value={profileForm.gender} onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}>
                    <option value="">{t("select_prompt")}</option>
                    <option value="male">{t("male")}</option>
                    <option value="female">{t("female")}</option>
                    <option value="other">{t("other_gender")}</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("main_goal")}</label>
                  <select value={profileForm.fitnessGoal} onChange={e => setProfileForm(p => ({ ...p, fitnessGoal: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}>
                    <option value="">{t("select_prompt")}</option>
                    <option value="lose_weight">{t("lose_weight")}</option>
                    <option value="gain_muscle">{t("gain_muscle_opt")}</option>
                    <option value="maintain">{t("maintain_opt")}</option>
                    <option value="improve_fitness">{t("improve_fitness_opt")}</option>
                    <option value="flexibility">{t("flexibility_goal")}</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("activity_level_label")}</label>
                  <select value={profileForm.activityLevel} onChange={e => setProfileForm(p => ({ ...p, activityLevel: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}>
                    <option value="">{t("select_prompt")}</option>
                    <option value="sedentary">{t("sedentary")}</option>
                    <option value="lightly_active">{t("lightly_active")}</option>
                    <option value="moderately_active">{t("moderately_active")}</option>
                    <option value="very_active">{t("very_active")}</option>
                    <option value="extra_active">{t("extra_active")}</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("weekly_goal")}</label>
                  <select value={profileForm.weeklyGoal} onChange={e => setProfileForm(p => ({ ...p, weeklyGoal: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}>
                    <option value="">{t("select_prompt")}</option>
                    <option value="0.25">{t("lose_0_25")}</option>
                    <option value="0.5">{t("lose_0_5")}</option>
                    <option value="0.75">{t("lose_0_75")}</option>
                    <option value="1">{t("lose_1")}</option>
                    <option value="maintain">{t("maintain_weight_opt")}</option>
                    <option value="gain_0.25">{t("gain_0_25")}</option>
                    <option value="gain_0.5">{t("gain_0_5")}</option>
                  </select>
                </div>
                <button onClick={saveProfile} disabled={saving}
                  style={{ width: "100%", padding: "12px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#0A0A0B", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: saving ? 0.6 : 1 }}>
                  <Save size={15} /> {saving ? t("saving_text") : t("save_profile_text")}
                </button>
              </div>
            </div>
          )}

          {/* Onboarding / About data */}
          <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{t("onboarding_data")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                <div key={row.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, margin: 0 }}>{row.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Location picker */}
          {showLocationCard && (
            <div style={{ borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", padding: "14px 16px" }}>
              <UserLocationPicker
                token={token}
                savedLat={(user as any)?.latitude ?? null}
                savedCity={(user as any)?.city ?? null}
              />
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB: SETTINGS ═══════════ */}
      {activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, margin: "0 16px 20px" }}>
          {/* Settings sub-nav */}
          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", overflowX: "auto" }}>
            {([
              { key: "preferences", label: lang === "ar" ? "التفضيلات" : "Preferences", icon: SlidersHorizontal },
              { key: "privacy", label: lang === "ar" ? "الخصوصية" : "Privacy", icon: Shield },
              { key: "security", label: lang === "ar" ? "الأمان" : "Security", icon: Shield },
            ] as { key: SettingsSection; label: string; icon: any }[]).map(s => {
              const Icon = s.icon;
              const active = settingsSection === s.key;
              return (
                <button key={s.key} onClick={() => setSettingsSection(s.key)}
                  style={{
                    flex: 1, minWidth: 80,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "8px 10px", borderRadius: 9,
                    border: "none", cursor: "pointer",
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "#0A0A0B" : "var(--text-secondary)",
                    fontSize: 12, fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}>
                  <Icon size={13} /> {s.label}
                </button>
              );
            })}
          </div>

          {/* Preferences */}
          {settingsSection === "preferences" && (
            <div style={{ borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", overflow: "hidden" }}>
              {[
                { icon: isDark ? Sun : Moon, label: lang === "ar" ? "الوضع الليلي" : "Dark Mode", value: isDark, onToggle: () => toggleTheme() },
                { icon: Globe, label: lang === "ar" ? "اللغة العربية" : "Arabic Language", value: lang === "ar", onToggle: () => setLang(lang === "en" ? "ar" : "en") },
                { icon: Bell, label: lang === "ar" ? "الإشعارات" : "Notifications", value: notificationsEnabled, onToggle: () => setNotificationsEnabled((v) => !v) },
                { icon: Activity, label: lang === "ar" ? "تقليل الحركة" : "Reduced Motion", value: reducedMotion, onToggle: () => setReducedMotion((v) => !v) },
                { icon: Settings, label: lang === "ar" ? "إظهار إعدادات الموقع" : "Show Location Settings", value: showLocationCard, onToggle: () => setShowLocationCard((v) => !v) },
              ].map((item, i, arr) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} onClick={item.onToggle}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", width: "100%", background: "none", border: "none", cursor: "pointer", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", textAlign: "left" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={17} color="var(--text-secondary)" />
                    </div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</span>
                    <div style={{ width: 44, height: 24, borderRadius: 999, background: item.value ? "var(--accent)" : "var(--bg-surface)", border: "1px solid var(--border)", position: "relative", transition: "all 0.2s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: item.value ? "#0A0A0B" : "var(--text-muted)", position: "absolute", top: 2, left: item.value ? 22 : 2, transition: "all 0.2s" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Privacy */}
          {settingsSection === "privacy" && (
            <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{lang === "ar" ? "ما يظهر للآخرين" : "Profile Visibility"}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: lang === "ar" ? "إظهار صور التقدم" : "Show Progress Photos", value: showProgressPhotos, onToggle: () => setShowProgressPhotos((v) => !v) },
                  { label: lang === "ar" ? "إظهار بيانات البداية" : "Show Onboarding Data", value: showOnboardingData, onToggle: () => setShowOnboardingData((v) => !v) },
                  { label: lang === "ar" ? "إظهار منشورات المجتمع" : "Show Community Posts", value: showCommunityPostsCard, onToggle: () => setShowCommunityPostsCard((v) => !v) },
                ].map((s) => (
                  <button key={s.label} onClick={s.onToggle}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", cursor: "pointer" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.label}</span>
                    <div style={{ width: 44, height: 24, borderRadius: 999, background: s.value ? "var(--accent)" : "var(--bg-card)", border: "1px solid var(--border)", position: "relative" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: s.value ? "#0A0A0B" : "var(--text-muted)", position: "absolute", top: 2, left: s.value ? 22 : 2, transition: "all 0.2s" }} />
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                  {lang === "ar" ? "هدف الخطوات اليومي" : "Daily Step Goal"}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" min={100} value={stepGoalDraft} onChange={(e) => setStepGoalDraft(Number(e.target.value || 0))}
                    style={{ flex: 1, padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
                  <button onClick={saveStepGoal} disabled={stepGoalSaving}
                    style={{ padding: "9px 12px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#0A0A0B", fontWeight: 700, cursor: stepGoalSaving ? "not-allowed" : "pointer", opacity: stepGoalSaving ? 0.7 : 1 }}>
                    {stepGoalSaving ? (lang === "ar" ? "جاري الحفظ" : "Saving") : (lang === "ar" ? "حفظ" : "Save")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security */}
          {settingsSection === "security" && (
            <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Shield size={15} /> {t("security_settings")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{t("change_email")}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("new_email_label")}</label>
                      <input type="email" value={emailForm.newEmail} onChange={(e) => setEmailForm((p) => ({ ...p, newEmail: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("current_password")}</label>
                      <input type="password" value={emailForm.currentPassword} onChange={(e) => setEmailForm((p) => ({ ...p, currentPassword: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <button onClick={saveEmailSettings} disabled={emailSaving}
                      style={{ width: "100%", padding: "11px", borderRadius: 10, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontWeight: 700, fontSize: 13, cursor: emailSaving ? "not-allowed" : "pointer", opacity: emailSaving ? 0.65 : 1 }}>
                      {emailSaving ? t("updating_text") : t("update_email")}
                    </button>
                  </div>
                </div>

                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{t("change_password")}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("current_password")}</label>
                      <input type="password" value={securityForm.currentPassword} onChange={(e) => setSecurityForm((p) => ({ ...p, currentPassword: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("new_password")}</label>
                      <input type="password" value={securityForm.newPassword} onChange={(e) => setSecurityForm((p) => ({ ...p, newPassword: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>{t("confirm_new_password")}</label>
                      <input type="password" value={securityForm.confirmPassword} onChange={(e) => setSecurityForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <button onClick={saveSecuritySettings} disabled={securitySaving}
                      style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#0A0A0B", fontWeight: 700, fontSize: 13, cursor: securitySaving ? "not-allowed" : "pointer", opacity: securitySaving ? 0.65 : 1 }}>
                      {securitySaving ? t("updating_text") : t("update_password")}
                    </button>
                  </div>
                </div>

                <button onClick={() => navigate("/auth/forgot-password")}
                  style={{ width: "100%", padding: "11px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {t("forgot_password")}
                </button>
              </div>
            </div>
          )}

          {/* Logout */}
          <button onClick={() => { logout(); navigate("/auth/login"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", cursor: "pointer" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(251,113,133,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={17} color="var(--red)" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--red)" }}>{t("sign_out")}</span>
          </button>
        </div>
      )}


    </div>
  );
}
