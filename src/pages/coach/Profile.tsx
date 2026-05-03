import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect, useRef } from "react";
import { Star, MapPin, Edit3, Save, X, DollarSign, Wallet, CreditCard, ArrowUpCircle, Image as ImageIcon, Play, Upload, FileText, Camera } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getAvatar } from "@/lib/avatar";
import VideoPlayer from "@/components/app/VideoPlayer";

const SPECIALTIES = [
  "Strength & Conditioning", "HIIT & Weight Loss", "Yoga & Mobility",
  "Nutrition & Fitness", "Cardio & Endurance", "CrossFit", "Sports Performance",
  "Rehabilitation", "Bodybuilding", "Running & Marathon",
];

export default function CoachProfile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [editMode, setEditMode] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [profile, setProfile] = useState({
    bio: "", specialty: "", location: "", available: true,
    planTypes: "complete", monthlyPrice: 0, yearlyPrice: 0,
    gender: "" as "" | "male" | "female" | "other",
  });
  const [editProfile, setEditProfile] = useState({ ...profile });

  // Credit & withdrawal state
  const [credit, setCredit] = useState(0);
  const [creditTransactions, setCreditTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [paymentMethodType, setPaymentMethodType] = useState("ewallet");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentPhoneVodafone, setPaymentPhoneVodafone] = useState("");
  const [paymentPhoneOrange, setPaymentPhoneOrange] = useState("");
  const [paymentPhoneWe, setPaymentPhoneWe] = useState("");
  const [walletType, setWalletType] = useState("vodafone");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [instapayHandle, setInstapayHandle] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [subscriptionRequests, setSubscriptionRequests] = useState<any[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  // Media gallery state
  const [mediaTab, setMediaTab] = useState<"posts" | "photos" | "videos">("posts");
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [communityPhotos, setCommunityPhotos] = useState<any[]>([]);
  const [communityVideos, setCommunityVideos] = useState<any[]>([]);
  const [workoutVideos, setWorkoutVideos] = useState<any[]>([]);
  const [playingVideo, setPlayingVideo] = useState<any>(null);

  // Certification state
  const [certStatus, setCertStatus] = useState<{ certified: boolean; certified_until: string | null; fee: number; request: any | null }>({ certified: false, certified_until: null, fee: 500, request: null });
  const [certLoading, setCertLoading] = useState(false);
  const [certMsg, setCertMsg] = useState("");
  const [nationalIdFile, setNationalIdFile] = useState<File | null>(null);
  const [certDocFile, setCertDocFile] = useState<File | null>(null);
  const nationalIdRef = useRef<HTMLInputElement>(null);
  const certDocRef = useRef<HTMLInputElement>(null);

  const api = (path: string, opts?: RequestInit) =>
    fetch(getApiBase() + path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

  useEffect(() => {
    api("/api/coaching/profile").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => {
      if (d.profile) {
        const p = {
          bio: d.profile.bio || "", specialty: d.profile.specialty || "", location: d.profile.location || "",
          available: Boolean(d.profile.available),
          planTypes: d.profile.plan_types || "complete",
          monthlyPrice: Number(d.profile.monthly_price) || 0,
          yearlyPrice: Number(d.profile.yearly_price) || 0,
          gender: ((d.profile.gender || (user as any)?.gender || "") as "" | "male" | "female" | "other"),
        };
        setProfile(p); setEditProfile(p);
      }
    }).catch(() => {});
    if (user?.id) {
      api(`/api/coaching/reviews/${user.id}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => setReviews(d.reviews || [])).catch(() => {});
    }
    // Fetch credit info
    api("/api/payments/my-credit").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => {
      setCredit(Number(d.credit) || 0);
      setCreditTransactions(d.transactions || []);
      if (d.paymentMethodType) setPaymentMethodType(d.paymentMethodType);
      if (d.paymentPhone) setPaymentPhone(d.paymentPhone);
      if (d.paymentPhoneVodafone) setPaymentPhoneVodafone(d.paymentPhoneVodafone);
      if (d.paymentPhoneOrange) setPaymentPhoneOrange(d.paymentPhoneOrange);
      if (d.paymentPhoneWe) setPaymentPhoneWe(d.paymentPhoneWe);
      if (d.walletType) setWalletType(d.walletType);
      if (d.paypalEmail) setPaypalEmail(d.paypalEmail);
      if (d.cardHolderName) setCardHolderName(d.cardHolderName);
      if (d.cardNumber) setCardNumber(d.cardNumber);
      if (d.instapayHandle) setInstapayHandle(d.instapayHandle);
    }).catch(() => {});
    api("/api/payments/my-withdrawals").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => {
      setWithdrawals(d.withdrawals || []);
    }).catch(() => {});

    // Fetch community photos (posts with media by this user)
    api("/api/community/posts").then(r => r.ok ? r.json() : []).then(d => {
      const posts = (Array.isArray(d) ? d : [])
        .filter((p: any) => p.user_id === user?.id)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const isVideo = (url: string) => /\.(mp4|mov|webm|mkv|avi)$/i.test(String(url || ""));
      setCommunityPosts(posts.slice(0, 8));
      setCommunityPhotos(posts.filter((p: any) => p.media_url && !isVideo(p.media_url)).slice(0, 8));
      setCommunityVideos(posts.filter((p: any) => p.media_url && isVideo(p.media_url)).slice(0, 8));
    }).catch(() => {});

    // Fetch workout videos
    api("/api/workouts/videos").then(r => r.ok ? r.json() : { videos: [] }).then(d => {
      setWorkoutVideos(d.videos || []);
    }).catch(() => {});

    // Fetch certification status
    api("/api/coaching/certification").then(r => r.ok ? r.json() : null).then(d => {
      if (d) setCertStatus({ certified: d.certified, certified_until: d.certified_until, fee: d.fee, request: d.request || null });
    }).catch(() => {});

    refreshSubscriptions();
  }, []);
  useAutoRefresh(() => {
    api("/api/coaching/profile").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.profile) {
        const p = { bio: d.profile.bio || "", specialty: d.profile.specialty || "", location: d.profile.location || "", available: Boolean(d.profile.available), planTypes: d.profile.plan_types || "complete", monthlyPrice: Number(d.profile.monthly_price) || 0, yearlyPrice: Number(d.profile.yearly_price) || 0, gender: ((d.profile.gender || (user as any)?.gender || "") as "" | "male" | "female" | "other") };
        setProfile(p); setEditProfile(p);
      }
    }).catch(() => {});
    api("/api/payments/my-credit").then(r => r.ok ? r.json() : null).then(d => { if (d) { setCredit(Number(d.credit) || 0); setCreditTransactions(d.transactions || []); } }).catch(() => {});
    refreshSubscriptions();
  });

  const refreshSubscriptions = async () => {
    setSubsLoading(true);
    try {
      const [reqRes, activeRes] = await Promise.all([
        api("/api/payments/coach-subscription-requests"),
        api("/api/payments/coach-active-subscriptions"),
      ]);
      if (reqRes.ok) {
        const d = await reqRes.json();
        setSubscriptionRequests(d.subscriptions || []);
      }
      if (activeRes.ok) {
        const d = await activeRes.json();
        setActiveSubscriptions(d.subscriptions || []);
      }
    } catch {
      setSubscriptionRequests([]);
      setActiveSubscriptions([]);
    } finally {
      setSubsLoading(false);
    }
  };

  const handleAcceptSubscription = async (id: number) => {
    try {
      const r = await api(`/api/payments/coach-subscriptions/${id}/coach-accept`, { method: "PATCH" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMessage(`✅ ${d.message || "Subscription accepted"}`);
        setTimeout(() => setMessage(""), 3000);
        refreshSubscriptions();
        api("/api/payments/my-credit").then(r2 => r2.ok ? r2.json() : null).then(d2 => {
          if (d2) {
            setCredit(Number(d2.credit) || 0);
            setCreditTransactions(d2.transactions || []);
          }
        }).catch(() => {});
      } else {
        setMessage(`❌ ${d.message || "Failed to accept subscription"}`);
      }
    } catch {
      setMessage("❌ Failed to accept subscription");
    }
  };

  const handleDeclineSubscription = async (id: number) => {
    const reason = prompt("Decline reason (optional):") || "";
    try {
      const r = await api(`/api/payments/coach-subscriptions/${id}/coach-decline`, { method: "PATCH", body: JSON.stringify({ reason }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setMessage(`✅ ${d.message || "Subscription declined"}`);
        setTimeout(() => setMessage(""), 3000);
        refreshSubscriptions();
      } else {
        setMessage(`❌ ${d.message || "Failed to decline subscription"}`);
      }
    } catch {
      setMessage("❌ Failed to decline subscription");
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const r = await api("/api/coaching/profile", { method: "POST", body: JSON.stringify(editProfile) });
        // Also save gender to user profile if changed
        if (editProfile.gender && editProfile.gender !== (user as any)?.gender) {
          await api("/api/user/profile", { method: "PATCH", body: JSON.stringify({ gender: editProfile.gender }) });
        }
      if (r.ok) {
        setProfile({ ...editProfile });
        setMessage(t("profile_updated"));
        setEditMode(false);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch { setMessage(t("failed_save")); }
    finally { setSaving(false); }
  };

  const savePaymentInfo = async () => {
    const onlyDigits = (v: string) => String(v || "").replace(/\s+/g, "");
    const isValidEgyptMobile = (v: string) => /^\d{11}$/.test(v);
    const vodafone = onlyDigits(paymentPhoneVodafone || (walletType === "vodafone" ? paymentPhone : ""));
    const orange = onlyDigits(paymentPhoneOrange || (walletType === "orange" ? paymentPhone : ""));
    const we = onlyDigits(paymentPhoneWe || (walletType === "we" ? paymentPhone : ""));

    if (paymentMethodType === "ewallet") {
      if (vodafone && (!isValidEgyptMobile(vodafone) || !vodafone.startsWith("010"))) {
        setMessage("❌ Vodafone number must be 11 digits and start with 010");
        return;
      }
      if (orange && (!isValidEgyptMobile(orange) || !orange.startsWith("012"))) {
        setMessage("❌ Orange number must be 11 digits and start with 012");
        return;
      }
      if (we && (!isValidEgyptMobile(we) || !we.startsWith("011"))) {
        setMessage("❌ WE number must be 11 digits and start with 011");
        return;
      }
      const selected = walletType === "orange" ? orange : walletType === "we" ? we : vodafone;
      if (!selected) {
        setMessage("❌ Please set the number for the selected wallet type");
        return;
      }
    }

    try {
      const r = await api("/api/payments/payment-info", { method: "POST", body: JSON.stringify({ paymentMethodType, paymentPhone, paymentPhoneVodafone: vodafone, paymentPhoneOrange: orange, paymentPhoneWe: we, walletType, paypalEmail, cardHolderName, cardNumber, instapayHandle }) });
      if (r.ok) { setMessage(t("payment_info_saved")); setTimeout(() => setMessage(""), 3000); }
      else { const d = await r.json(); setMessage(`❌ ${d.message || t("failed_save")}`); }
    } catch { setMessage(t("failed_payment_info")); }
  };

  const requestWithdrawal = async () => {
    setWithdrawMsg("");
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) { setWithdrawMsg(t("enter_valid_amount")); return; }
    if (amt > credit) { setWithdrawMsg(t("insufficient_credit")); return; }
    const selectedWalletPhone = walletType === "orange" ? paymentPhoneOrange : walletType === "we" ? paymentPhoneWe : paymentPhoneVodafone;
    if (paymentMethodType === "ewallet" && !selectedWalletPhone) { setWithdrawMsg(t("set_payment_first")); return; }
    try {
      const r = await api("/api/payments/withdraw", { method: "POST", body: JSON.stringify({ amount: amt }) });
      const d = await r.json();
      if (r.ok) {
        setWithdrawMsg(t("withdrawal_submitted"));
        setCredit(c => c - amt);
        setWithdrawAmount("");
        // Refresh withdrawals
        api("/api/payments/my-withdrawals").then(r2 => r2.json()).then(d2 => setWithdrawals(d2.withdrawals || [])).catch(() => {});
      } else { setWithdrawMsg(d.message || t("failed_withdrawal")); }
    } catch { setWithdrawMsg(t("failed_withdrawal")); }
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";

  const planTypeLabels: Record<string, string> = {
    complete: `${t("workout")} + ${t("nutrition")}`,
    workout: t("workout_only"),
    nutrition: t("nutrition_only"),
  };

  const subscribeToCertification = async () => {
    if (!nationalIdFile || !certDocFile) {
      setCertMsg("❌ Please upload both National ID and Certification document");
      setTimeout(() => setCertMsg(""), 5000);
      return;
    }
    setCertLoading(true);
    setCertMsg("");
    try {
      const formData = new FormData();
      formData.append("nationalId", nationalIdFile);
      formData.append("certificationDoc", certDocFile);
      const r = await fetch(getApiBase() + "/api/coaching/certification/subscribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const d = await r.json();
      if (r.ok) {
        setCertMsg("✅ " + (d.message || "Request submitted!"));
        setNationalIdFile(null);
        setCertDocFile(null);
        // Refresh certification status
        api("/api/coaching/certification").then(r2 => r2.ok ? r2.json() : null).then(d2 => {
          if (d2) setCertStatus({ certified: d2.certified, certified_until: d2.certified_until, fee: d2.fee, request: d2.request || null });
        }).catch(() => {});
        // Refresh credit
        api("/api/payments/my-credit").then(r2 => r2.ok ? r2.json() : null).then(d2 => {
          if (d2) setCredit(Number(d2.credit) || 0);
        }).catch(() => {});
      } else {
        setCertMsg("❌ " + (d.message || "Failed to submit request"));
      }
    } catch { setCertMsg("❌ Failed to submit certification request"); }
    finally { setCertLoading(false); setTimeout(() => setCertMsg(""), 5000); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 700, margin: "0 auto" }}>
      {/* Profile header */}
      <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: isMobile ? "20px 16px" : "28px 28px" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <img src={user?.avatar || getAvatar(user?.email, null, (user as any)?.gender, user?.name)} alt={user?.name} style={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: "var(--bg-surface)", border: "3px solid var(--blue)" }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {user?.name}
              {certStatus.certified && (
                <span title="Certified Coach" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #06b6d4)", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</span>
              )}
            </h1>
            <p style={{ fontSize: 13, color: "var(--blue)", marginTop: 2 }}>{profile.specialty || t("fitness_coach")}</p>
            {profile.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                <MapPin size={12} /> {profile.location}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--amber)", fontWeight: 700 }}>
                <Star size={14} style={{ fill: reviews.length > 0 ? "var(--amber)" : "none" }} /> {avgRating}
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>({reviews.length} {t("reviews").toLowerCase()})</span>
              </div>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--radius-full)", background: profile.available ? "rgba(255,214,0,0.1)" : "var(--bg-surface)", color: profile.available ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${profile.available ? "rgba(255,214,0,0.25)" : "var(--border)"}` }}>
                {profile.available ? `● ${t("available")}` : `○ ${t("unavailable")}`}
              </span>
            </div>
          </div>
          <button onClick={() => { setEditMode(true); setEditProfile({ ...profile }); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: "var(--radius-full)", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <Edit3 size={13} /> {t("edit_profile")}
          </button>
        </div>
      </div>

      {message && <div style={{ padding: "10px 16px", backgroundColor: message.startsWith("✅") ? "var(--accent-dim)" : "rgba(255,68,68,0.08)", border: `1px solid ${message.startsWith("✅") ? "var(--accent)" : "var(--red)"}`, borderRadius: "var(--radius-full)", fontSize: 13, color: message.startsWith("✅") ? "var(--accent)" : "var(--red)" }}>{message}</div>}

      {/* Stats cards */}
      <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 22px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: t("monthly_plan"), value: profile.monthlyPrice > 0 ? `${profile.monthlyPrice} ${t('currency_egp')}` : t("not_set"), color: "var(--blue)" },
            { label: t("yearly_plan"), value: profile.yearlyPrice > 0 ? `${profile.yearlyPrice} ${t('currency_egp')}` : t("not_set"), color: "var(--cyan)" },
            { label: t("plan_type"), value: planTypeLabels[profile.planTypes] || profile.planTypes, color: "var(--amber)" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: 100, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "14px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Certification */}
      <div style={{ backgroundColor: "var(--bg-card)", border: `1px solid ${certStatus.certified ? "rgba(59,130,246,0.3)" : "var(--border)"}`, borderRadius: "var(--radius-full)", padding: "20px 22px", background: certStatus.certified ? "linear-gradient(135deg, rgba(59,130,246,0.04), rgba(6,182,212,0.04))" : "var(--bg-card)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: certStatus.certified ? "linear-gradient(135deg, #3b82f6, #06b6d4)" : "var(--bg-surface)", color: certStatus.certified ? "#fff" : "var(--text-muted)", fontSize: 14, fontWeight: 700, border: certStatus.certified ? "none" : "1px solid var(--border)" }}>✓</span>
            <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 15, fontWeight: 700 }}>{t("certified_coach")}</p>
          </div>
          {certStatus.certified && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--radius-full)", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", fontWeight: 600 }}>
              {t("cert_active_until")} {certStatus.certified_until ? new Date(certStatus.certified_until).toLocaleDateString() : "—"}
            </span>
          )}
          {certStatus.request?.status === "pending" && (
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--radius-full)", background: "rgba(255,179,64,0.12)", color: "var(--amber)", border: "1px solid rgba(255,179,64,0.25)", fontWeight: 600 }}>
              {t("cert_pending_review")}
            </span>
          )}
        </div>

        {/* Show status based on request state */}
        {certStatus.certified ? (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
            {t("cert_verified_desc")}
          </p>
        ) : certStatus.request?.status === "pending" ? (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>
              {t("cert_pending_desc")}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={certStatus.request.national_id_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--radius-full)", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--blue)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                <FileText size={13} /> {t("cert_national_id_link")}
              </a>
              <a href={certStatus.request.certification_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--radius-full)", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--blue)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                <FileText size={13} /> {t("cert_doc_link")}
              </a>
            </div>
          </div>
        ) : certStatus.request?.status === "rejected" ? (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: "var(--red)", lineHeight: 1.6, marginBottom: 6 }}>
              {t("cert_rejected_text")}{certStatus.request.admin_notes ? ` ${certStatus.request.admin_notes}` : ""}
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {t("cert_resubmit_text")}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
            {t("cert_badge_info", { fee: certStatus.fee })}
          </p>
        )}

        {certMsg && <p style={{ fontSize: 12, color: certMsg.startsWith("✅") ? "var(--accent)" : "var(--red)", marginBottom: 10 }}>{certMsg}</p>}

        {/* Upload form — show when not certified and not pending */}
        {!certStatus.certified && certStatus.request?.status !== "pending" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {/* National ID upload */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>{t("cert_national_id_label")}</label>
              <input ref={nationalIdRef} type="file" accept="image/*" capture="environment" onChange={e => setNationalIdFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
              <button onClick={() => nationalIdRef.current?.click()} style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-full)", background: nationalIdFile ? "rgba(59,130,246,0.08)" : "var(--bg-surface)", border: `1px dashed ${nationalIdFile ? "#3b82f6" : "var(--border)"}`, color: nationalIdFile ? "#3b82f6" : "var(--text-muted)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {nationalIdFile ? (<><FileText size={14} /> {nationalIdFile.name}</>) : (<><Camera size={14} /> {t("cert_upload_national_id")}</>)}
              </button>
            </div>
            {/* Certification document upload */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>{t("cert_papers_label")}</label>
              <input ref={certDocRef} type="file" accept="image/*" capture="environment" onChange={e => setCertDocFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
              <button onClick={() => certDocRef.current?.click()} style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-full)", background: certDocFile ? "rgba(59,130,246,0.08)" : "var(--bg-surface)", border: `1px dashed ${certDocFile ? "#3b82f6" : "var(--border)"}`, color: certDocFile ? "#3b82f6" : "var(--text-muted)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {certDocFile ? (<><FileText size={14} /> {certDocFile.name}</>) : (<><Upload size={14} /> {t("cert_upload_papers")}</>)}
              </button>
            </div>
            <button
              onClick={subscribeToCertification}
              disabled={certLoading || !nationalIdFile || !certDocFile}
              style={{ width: "100%", padding: "11px", borderRadius: "var(--radius-full)", background: (!nationalIdFile || !certDocFile) ? "var(--bg-surface)" : "linear-gradient(135deg, #3b82f6, #06b6d4)", border: (!nationalIdFile || !certDocFile) ? "1px solid var(--border)" : "none", color: (!nationalIdFile || !certDocFile) ? "var(--text-muted)" : "#fff", cursor: (certLoading || !nationalIdFile || !certDocFile) ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", opacity: certLoading ? 0.6 : 1 }}
            >
              {certLoading ? t("cert_submitting") : t("cert_submit_review", { fee: certStatus.fee })}
            </button>
          </div>
        )}
      </div>

      {/* Media Gallery */}
      <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 22px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["posts", "photos", "videos"] as const).map(tab => (
            <button key={tab} onClick={() => setMediaTab(tab)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px", borderRadius: "var(--radius-full)", cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: `1px solid ${mediaTab === tab ? "var(--blue)" : "var(--border)"}`,
              background: mediaTab === tab ? "rgba(59,139,255,0.1)" : "var(--bg-surface)",
              color: mediaTab === tab ? "var(--blue)" : "var(--text-muted)",
            }}>
              {tab === "posts"
                ? <><FileText size={14} /> {t("community")} ({communityPosts.length})</>
                : tab === "photos"
                  ? <><ImageIcon size={14} /> {t("photos")} ({communityPhotos.length})</>
                  : <><Play size={14} /> {t("videos")} ({communityVideos.length})</>}
            </button>
          ))}
        </div>

        {mediaTab === "posts" && (
          communityPosts.length === 0 ? (
            <p style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>{t("no_posts_yet")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {communityPosts.map((p: any) => (
                <div key={p.id} style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-surface)", padding: "10px 12px" }}>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 6 }}>{p.content || "Post without text"}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(p.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )
        )}

        {mediaTab === "photos" && (
          communityPhotos.length === 0 ? (
            <p style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>{t("no_photos_yet")}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {communityPhotos.map((p: any) => (
                <div key={p.id} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
                  <img src={p.media_url} alt="" style={{ width: "100%", height: 140, objectFit: "cover" }} />
                  {p.content && (
                    <div style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, backgroundColor: "var(--bg-surface)" }}>
                      {p.content.length > 60 ? p.content.slice(0, 60) + "…" : p.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {mediaTab === "videos" && (
          communityVideos.length === 0 ? (
            <p style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>{t("no_workout_videos")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {communityVideos.map((v: any) => (
                <div key={v.id} onClick={() => setPlayingVideo(v)} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, background: "var(--bg-surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", background: "var(--bg-card)" }}>
                    {v.thumbnail || v.media_url ? <img src={v.thumbnail || v.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={20} color="var(--blue)" /></div>}
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={12} color="#fff" fill="#fff" /></div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{v.title || "Community Video"}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {v.category && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: "rgba(59,139,255,0.1)", color: "var(--blue)", fontWeight: 600 }}>{v.category}</span>}
                      {v.created_at && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(v.created_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Video player modal */}
      {playingVideo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column" }} onClick={() => setPlayingVideo(null)}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "56px 20px 16px" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{playingVideo.title}</p>
            <button onClick={() => setPlayingVideo(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 99, padding: "8px 16px", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>{t("done")}</button>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }} onClick={e => e.stopPropagation()}>
            <VideoPlayer
              url={playingVideo.source_type === "youtube" ? (playingVideo.youtube_url || playingVideo.url || playingVideo.media_url) : (playingVideo.url || playingVideo.media_url)}
              mediaType={playingVideo.source_type === "youtube" ? "youtube" : "video"}
            />
          </div>
        </div>
      )}

      {/* Subscriptions */}
      <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 15, fontWeight: 700 }}>{t("subscriptions")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--radius-full)", background: "rgba(255,179,64,0.12)", color: "var(--amber)", border: "1px solid rgba(255,179,64,0.25)", fontWeight: 600 }}>{t("pending")}: {subscriptionRequests.length}</span>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--radius-full)", background: "rgba(255,214,0,0.12)", color: "var(--accent)", border: "1px solid rgba(255,214,0,0.25)", fontWeight: 600 }}>{t("active_label")}: {activeSubscriptions.length}</span>
          </div>
        </div>

        {subsLoading ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>{t("loading_subscriptions")}</p>
        ) : (
          <>
            {/* Pending requests */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{t("pending_requests")}</p>
              {subscriptionRequests.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("no_pending_subs")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {subscriptionRequests.map((s: any) => (
                    <div key={s.id} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <img src={s.user_avatar || getAvatar(s.user_email, null, null, s.user_name)} alt={s.user_name} style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "var(--bg-card)" }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{s.user_name}</p>
                            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.plan_cycle} · {s.plan_type} · {s.amount} {t('currency_egp')}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleAcceptSubscription(s.id)} style={{ padding: "6px 10px", borderRadius: "var(--radius-full)", border: "1px solid rgba(255,214,0,0.3)", background: "rgba(255,214,0,0.12)", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{t("accept")}</button>
                          <button onClick={() => handleDeclineSubscription(s.id)} style={{ padding: "6px 10px", borderRadius: "var(--radius-full)", border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.1)", color: "var(--red)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{t("decline")}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active subscriptions */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{t("active_subscribers")}</p>
              {activeSubscriptions.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("no_active_subs")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeSubscriptions.map((s: any) => (
                    <div key={s.id} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={s.user_avatar || getAvatar(s.user_email, null, null, s.user_name)} alt={s.user_name} style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "var(--bg-card)" }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{s.user_name}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.plan_cycle} · {s.plan_type}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{t("expires_on")} {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "-"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Credit & Earnings */}
      <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Wallet size={18} color="var(--accent)" />
            <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 15, fontWeight: 700 }}>{t("earnings_credit")}</p>
          </div>
          <button onClick={() => setShowWithdraw(!showWithdraw)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: "var(--radius-full)", background: "var(--accent-dim)", border: "1px solid rgba(255,214,0,0.25)", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <ArrowUpCircle size={13} /> {t("withdraw")}
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120, background: "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(255,214,0,0.02))", border: "1px solid rgba(255,214,0,0.2)", borderRadius: "var(--radius-full)", padding: "18px 16px", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{t("available_credit")}</p>
            <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{credit.toFixed(0)} <span style={{ fontSize: 14 }}>{t('currency_egp')}</span></p>
          </div>
        </div>

        {/* Payment info */}
        <div style={{ backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-full)", padding: "14px 16px", marginBottom: 12, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{t("payment_info")}</p>

          {/* Method type selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {([
              { id: "ewallet", label: `📱 ${t('ewallet_method')}`, color: "#E60000" },
              { id: "paypal", label: `🅿️ ${t('paypal_method')}`, color: "#003087" },
              { id: "credit_card", label: `💳 ${t('card_method')}`, color: "#1A73E8" },
              { id: "instapay", label: `⚡ ${t('instapay_method')}`, color: "#FF6900" },
            ] as const).map(m => (
              <button key={m.id} onClick={() => setPaymentMethodType(m.id)} style={{ flex: 1, minWidth: 70, padding: "8px 6px", borderRadius: "var(--radius-full)", border: `1px solid ${paymentMethodType === m.id ? m.color : "var(--border)"}`, background: paymentMethodType === m.id ? `${m.color}12` : "transparent", color: paymentMethodType === m.id ? m.color : "var(--text-muted)", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.2s" }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* E-Wallet fields */}
          {paymentMethodType === "ewallet" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {(["vodafone", "orange", "we"] as const).map(w => {
                  const colors: Record<string, string> = { vodafone: "#E60000", orange: "#FF6900", we: "#7B2D8E" };
                  const icons: Record<string, string> = { vodafone: "🔴", orange: "🟠", we: "🟣" };
                  return (
                    <button key={w} onClick={() => setWalletType(w)} style={{ flex: 1, padding: "7px 4px", borderRadius: "var(--radius-full)", border: `1px solid ${walletType === w ? colors[w] : "var(--border)"}`, background: walletType === w ? `${colors[w]}14` : "transparent", color: walletType === w ? colors[w] : "var(--text-muted)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                      {icons[w]} {w.charAt(0).toUpperCase() + w.slice(1)}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                <input value={paymentPhoneVodafone} onChange={e => setPaymentPhoneVodafone(e.target.value)} placeholder="Vodafone (010xxxxxxx)" className="input-base" />
                <input value={paymentPhoneOrange} onChange={e => setPaymentPhoneOrange(e.target.value)} placeholder="Orange (012xxxxxxx)" className="input-base" />
                <input value={paymentPhoneWe} onChange={e => setPaymentPhoneWe(e.target.value)} placeholder="WE (011xxxxxxx)" className="input-base" />
              </div>
            </div>
          )}

          {/* PayPal fields */}
          {paymentMethodType === "paypal" && (
            <input value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="your@paypal.com" type="email" className="input-base" />
          )}

          {/* Credit Card fields */}
          {paymentMethodType === "credit_card" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={cardHolderName} onChange={e => setCardHolderName(e.target.value)} placeholder={t("card_holder_name")} className="input-base" />
              <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder={t("card_number")} className="input-base" />
            </div>
          )}

          {/* InstaPay fields */}
          {paymentMethodType === "instapay" && (
            <input value={instapayHandle} onChange={e => setInstapayHandle(e.target.value)} placeholder="InstaPay handle or IPA" className="input-base" />
          )}

          <button onClick={savePaymentInfo} style={{ marginTop: 10, width: "100%", padding: "9px", borderRadius: "var(--radius-full)", background: "var(--blue)", border: "none", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{t("save_payment_info")}</button>
        </div>

        {/* Withdraw form */}
        {showWithdraw && (
          <div style={{ backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-full)", padding: "14px 16px", marginBottom: 12, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{t("request_withdrawal")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder={t("amount_egp")} min="1" className="input-base" style={{ flex: 1 }} />
              <button onClick={requestWithdrawal} style={{ padding: "0 16px", borderRadius: "var(--radius-full)", background: "var(--accent)", border: "none", color: "#000000", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", whiteSpace: "nowrap" }}>{t("submit")}</button>
            </div>
            {withdrawMsg && <p style={{ fontSize: 12, color: withdrawMsg.startsWith("✅") ? "var(--accent)" : "var(--red)", marginTop: 8 }}>{withdrawMsg}</p>}
          </div>
        )}

        {/* Withdrawal history */}
        {withdrawals.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{t("withdrawal_history")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
              {withdrawals.map((w: any) => (
                <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-full)", border: "1px solid var(--border)" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{w.amount} {t('currency_egp')}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: 8 }}>{new Date(w.created_at).toLocaleDateString()}</span>
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 600, background: w.status === 'approved' ? "rgba(255,214,0,0.1)" : w.status === 'rejected' ? "rgba(255,68,68,0.1)" : "rgba(255,179,64,0.1)", color: w.status === 'approved' ? "var(--accent)" : w.status === 'rejected' ? "var(--red)" : "var(--amber)", border: `1px solid ${w.status === 'approved' ? "rgba(255,214,0,0.25)" : w.status === 'rejected' ? "rgba(255,68,68,0.25)" : "rgba(255,179,64,0.25)"}` }}>
                    {String(w.status || "").replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {creditTransactions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{t("recent_transactions")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
              {creditTransactions.slice(0, 10).map((tx: any) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-full)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>
                    {tx.payer_name && String(tx.description || "").toLowerCase().includes("subscription")
                      ? `Subscription from ${tx.payer_name}`
                      : (tx.description || tx.type)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: tx.amount > 0 ? "var(--accent)" : "var(--red)" }}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount} {t('currency_egp')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {profile.bio && (
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 22px" }}>
          <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t("about_me")}</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>{profile.bio}</p>
        </div>
      )}

      {reviews.length > 0 && (
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "20px 22px" }}>
          <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{t("reviews")} ({reviews.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map((rv, i) => (
              <div key={i} style={{ backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-full)", padding: "14px 16px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 2 }}>{[1,2,3,4,5].map(s => <Star key={s} size={13} color="var(--amber)" style={{ fill: s <= rv.rating ? "var(--amber)" : "transparent" }} />)}</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{rv.userName || t("role_user")}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: "auto" }}>{new Date(rv.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{rv.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!profile.bio && reviews.length === 0 && (
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px dashed var(--border)", borderRadius: "var(--radius-full)", padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 15, marginBottom: 8 }}>{t("profile_empty")}</p>
          <p style={{ fontSize: 13, marginBottom: 16 }}>{t("profile_empty_desc")}</p>
          <button onClick={() => { setEditMode(true); setEditProfile({ ...profile }); }} style={{ padding: "10px 24px", borderRadius: "var(--radius-full)", background: "var(--blue)", border: "none", color: "#fff", fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{t("setup_profile")}</button>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: 28, width: "100%", maxWidth: 520, maxHeight: "90dvh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 16, fontWeight: 700 }}>{t("edit_profile")}</p>
              <button onClick={() => setEditMode(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("specialty")}</label>
                <select className="input-base" value={editProfile.specialty} onChange={e => setEditProfile(p => ({ ...p, specialty: e.target.value }))}>
                  <option value="">— Choose specialty —</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("location")}</label>
                <input className="input-base" value={editProfile.location} onChange={e => setEditProfile(p => ({ ...p, location: e.target.value }))} placeholder={t("location_placeholder")} />
              </div>
              {/* Gender */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>Gender</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([["male","👨 Male"],["female","👩 Female"],["other","🧑 Other"]] as const).map(([v, label]) => (
                    <button key={v} type="button"
                      onClick={() => setEditProfile(p => ({ ...p, gender: v }))}
                      style={{
                        flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                        border: `1.5px solid ${editProfile.gender === v ? "var(--blue)" : "var(--border)"}`,
                        background: editProfile.gender === v ? "rgba(96,165,250,0.1)" : "var(--bg-surface)",
                        color: editProfile.gender === v ? "var(--blue)" : "var(--text-secondary)",
                        fontWeight: 600, fontSize: 12,
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {/* Plan Types */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("plan_type_offered")}</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {([
                    { id: "complete", label: `🏆 ${t("complete_plan")}`, desc: `${t("workout")} + ${t("nutrition")}` },
                    { id: "workout", label: `💪 ${t("workout_only")}`, desc: t("workout_only_desc") },
                    { id: "nutrition", label: `🥗 ${t("nutrition_only")}`, desc: t("nutrition_only_desc") },
                  ] as const).map(plan => (
                    <button key={plan.id} type="button" onClick={() => setEditProfile(p => ({ ...p, planTypes: plan.id }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "var(--radius-full)", border: `1px solid ${editProfile.planTypes === plan.id ? "var(--accent)" : "var(--border)"}`, background: editProfile.planTypes === plan.id ? "var(--accent-dim)" : "var(--bg-surface)", cursor: "pointer", textAlign: "start" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: editProfile.planTypes === plan.id ? "var(--accent)" : "var(--text-primary)" }}>{plan.label}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{plan.desc}</p>
                      </div>
                      {editProfile.planTypes === plan.id && <span style={{ color: "var(--accent)" }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscription Pricing */}
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("monthly_subscription_price")}</label>
                <input className="input-base" type="number" value={editProfile.monthlyPrice} onChange={e => setEditProfile(p => ({ ...p, monthlyPrice: Number(e.target.value) }))} min={0} placeholder={t("e_g_300")} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("yearly_subscription_price")}</label>
                <input className="input-base" type="number" value={editProfile.yearlyPrice} onChange={e => setEditProfile(p => ({ ...p, yearlyPrice: Number(e.target.value) }))} min={0} placeholder={t("e_g_3000")} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t('bio_label')}</label>
                <textarea className="input-base" value={editProfile.bio} onChange={e => setEditProfile(p => ({ ...p, bio: e.target.value }))} placeholder={t("bio_placeholder")} rows={4} style={{ resize: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("availability")}</label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={editProfile.available} onChange={e => setEditProfile(p => ({ ...p, available: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("available_for_clients")}</span>
                </label>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditMode(false)} style={{ flex: 1, padding: "11px", borderRadius: "var(--radius-full)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 }}>{t("cancel")}</button>
                <button onClick={saveProfile} disabled={saving} style={{ flex: 2, padding: "11px", borderRadius: "var(--radius-full)", backgroundColor: "var(--blue)", color: "#fff", fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontWeight: 700, fontSize: 14, border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Save size={14} /> {saving ? t("saving") : t("save_profile")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
