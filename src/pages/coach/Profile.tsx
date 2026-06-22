import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect, useRef } from "react";
import {
  Star, MapPin, Edit3, Save, Wallet, ArrowUpCircle,
  Image as ImageIcon, Play, Upload, FileText, Camera, BadgeCheck,
  Smartphone, CreditCard, Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getAvatar } from "@/lib/avatar";
import VideoPlayer from "@/components/app/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const SPECIALTIES = [
  "Strength & Conditioning", "HIIT & Weight Loss", "Yoga & Mobility",
  "Nutrition & Fitness", "Cardio & Endurance", "CrossFit", "Sports Performance",
  "Rehabilitation", "Bodybuilding", "Running & Marathon",
];

export default function CoachProfile() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [editMode, setEditMode] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  // When the coach's specialty isn't one of the presets they can type their own.
  const [customSpecialty, setCustomSpecialty] = useState(false);
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
    apiFetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

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
      const r = await apiFetch("/api/coaching/certification/subscribe", {
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

  const messageOk = message.startsWith("✅");
  const withdrawMsgOk = withdrawMsg.startsWith("✅") || withdrawMsg === t("withdrawal_submitted");
  const certMsgOk = certMsg.startsWith("✅");

  return (
    <div className="mx-auto flex w-full max-w-[700px] flex-col gap-5">
      {/* Profile header */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar className="size-20 shadow-soft-sm ring-2 ring-[var(--secondary)]">
            <AvatarImage src={user?.avatar || getAvatar(user?.email, null, (user as any)?.gender, user?.name)} alt={user?.name || "Coach"} />
            <AvatarFallback>{(user?.name || "C").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-[180px] flex-1">
            <h1 className="flex items-center gap-2 text-[22px] leading-tight font-bold tracking-tight">
              {user?.name}
              {certStatus.certified && (
                <BadgeCheck size={20} strokeWidth={2} className="shrink-0 text-[var(--secondary)]" aria-label={t("certified_coach")} />
              )}
            </h1>
            <p className="mt-0.5 text-[13px] font-semibold text-[var(--secondary)]">{profile.specialty || t("fitness_coach")}</p>
            {profile.location && (
              <p className="mt-1.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                <MapPin size={12} strokeWidth={2} /> {profile.location}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-[13px] font-bold text-[var(--amber)]">
                <Star size={14} strokeWidth={2} style={{ fill: reviews.length > 0 ? "var(--amber)" : "none" }} /> {avgRating}
                <span className="text-[12px] font-normal text-muted-foreground">({reviews.length} {t("reviews").toLowerCase()})</span>
              </span>
              <Badge variant={profile.available ? "default" : "muted"}>
                {profile.available ? `● ${t("available")}` : `○ ${t("unavailable")}`}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setEditMode(true); setEditProfile({ ...profile }); }}>
            <Edit3 size={14} strokeWidth={2} /> {t("edit_profile")}
          </Button>
        </div>
      </Card>

      {message && (
        <div role="status" className={`rounded-md px-4 py-2.5 text-[13px] font-semibold ${messageOk ? "bg-[color-mix(in_srgb,var(--green)_14%,transparent)] text-[var(--green)]" : "bg-destructive/12 text-destructive"}`}>
          {message}
        </div>
      )}

      {/* Stats cards */}
      <Card className="p-5">
        <div className="flex flex-wrap gap-3">
          {[
            { label: t("monthly_plan"), value: profile.monthlyPrice > 0 ? `${profile.monthlyPrice} ${t('currency_egp')}` : t("not_set") },
            { label: t("yearly_plan"), value: profile.yearlyPrice > 0 ? `${profile.yearlyPrice} ${t('currency_egp')}` : t("not_set") },
            { label: t("plan_type"), value: planTypeLabels[profile.planTypes] || profile.planTypes },
          ].map(s => (
            <div key={s.label} className="min-w-[100px] flex-1 rounded-md bg-muted px-4 py-3.5 text-center">
              <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{s.label}</p>
              <p className="text-[16px] font-bold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Certification */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className={`grid size-7 place-items-center rounded-full ${certStatus.certified ? "bg-[var(--secondary)] text-white" : "bg-muted text-muted-foreground"}`}>
              <BadgeCheck size={16} strokeWidth={2} />
            </span>
            <p className="text-[15px] font-semibold">{t("certified_coach")}</p>
          </div>
          {certStatus.certified && (
            <Badge variant="accent">
              {t("cert_active_until")} {certStatus.certified_until ? new Date(certStatus.certified_until).toLocaleDateString() : "—"}
            </Badge>
          )}
          {certStatus.request?.status === "pending" && (
            <Badge variant="warning">{t("cert_pending_review")}</Badge>
          )}
        </div>

        {/* Show status based on request state */}
        {certStatus.certified ? (
          <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
            {t("cert_verified_desc")}
          </p>
        ) : certStatus.request?.status === "pending" ? (
          <div className="mb-3.5">
            <p className="mb-2.5 text-[13px] leading-relaxed text-muted-foreground">
              {t("cert_pending_desc")}
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button asChild variant="secondary" size="sm" className="text-[var(--secondary)]">
                <a href={certStatus.request.national_id_url} target="_blank" rel="noopener noreferrer">
                  <FileText size={13} strokeWidth={2} /> {t("cert_national_id_link")}
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm" className="text-[var(--secondary)]">
                <a href={certStatus.request.certification_url} target="_blank" rel="noopener noreferrer">
                  <FileText size={13} strokeWidth={2} /> {t("cert_doc_link")}
                </a>
              </Button>
            </div>
          </div>
        ) : certStatus.request?.status === "rejected" ? (
          <div className="mb-3.5">
            <p className="mb-1.5 text-[13px] leading-relaxed text-destructive">
              {t("cert_rejected_text")}{certStatus.request.admin_notes ? ` ${certStatus.request.admin_notes}` : ""}
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {t("cert_resubmit_text")}
            </p>
          </div>
        ) : (
          <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
            {t("cert_badge_info", { fee: certStatus.fee })}
          </p>
        )}

        {certMsg && <p className={`mb-2.5 text-[12px] font-semibold ${certMsgOk ? "text-[var(--green)]" : "text-destructive"}`}>{certMsg}</p>}

        {/* Upload form — show when not certified and not pending */}
        {!certStatus.certified && certStatus.request?.status !== "pending" && (
          <div className="flex flex-col gap-2.5">
            {/* National ID upload */}
            <div className="grid gap-1.5">
              <Label htmlFor="cert-national-id" className="text-[12px]">{t("cert_national_id_label")}</Label>
              <input ref={nationalIdRef} id="cert-national-id" type="file" accept="image/*" capture="environment" onChange={e => setNationalIdFile(e.target.files?.[0] || null)} className="hidden" />
              <Button
                type="button"
                variant={nationalIdFile ? "secondary" : "outline"}
                onClick={() => nationalIdRef.current?.click()}
                className={`h-11 w-full ${nationalIdFile ? "text-[var(--secondary)]" : "text-muted-foreground"}`}
              >
                {nationalIdFile ? (<><FileText size={14} strokeWidth={2} /> {nationalIdFile.name}</>) : (<><Camera size={14} strokeWidth={2} /> {t("cert_upload_national_id")}</>)}
              </Button>
            </div>
            {/* Certification document upload */}
            <div className="grid gap-1.5">
              <Label htmlFor="cert-doc" className="text-[12px]">{t("cert_papers_label")}</Label>
              <input ref={certDocRef} id="cert-doc" type="file" accept="image/*,application/pdf" onChange={e => setCertDocFile(e.target.files?.[0] || null)} className="hidden" />
              <Button
                type="button"
                variant={certDocFile ? "secondary" : "outline"}
                onClick={() => certDocRef.current?.click()}
                className={`h-11 w-full ${certDocFile ? "text-[var(--secondary)]" : "text-muted-foreground"}`}
              >
                {certDocFile ? (<><FileText size={14} strokeWidth={2} /> {certDocFile.name}</>) : (<><Upload size={14} strokeWidth={2} /> {t("cert_upload_papers")}</>)}
              </Button>
            </div>
            <Button
              onClick={subscribeToCertification}
              disabled={certLoading || !nationalIdFile || !certDocFile}
              size="lg"
              className="w-full"
            >
              {certLoading ? t("cert_submitting") : t("cert_submit_review", { fee: certStatus.fee })}
            </Button>
          </div>
        )}
      </Card>

      {/* Media Gallery */}
      <Card className="p-5">
        <Tabs value={mediaTab} onValueChange={(v) => setMediaTab(v as "posts" | "photos" | "videos")} className="gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="min-w-0">
              <FileText size={14} strokeWidth={2} /> <span className="truncate">{t("community")} ({communityPosts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="photos" className="min-w-0">
              <ImageIcon size={14} strokeWidth={2} /> <span className="truncate">{t("photos")} ({communityPhotos.length})</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="min-w-0">
              <Play size={14} strokeWidth={2} /> <span className="truncate">{t("videos")} ({communityVideos.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts">
            {communityPosts.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-muted-foreground">{t("no_posts_yet")}</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {communityPosts.map((p: any) => (
                  <div key={p.id} className="rounded-md bg-muted px-3.5 py-3 shadow-soft-xs">
                    <p className="mb-1.5 text-[13px] leading-relaxed text-foreground">{p.content || "Post without text"}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="photos">
            {communityPhotos.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-muted-foreground">{t("no_photos_yet")}</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
                {communityPhotos.map((p: any) => (
                  <div key={p.id} className="overflow-hidden rounded-md bg-muted shadow-soft-xs">
                    <img src={p.media_url} alt={p.content || t("photos")} className="h-[140px] w-full object-cover" />
                    {p.content && (
                      <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                        {p.content.length > 60 ? p.content.slice(0, 60) + "…" : p.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos">
            {communityVideos.length === 0 ? (
              <p className="py-5 text-center text-[13px] text-muted-foreground">{t("no_workout_videos")}</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {communityVideos.map((v: any) => (
                  <button key={v.id} type="button" onClick={() => setPlayingVideo(v)} className="flex items-center gap-3 rounded-md bg-muted p-3 text-start shadow-soft-xs transition active:scale-[0.99]">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-card">
                      {v.thumbnail || v.media_url ? <img src={v.thumbnail || v.media_url} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center"><Play size={20} strokeWidth={2} className="text-[var(--secondary)]" /></div>}
                      <div className="absolute inset-0 grid place-items-center bg-black/20">
                        <div className="grid size-7 place-items-center rounded-full bg-black/60"><Play size={12} strokeWidth={2} className="text-white" fill="#fff" /></div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[14px] leading-tight font-semibold">{v.title || "Community Video"}</p>
                      <div className="flex items-center gap-2">
                        {v.category && <Badge variant="accent" className="text-[11px]">{v.category}</Badge>}
                        {v.created_at && <span className="text-[11px] text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Video player modal */}
      <Dialog open={!!playingVideo} onOpenChange={(o) => !o && setPlayingVideo(null)}>
        <DialogContent showCloseButton={false} className="max-w-[860px] gap-3 bg-black/95 p-0 ring-0">
          <DialogHeader className="flex-row items-center justify-between px-5 pt-5 text-start">
            <DialogTitle className="text-white">{playingVideo?.title}</DialogTitle>
            <Button variant="secondary" size="sm" onClick={() => setPlayingVideo(null)} className="bg-white/15 text-white hover:bg-white/25">{t("done")}</Button>
          </DialogHeader>
          <div className="grid place-items-center px-4 pb-5">
            {playingVideo && (
              <VideoPlayer
                url={playingVideo.source_type === "youtube" ? (playingVideo.youtube_url || playingVideo.url || playingVideo.media_url) : (playingVideo.url || playingVideo.media_url)}
                mediaType={playingVideo.source_type === "youtube" ? "youtube" : "video"}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscriptions */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] font-semibold">{t("subscriptions")}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">{t("pending")}: {subscriptionRequests.length}</Badge>
            <Badge variant="default">{t("active_label")}: {activeSubscriptions.length}</Badge>
          </div>
        </div>

        {subsLoading ? (
          <p className="py-2 text-[13px] text-muted-foreground">{t("loading_subscriptions")}</p>
        ) : (
          <>
            {/* Pending requests */}
            <div className="mb-3.5">
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("pending_requests")}</p>
              {subscriptionRequests.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">{t("no_pending_subs")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {subscriptionRequests.map((s: any) => (
                    <div key={s.id} className="rounded-md bg-muted px-3 py-2.5 shadow-soft-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarImage src={s.user_avatar || getAvatar(s.user_email, null, null, s.user_name)} alt={s.user_name} />
                            <AvatarFallback>{(s.user_name || "U").slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[13px] font-semibold">{s.user_name}</p>
                            <p className="text-[11px] text-muted-foreground">{s.plan_cycle} · {s.plan_type} · {s.amount} {t('currency_egp')}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => handleAcceptSubscription(s.id)}>{t("accept")}</Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeclineSubscription(s.id)}>{t("decline")}</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active subscriptions */}
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("active_subscribers")}</p>
              {activeSubscriptions.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">{t("no_active_subs")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeSubscriptions.map((s: any) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-md bg-muted px-3 py-2.5 shadow-soft-xs">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-[30px]">
                          <AvatarImage src={s.user_avatar || getAvatar(s.user_email, null, null, s.user_name)} alt={s.user_name} />
                          <AvatarFallback>{(s.user_name || "U").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[13px] font-semibold">{s.user_name}</p>
                          <p className="text-[11px] text-muted-foreground">{s.plan_cycle} · {s.plan_type}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-primary">{t("expires_on")} {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "-"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Credit & Earnings */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Wallet size={18} strokeWidth={2} className="text-primary" />
            <p className="text-[15px] font-semibold">{t("earnings_credit")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowWithdraw(!showWithdraw)} className="text-primary">
            <ArrowUpCircle size={13} strokeWidth={2} /> {t("withdraw")}
          </Button>
        </div>

        <div className="mb-4 rounded-md bg-primary/10 px-4 py-4.5 text-center">
          <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{t("available_credit")}</p>
          <p className="text-[28px] font-bold tracking-tight tabular-nums text-primary">{credit.toFixed(0)} <span className="text-[14px]">{t('currency_egp')}</span></p>
        </div>

        {/* Payment info */}
        <div className="mb-3 rounded-md bg-muted p-4">
          <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("payment_info")}</p>

          {/* Method type selector */}
          <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {([
              { id: "ewallet", label: t('ewallet_method'), icon: Smartphone },
              { id: "paypal", label: t('paypal_method'), icon: Wallet },
              { id: "credit_card", label: t('card_method'), icon: CreditCard },
              { id: "instapay", label: t('instapay_method'), icon: Zap },
            ] as const).map(m => {
              const Icon = m.icon;
              const active = paymentMethodType === m.id;
              return (
                <Button key={m.id} type="button" variant={active ? "default" : "outline"} size="sm" onClick={() => setPaymentMethodType(m.id)} className={`min-w-0 justify-center ${active ? "" : "bg-card"}`}>
                  <Icon size={13} strokeWidth={2} /> <span className="truncate">{m.label}</span>
                </Button>
              );
            })}
          </div>

          {/* E-Wallet fields */}
          {paymentMethodType === "ewallet" && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5">
                {(["vodafone", "orange", "we"] as const).map(w => (
                  <Button key={w} type="button" variant={walletType === w ? "default" : "outline"} size="sm" onClick={() => setWalletType(w)} className={`flex-1 ${walletType === w ? "" : "bg-card"}`}>
                    {w.charAt(0).toUpperCase() + w.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pay-vodafone" className="sr-only">Vodafone Cash number</Label>
                <Input id="pay-vodafone" value={paymentPhoneVodafone} onChange={e => setPaymentPhoneVodafone(e.target.value)} placeholder="Vodafone (010xxxxxxx)" inputMode="numeric" className="bg-card" />
                <Label htmlFor="pay-orange" className="sr-only">Orange Cash number</Label>
                <Input id="pay-orange" value={paymentPhoneOrange} onChange={e => setPaymentPhoneOrange(e.target.value)} placeholder="Orange (012xxxxxxx)" inputMode="numeric" className="bg-card" />
                <Label htmlFor="pay-we" className="sr-only">WE Pay number</Label>
                <Input id="pay-we" value={paymentPhoneWe} onChange={e => setPaymentPhoneWe(e.target.value)} placeholder="WE (011xxxxxxx)" inputMode="numeric" className="bg-card" />
              </div>
            </div>
          )}

          {/* PayPal fields */}
          {paymentMethodType === "paypal" && (
            <>
              <Label htmlFor="pay-paypal" className="sr-only">PayPal email</Label>
              <Input id="pay-paypal" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="your@paypal.com" type="email" className="bg-card" />
            </>
          )}

          {/* Credit Card fields */}
          {paymentMethodType === "credit_card" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pay-card-name" className="sr-only">{t("card_holder_name")}</Label>
              <Input id="pay-card-name" value={cardHolderName} onChange={e => setCardHolderName(e.target.value)} placeholder={t("card_holder_name")} className="bg-card" />
              <Label htmlFor="pay-card-number" className="sr-only">{t("card_number")}</Label>
              <Input id="pay-card-number" value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder={t("card_number")} inputMode="numeric" className="bg-card" />
            </div>
          )}

          {/* InstaPay fields */}
          {paymentMethodType === "instapay" && (
            <>
              <Label htmlFor="pay-instapay" className="sr-only">InstaPay handle or IPA</Label>
              <Input id="pay-instapay" value={instapayHandle} onChange={e => setInstapayHandle(e.target.value)} placeholder="InstaPay handle or IPA" className="bg-card" />
            </>
          )}

          <Button onClick={savePaymentInfo} variant="outline" className="mt-2.5 w-full bg-card">{t("save_payment_info")}</Button>
        </div>

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="mb-3 rounded-md bg-muted p-4">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("request_withdrawal")}</p>
            <div className="flex gap-2">
              <Label htmlFor="withdraw-amount" className="sr-only">{t("amount_egp")}</Label>
              <Input id="withdraw-amount" type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder={t("amount_egp")} min="1" className="flex-1 bg-card" />
              <Button onClick={requestWithdrawal} className="shrink-0">{t("submit")}</Button>
            </div>
            {withdrawMsg && <p className={`mt-2 text-[12px] font-semibold ${withdrawMsgOk ? "text-[var(--green)]" : "text-destructive"}`}>{withdrawMsg}</p>}
          </div>
        )}

        {/* Withdrawal history */}
        {withdrawals.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("withdrawal_history")}</p>
            <div className="flex max-h-[200px] flex-col gap-1.5 overflow-y-auto">
              {withdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 shadow-soft-xs">
                  <div>
                    <span className="text-[13px] font-semibold">{w.amount} {t('currency_egp')}</span>
                    <span className="ms-2 text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</span>
                  </div>
                  <Badge variant={w.status === 'approved' ? "default" : w.status === 'rejected' ? "destructive" : "warning"} className="capitalize">
                    {String(w.status || "").replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {creditTransactions.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("recent_transactions")}</p>
            <div className="flex max-h-[200px] flex-col gap-1.5 overflow-y-auto">
              {creditTransactions.slice(0, 10).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 shadow-soft-xs">
                  <span className="flex-1 text-[12px] text-muted-foreground">
                    {tx.payer_name && String(tx.description || "").toLowerCase().includes("subscription")
                      ? `Subscription from ${tx.payer_name}`
                      : (tx.description || tx.type)}
                  </span>
                  <span className={`text-[13px] font-bold ${tx.amount > 0 ? "text-primary" : "text-destructive"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount} {t('currency_egp')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {profile.bio && (
        <Card className="p-5">
          <p className="mb-2.5 text-[14px] font-semibold">{t("about_me")}</p>
          <p className="text-[14px] leading-relaxed text-muted-foreground">{profile.bio}</p>
        </Card>
      )}

      {reviews.length > 0 && (
        <Card className="p-5">
          <p className="mb-3.5 text-[14px] font-semibold">{t("reviews")} ({reviews.length})</p>
          <div className="flex flex-col gap-3">
            {reviews.map((rv, i) => (
              <div key={i} className="rounded-md bg-muted p-4 shadow-soft-xs">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={13} strokeWidth={2} className="text-[var(--amber)]" style={{ fill: s <= rv.rating ? "var(--amber)" : "transparent" }} />)}</div>
                  <span className="text-[13px] font-semibold">{rv.userName || t("role_user")}</span>
                  <span className="ms-auto text-[11px] text-muted-foreground">{new Date(rv.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{rv.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!profile.bio && reviews.length === 0 && (
        <Card className="items-center p-10 text-center ring-1 ring-border">
          <p className="mb-2 text-[15px] font-semibold">{t("profile_empty")}</p>
          <p className="mb-4 text-[13px] text-muted-foreground">{t("profile_empty_desc")}</p>
          <Button onClick={() => { setEditMode(true); setEditProfile({ ...profile }); }}>{t("setup_profile")}</Button>
        </Card>
      )}

      {/* Edit Profile Modal */}
      <Dialog open={editMode} onOpenChange={setEditMode}>
        <DialogContent className="max-h-[90dvh] max-w-[520px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("edit_profile")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-specialty" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("specialty")}</Label>
              {(() => {
                const inList = SPECIALTIES.includes(editProfile.specialty);
                const showCustom = customSpecialty || (!!editProfile.specialty && !inList);
                return (
                  <>
                    <Select
                      value={showCustom ? "__custom__" : (editProfile.specialty || undefined)}
                      onValueChange={(v) => {
                        if (v === "__custom__") { setCustomSpecialty(true); setEditProfile(p => ({ ...p, specialty: "" })); }
                        else { setCustomSpecialty(false); setEditProfile(p => ({ ...p, specialty: v })); }
                      }}
                    >
                      <SelectTrigger id="edit-specialty" className="w-full">
                        <SelectValue placeholder="— Choose specialty —" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        <SelectItem value="__custom__">✏️ Other — write your own…</SelectItem>
                      </SelectContent>
                    </Select>
                    {showCustom && (
                      <Input
                        autoFocus
                        value={editProfile.specialty}
                        onChange={e => setEditProfile(p => ({ ...p, specialty: e.target.value }))}
                        placeholder="Type your specialty (e.g. Calisthenics, Pilates…)"
                        className="mt-2"
                      />
                    )}
                  </>
                );
              })()}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-location" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("location")}</Label>
              <Input id="edit-location" value={editProfile.location} onChange={e => setEditProfile(p => ({ ...p, location: e.target.value }))} placeholder={t("location_placeholder")} />
            </div>
            {/* Gender */}
            <div className="grid gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Gender</span>
              <div className="flex gap-2">
                {([["male","Male"],["female","Female"],["other","Other"]] as const).map(([v, label]) => (
                  <Button
                    key={v}
                    type="button"
                    variant={editProfile.gender === v ? "default" : "outline"}
                    onClick={() => setEditProfile(p => ({ ...p, gender: v }))}
                    className="h-11 flex-1"
                  >{label}</Button>
                ))}
              </div>
            </div>
            {/* Subscription Pricing */}
            <div className="grid gap-2">
              <Label htmlFor="edit-monthly" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("monthly_subscription_price")}</Label>
              <Input id="edit-monthly" type="number" value={editProfile.monthlyPrice} onChange={e => setEditProfile(p => ({ ...p, monthlyPrice: Number(e.target.value) }))} min={0} placeholder={t("e_g_300")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-yearly" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t("yearly_subscription_price")}</Label>
              <Input id="edit-yearly" type="number" value={editProfile.yearlyPrice} onChange={e => setEditProfile(p => ({ ...p, yearlyPrice: Number(e.target.value) }))} min={0} placeholder={t("e_g_3000")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-bio" className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t('bio_label')}</Label>
              <Textarea id="edit-bio" value={editProfile.bio} onChange={e => setEditProfile(p => ({ ...p, bio: e.target.value }))} placeholder={t("bio_placeholder")} rows={4} className="resize-none" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="edit-available" className="text-[13px] font-medium">{t("available_for_clients")}</Label>
              <Switch id="edit-available" checked={editProfile.available} onCheckedChange={(c) => setEditProfile(p => ({ ...p, available: c }))} />
            </div>
            <div className="mt-1 flex gap-2.5">
              <Button variant="outline" onClick={() => setEditMode(false)} className="flex-1">{t("cancel")}</Button>
              <Button onClick={saveProfile} disabled={saving} className="flex-[2]">
                <Save size={14} strokeWidth={2} /> {saving ? t("saving") : t("save_profile")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
