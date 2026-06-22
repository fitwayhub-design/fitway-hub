import { getApiBase, apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import WebsiteCMS from "@/pages/admin/WebsiteCMS";
// 1:1 chat removed. Admin chat lives at /admin/chat as a dedicated page.
import { Users, DollarSign, TrendingUp, Trash2, Shield, UserCheck, Gift, Sun, Moon, Plus, X, Search, Megaphone, CheckCircle, Clock, CreditCard, Play, Edit3, Paperclip, RefreshCw, Pin, EyeOff, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";
import { useLocation, useNavigate } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { getAvatar } from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface AdminUser { id: number; name: string; email: string; role: string; is_premium?: boolean; membership_paid?: boolean; coach_membership_active?: boolean; points: number; steps: number; step_goal?: number; height?: number; weight?: number; gender?: string; medical_history?: string; medical_file_url?: string; created_at: string; avatar: string;
  coach_specialty?: string; coach_bio?: string; coach_location?: string; coach_available?: number | boolean; coach_certified?: number | boolean;
}
interface Gift { id: number; user_id: number; user_name: string; title: string; description: string; type: string; value: number; created_at: string; }
interface CoachAd { id: number; coach_id: number; coach_name: string; coach_email: string; coach_avatar: string; coach_gender?: string | null; title: string; description: string; specialty: string; status: "active" | "pending" | "rejected" | "expired"; cta: string; highlight: string; impressions: number; clicks: number; created_at: string; admin_note?: string; paid_amount: number; paid_minutes: number; payment_status?: string; payment_proof?: string; payment_phone?: string; ad_type?: string; media_type?: string; objective?: string; image_url?: string; video_url?: string; duration_hours?: number; duration_days?: number; boost_start?: string; boost_end?: string; }
interface Payment { id: number; user_id: number; user_name: string; user_email: string; amount: number; plan: string; type: string; card_last4?: string; payment_method?: string; proof_url?: string; status: string; created_at: string; }
interface TrainingVideo {
  id: number;
  title: string;
  description: string;
  url: string;
  duration: string;
  duration_seconds: number;
  category: string;
  is_premium: boolean;
  thumbnail: string;
  created_at: string;
  coach_id?: number | null;
  training_id?: number | null;
  approval_status?: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  submitted_by_name?: string;
}
interface AdPayment { amount: number; duration_minutes: number; payment_status: string; payment_proof?: string; paid_amount: number; paid_minutes: number; }

type Tab = "overview" | "users" | "coaches" | "payments" | "videos" | "ads" | "gifts" | "community" | "website" | "subscriptions" | "withdrawals" | "chat";

/* Role → a token color used for the inline role indicator. */
const roleColor = (role: string) => role === "admin" ? "var(--red)" : role === "coach" ? "var(--cyan)" : role === "moderator" ? "var(--amber)" : "var(--muted-foreground)";

/* Small uppercase label used above stat numerics. */
function StatLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</p>;
}

/* Recent-activity feed presentation helpers. */
const ACTIVITY_ICON: Record<string, string> = {
  signup: "👤", post: "📝", comment: "💬", ticket: "🎫", challenge: "🏆", training: "🏋️", payment: "💳",
};
function timeAgo(d?: string): string {
  if (!d) return "";
  const ts = new Date(d).getTime();
  if (Number.isNaN(ts)) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); if (dd < 30) return `${dd}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function AdminDashboard() {
  const { token, user, updateUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  // Per-admin customization of the upper menu (tab) bar. `visibleTabs === null`
  // means "show all" (default); otherwise it's the explicit set this admin
  // chose to keep. Persisted server-side per account (not localStorage) so the
  // choice follows the admin across devices. "overview" is always shown.
  const TAB_PREF_KEY = "admin_topbar_tabs";
  const [visibleTabs, setVisibleTabs] = useState<string[] | null>(null);
  const [showTabCustomize, setShowTabCustomize] = useState(false);
  useEffect(() => {
    if (!token) return;
    apiFetch(`/api/user/preferences/${TAB_PREF_KEY}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : { value: null }))
      .then(d => setVisibleTabs(Array.isArray(d?.value) ? d.value : null))
      .catch(() => setVisibleTabs(null));
  }, [token]);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const pathToTab = (p: string): Tab => {
    if (p.includes("/subscriptions")) return "subscriptions";
    if (p.includes("/withdrawals")) return "withdrawals";
    if (p.includes("/coaches")) return "coaches";
    if (p.includes("/payments")) return "payments";
    if (p.includes("/videos")) return "videos";
    if (p.includes("/ads")) return "ads";
    if (p.includes("/gifts")) return "gifts";
    if (p.includes("/website")) return "website";
    if (p.includes("/chat")) return "chat";
    if (p.includes("/users")) return "users";
    if (p.includes("/community")) return "community";
    return "overview";
  };
  const [tab, setTab] = useState<Tab>(pathToTab(location.pathname));

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ads, setAds] = useState<CoachAd[]>([]);
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [coaches, setCoaches] = useState<AdminUser[]>([]);
  const [addingCoaches, setAddingCoaches] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ totalUsers: 0, coaches: 0, revenue: 0 });

  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userEditSaving, setUserEditSaving] = useState(false);
  const [medicalUploading, setMedicalUploading] = useState(false);
  const [giftForm, setGiftForm] = useState({ user_id: 0, title: "", description: "", type: "points", value: 100 });
  const [videoForm, setVideoForm] = useState({ title: "", description: "", duration: "", duration_seconds: 0, category: "HIIT", is_premium: false, is_short: false, training_id: "", goal: "", body_area: "", equipment: "", level: "" });
  const [trainings, setTrainings] = useState<Array<{ id: number; title: string }>>([]);
  const [newTrainingTitle, setNewTrainingTitle] = useState("");
  const [userEditForm, setUserEditForm] = useState<any>({
    id: "",
    name: "",
    email: "",
    password: "",
    role: "user",
    avatar: "",
    is_premium: false,
    points: 0,
    steps: 0,
    height: "",
    weight: "",
    gender: "",
    medical_history: "",
    medical_file_url: "",
    membership_paid: false,
    coach_membership_active: false,
    step_goal: 10000,
    // Coach-only fields, mirrored from coach_profiles. Empty for athletes/admins.
    // Subscription pricing isn't here — that's a global setting per package.
    coach_specialty: "",
    coach_bio: "",
    coach_location: "",
    coach_available: false,
    coach_certified: false,
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<string>("");
  const [videoSourceType, setVideoSourceType] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [communityComments, setCommunityComments] = useState<any[]>([]);
  const [communityChallenges, setCommunityChallenges] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [communityStats, setCommunityStats] = useState<any>(null);
  const [communitySubTab, setCommunitySubTab] = useState<"posts" | "challenges" | "comments">("posts");
  const [communitySearch, setCommunitySearch] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementHashtags, setAnnouncementHashtags] = useState("");
  const [announcementPosting, setAnnouncementPosting] = useState(false);

  const [moderatorSearch, setModeratorSearch] = useState("");
  const [coachSubscriptions, setCoachSubscriptions] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);

  const [chatView, setChatView] = useState<"all" | "support">("all");

  useEffect(() => { setTab(pathToTab(location.pathname)); }, [location.pathname]);

  const api = (path: string, opts?: RequestInit & { rawBody?: boolean }) => {
    const hdrs: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (!(opts as any)?.rawBody) hdrs["Content-Type"] = "application/json";
    return apiFetch(path, { ...opts, headers: { ...hdrs, ...(opts?.headers || {}) } });
  };

  const fetchCommunityPosts = async () => {
    try { const r = await api("/api/admin/community/posts"); const d = await r.json(); setCommunityPosts(d.posts || []); } catch {}
  };
  const fetchCommunityAll = async () => {
    try {
      const [rPosts, rStats, rChallenges, rComments] = await Promise.all([
        api("/api/admin/community/posts"),
        api("/api/admin/community/stats"),
        api("/api/admin/community/challenges"),
        api("/api/admin/community/comments"),
      ]);
      setCommunityPosts((await rPosts.json()).posts || []);
      setCommunityStats(await rStats.json());
      setCommunityChallenges((await rChallenges.json()).challenges || []);
      setCommunityComments((await rComments.json()).comments || []);
    } catch {}
  };
  const postAnnouncement = async () => {
    if (!announcementContent.trim()) return;
    setAnnouncementPosting(true);
    try {
      const res = await api("/api/admin/community/announcements", {
        method: "POST",
        body: JSON.stringify({ content: announcementContent.trim(), hashtags: announcementHashtags.trim() || null }),
      });
      if (res.ok) {
        showMsg("📢 Announcement posted!");
        setAnnouncementContent("");
        setAnnouncementHashtags("");
        fetchCommunityPosts();
      } else { showMsg("❌ Failed to post announcement"); }
    } catch { showMsg("❌ Network error"); }
    finally { setAnnouncementPosting(false); }
  };
  const togglePin = async (postId: number) => {
    try {
      const res = await api(`/api/admin/community/posts/${postId}/pin`, { method: "PATCH" });
      if (res.ok) { const d = await res.json(); showMsg(d.is_pinned ? "📌 Post pinned" : "Post unpinned"); fetchCommunityPosts(); }
    } catch { showMsg("❌ Failed to toggle pin"); }
  };


  // `silent` skips the loading state so the periodic auto-refresh updates the
  // data in place without flashing the whole dashboard to a loading screen.
  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [usersRes, videosRes, adsRes, paymentsRes, giftsRes, trainingsRes, activityRes] = await Promise.all([
        api("/api/admin/users"),
        api("/api/admin/videos"),
        api("/api/admin/ads"),
        api("/api/admin/payments"),
        api("/api/admin/gifts"),
        api("/api/admin/trainings"),
        api("/api/admin/recent-activity"),
      ]);
      if (activityRes.ok) { const d = await activityRes.json(); setRecentActivity(d.activities || []); }
      const usersData = await usersRes.json();
      if (usersData.users) {
        setUsers(usersData.users);
        setCoaches(usersData.users.filter((u: AdminUser) => u.role === "coach"));
        const revenue = 0; // calculated from payments below
        setStats({
          totalUsers: usersData.users.filter((u: AdminUser) => u.role === "user").length,
          coaches: usersData.users.filter((u: AdminUser) => u.role === "coach").length,
          revenue: 0,
        });
      }
      if (videosRes.ok) { const d = await videosRes.json(); setVideos(d.videos || []); }
      if (trainingsRes.ok) { const d = await trainingsRes.json(); setTrainings((d.trainings || []).map((t: any) => ({ id: t.id, title: t.title }))); }
      if (adsRes.ok) { const d = await adsRes.json(); setAds(d.ads || []); }
      if (paymentsRes.ok) {
        const d = await paymentsRes.json();
        const p = d.payments || [];
        setPayments(p);
        setStats(s => ({ ...s, revenue: p.filter((x: Payment) => x.status === "completed").reduce((sum: number, x: Payment) => sum + x.amount, 0) }));
      }
      if (giftsRes.ok) { const d = await giftsRes.json(); setGifts(d.gifts || []); }
      // Fetch coach subscriptions & withdrawals
      try {
        const [subsRes, wdRes] = await Promise.all([
          api("/api/payments/coach-subscriptions"),
          api("/api/payments/withdrawals"),
        ]);
        if (subsRes.ok) { const d = await subsRes.json(); setCoachSubscriptions(d.subscriptions || []); }
        if (wdRes.ok) { const d = await wdRes.json(); setWithdrawalRequests(d.withdrawals || []); }
      } catch {}
    } catch (err) { console.error("fetchAll error:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);
  useAutoRefresh(() => fetchAll(true));

  const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(""), 3000); };

  const updateUserRole = async (userId: number, role: string) => {
    await api(`/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    setUsers(u => u.map(x => x.id === userId ? { ...x, role } : x));
    setCoaches(users.filter(u => u.role === "coach" || (u.id === userId && role === "coach")));
    showMsg(`✅ Role updated to ${role}`);
  };

  const addCoachProfiles = async () => {
    setAddingCoaches(true);
    try {
      const res = await api("/api/admin/generate-coach-profiles", { method: "POST", body: JSON.stringify({ count: 5 }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMsg(`❌ ${data?.message || "Failed to add coaches"}`);
        return;
      }
      await fetchAll();
      showMsg(`✅ ${data?.message || "5 coaches added"}`);
    } catch {
      showMsg("❌ Failed to add coaches");
    } finally {
      setAddingCoaches(false);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      const res = await api(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showMsg(`❌ ${data?.message || "Failed to delete user"}`);
        return;
      }
      setUsers(u => u.filter(x => x.id !== userId));
      showMsg("🗑️ User deleted");
    } catch {
      showMsg("❌ Failed to delete user");
    }
  };

  const sendGift = async () => {
    if (!giftForm.user_id || !giftForm.title) return;
    try {
      const res = await api("/api/admin/gifts", { method: "POST", body: JSON.stringify(giftForm) });
      if (res.ok) {
        setShowGiftModal(false);
        setGiftForm({ user_id: 0, title: "", description: "", type: "points", value: 100 });
        showMsg("🎁 Gift sent!");
        fetchAll();
      }
    } catch { showMsg("❌ Failed to send gift"); }
  };

  const openEditUser = (u: AdminUser) => {
    setEditingUserId(u.id);
    setUserEditForm({
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      password: "",
      role: u.role || "user",
      avatar: u.avatar || "",
      is_premium: !!u.is_premium,
      points: Number(u.points || 0),
      steps: Number(u.steps || 0),
      height: u.height ?? "",
      weight: u.weight ?? "",
      gender: u.gender || "",
      medical_history: (u as any).medical_history || "",
      medical_file_url: (u as any).medical_file_url || "",
      membership_paid: !!(u as any).membership_paid,
      coach_membership_active: !!(u as any).coach_membership_active,
      step_goal: Number((u as any).step_goal || 10000),
      coach_specialty: (u as any).coach_specialty || "",
      coach_bio: (u as any).coach_bio || "",
      coach_location: (u as any).coach_location || "",
      coach_available: !!(u as any).coach_available,
      coach_certified: !!(u as any).coach_certified,
    });
    setShowUserEditModal(true);
  };

  const saveUserEdit = async () => {
    if (!editingUserId) return;
    setUserEditSaving(true);
    try {
      const isCoach = userEditForm.role === "coach";
      const payload: any = {
        ...userEditForm,
        id: Number(userEditForm.id),
        // Athlete-only numerics — only coerce when actually editing a non-coach
        // account; for coaches they aren't shown so we leave their DB values alone.
        points: isCoach ? undefined : Number(userEditForm.points || 0),
        steps: isCoach ? undefined : Number(userEditForm.steps || 0),
        step_goal: isCoach ? undefined : Number(userEditForm.step_goal || 10000),
        height: isCoach ? undefined : (userEditForm.height === "" ? null : Number(userEditForm.height)),
        weight: isCoach ? undefined : (userEditForm.weight === "" ? null : Number(userEditForm.weight)),
        medical_history: isCoach ? undefined : userEditForm.medical_history,
        medical_file_url: isCoach ? undefined : userEditForm.medical_file_url,
        membership_paid: isCoach ? undefined : userEditForm.membership_paid,
      };
      const res = await api(`/api/admin/users/${editingUserId}`, { method: "PUT", body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMsg(`❌ ${data?.message || "Failed to update user"}`);
        return;
      }
      showMsg("✅ User updated");
      setShowUserEditModal(false);
      setEditingUserId(null);
      await fetchAll();
    } catch {
      showMsg("❌ Failed to update user");
    } finally {
      setUserEditSaving(false);
    }
  };

  const uploadMedicalForUser = async (file: File) => {
    if (!editingUserId || !file) return;
    setMedicalUploading(true);
    try {
      const fd = new FormData();
      fd.append("medical", file);
      const res = await apiFetch(`/api/admin/users/${editingUserId}/upload-medical`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.file_url) {
        showMsg(`❌ ${d?.message || "Upload failed"}`);
        return;
      }
      setUserEditForm((f: any) => ({ ...f, medical_file_url: d.file_url }));
      showMsg("✅ Medical file uploaded");
    } catch {
      showMsg("❌ Failed to upload medical file");
    } finally {
      setMedicalUploading(false);
    }
  };

  const addVideo = async () => {
    if (!videoForm.title) { showMsg("❌ Title is required"); return; }
    if (!videoFile) { showMsg("❌ Video file is required"); return; }
    try {
      setVideoUploadProgress("Uploading...");
      const formData = new FormData();
      formData.append("title", videoForm.title);
      formData.append("description", videoForm.description);
      formData.append("duration", videoForm.duration);
      formData.append("duration_seconds", String(videoForm.duration_seconds || 0));
      formData.append("category", videoForm.category);
      formData.append("is_premium", videoForm.is_premium ? "1" : "0");
      formData.append("is_short", videoForm.is_short ? "1" : "0");
      if (videoForm.training_id) formData.append("training_id", videoForm.training_id);
      if (videoForm.goal) formData.append("goal", videoForm.goal);
      if (videoForm.body_area) formData.append("body_area", videoForm.body_area);
      if (videoForm.equipment) formData.append("equipment", videoForm.equipment);
      if (videoForm.level) formData.append("level", videoForm.level);
      formData.append("video", videoFile);
      if (thumbnailFile) formData.append("thumbnail", thumbnailFile);
      const res = await apiFetch("/api/admin/videos", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.video) {
        setVideos(v => [data.video, ...v]);
        setShowVideoModal(false);
        setVideoForm({ title: "", description: "", duration: "", duration_seconds: 0, category: "HIIT", is_premium: false, is_short: false, training_id: "", goal: "", body_area: "", equipment: "", level: "" });
        setVideoFile(null); setThumbnailFile(null);
        showMsg("🎬 Video uploaded!");
      } else { showMsg("❌ " + (data.message || "Failed to upload video")); }
    } catch { showMsg("❌ Failed to add video"); }
    finally { setVideoUploadProgress(""); }
  };

  // Read the file's duration from a hidden <video> so the admin doesn't have
  // to type it. mm:ss label is stored alongside the seconds count.
  const handleVideoFilePicked = (file: File | null) => {
    setVideoFile(file);
    if (!file) {
      setVideoForm(f => ({ ...f, duration: "", duration_seconds: 0 }));
      return;
    }
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const secs = Math.max(0, Math.floor(probe.duration || 0));
      const label = secs > 0 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "";
      setVideoForm(f => ({ ...f, duration: label, duration_seconds: secs }));
      URL.revokeObjectURL(url);
    };
    probe.onerror = () => URL.revokeObjectURL(url);
    probe.src = url;
  };

  const createInlineTraining = async () => {
    const title = newTrainingTitle.trim();
    if (!title) return;
    try {
      const res = await api("/api/admin/trainings", { method: "POST", body: JSON.stringify({ title }) });
      const data = await res.json();
      if (res.ok && data.training) {
        setTrainings(ts => [...ts, { id: data.training.id, title: data.training.title }]);
        setVideoForm(f => ({ ...f, training_id: String(data.training.id) }));
        setNewTrainingTitle("");
        showMsg("✅ Training created");
      } else { showMsg("❌ " + (data.message || "Failed to create training")); }
    } catch { showMsg("❌ Failed to create training"); }
  };

  const deleteVideo = async (videoId: number) => {
    if (!confirm("Delete this video?")) return;
    await api(`/api/admin/videos/${videoId}`, { method: "DELETE" });
    setVideos(v => v.filter(x => x.id !== videoId));
    showMsg("🗑️ Video deleted");
  };

  const assignVideoCoach = async (videoId: number, coachId: string) => {
    try {
      await api(`/api/admin/videos/${videoId}`, { method: "PATCH", body: JSON.stringify({ coach_id: coachId ? Number(coachId) : null }) });
      setVideos(vs => vs.map(v => v.id === videoId ? { ...v, coach_id: coachId ? Number(coachId) : null } : v));
      showMsg("✅ Coach linked to video");
    } catch {
      showMsg("❌ Failed to update coach link");
    }
  };

  const reviewVideo = async (videoId: number, status: "approved" | "rejected") => {
    try {
      let reason = "";
      if (status === "rejected") {
        reason = prompt("Rejection reason (optional):") || "";
      }
      const res = await api(`/api/admin/videos/${videoId}/approval`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showMsg(`❌ ${data?.message || "Failed to review video"}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.video) {
        setVideos((vs) => vs.map((v) => (v.id === videoId ? { ...v, ...data.video } : v)));
      }
      showMsg(status === "approved" ? "✅ Video approved" : "✗ Video rejected");
    } catch {
      showMsg("❌ Failed to review video");
    }
  };

  const updateAdStatus = async (id: number, status: CoachAd["status"]) => {
    try {
      const res = await api(`/api/admin/ads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (res.ok) {
        setAds(a => a.map(x => x.id === id ? { ...x, status } : x));
        showMsg(`✅ Ad ${status}`);
      }
    } catch { showMsg("❌ Failed to update ad"); }
  };

  const deleteAd = async (id: number) => {
    await api(`/api/admin/ads/${id}`, { method: "DELETE" });
    setAds(a => a.filter(x => x.id !== id));
    showMsg("🗑️ Ad removed");
  };

  const filtered = users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
  // Catalog of upper-menu items. "Coaches" was dropped (coach management lives
  // under Users + Coach Requests now). "Chat" navigates to the dedicated
  // /admin/chat page (same as the sidebar) instead of an outdated inline tab.
  const tabDef: { id: Tab; label: string }[] = [
    { id: "overview", label: t("overview") }, { id: "users", label: t("users") },
    { id: "payments", label: t("payments") }, { id: "subscriptions", label: `📋 ${t("subscriptions")}` }, { id: "withdrawals", label: `💸 ${t("withdrawals")}` },
    { id: "videos", label: t("videos") }, { id: "ads", label: t("coach_ads") },
    { id: "chat", label: t("chat") },
    { id: "gifts", label: t("gifts") }, { id: "community", label: `🛡 ${t("community")}` },
    { id: "website", label: `🌐 ${t("website_config")}` },
  ];
  const ROUTE_TABS: Partial<Record<Tab, string>> = { chat: "/admin/chat" };
  const isTabVisible = (id: Tab) => id === "overview" || !visibleTabs || visibleTabs.includes(id);
  const shownTabs = tabDef.filter(td => isTabVisible(td.id));
  const persistVisibleTabs = (next: string[]) => {
    setVisibleTabs(next);
    apiFetch(`/api/user/preferences/${TAB_PREF_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: next }),
    }).catch(() => { /* best-effort; UI already updated */ });
  };
  const toggleTabVisible = (id: Tab) => {
    if (id === "overview") return; // always visible
    const base = visibleTabs ?? tabDef.map(t => t.id as string);
    persistVisibleTabs(base.includes(id) ? base.filter(x => x !== id) : [...base, id]);
  };
  const onTabClick = (id: Tab) => {
    const route = ROUTE_TABS[id];
    if (route) { navigate(route); return; }
    setTab(id);
  };

  /* Status → Badge variant, used by payment / subscription / withdrawal rows. */
  const payStatusVariant = (status: string): "success" | "warning" | "destructive" =>
    status === "completed" || status === "active" || status === "approved" ? "success"
      : status === "pending" || status.includes("pending") ? "warning"
      : "destructive";

  return (
    <div className="space-y-6">
      {/* ═══════ HEADER ═══════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin_dashboard")}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t("manage_platform")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} className="bg-card text-muted-foreground shadow-soft-sm">
            {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          </Button>
          <Badge variant="destructive" className="h-8 gap-1.5 px-3 text-[12px]">
            <Shield size={12} strokeWidth={2} /> {t("admin")}
          </Badge>
        </div>
      </div>

      {/* ═══════ TAB BAR (upper menu) ═══════════════ */}
      <div className="flex items-center gap-2">
        <div className="scroll-x -mx-1 min-w-0 flex-1 overflow-x-auto px-1 pb-1">
          <div className="flex w-max min-w-full gap-1 rounded-md bg-muted p-1">
            {shownTabs.map(td => {
              const active = tab === td.id && !ROUTE_TABS[td.id];
              const pendingAds = td.id === "ads" ? ads.filter(a => a.status === "pending").length : 0;
              return (
                <button
                  key={td.id}
                  onClick={() => onTabClick(td.id)}
                  aria-pressed={active}
                  className={`whitespace-nowrap rounded-[8px] px-3.5 py-2 text-[13px] font-semibold transition-all ${active ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {td.label}{pendingAds > 0 ? ` (${pendingAds})` : ""}
                </button>
              );
            })}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          onClick={() => setShowTabCustomize(true)}
          aria-label={t("customize_menu") || "Customize menu"}
          title={t("customize_menu") || "Customize menu"}
        >
          <SlidersHorizontal size={15} strokeWidth={2} />
        </Button>
      </div>

      {/* Upper-menu customize dialog (per-admin) */}
      <Dialog open={showTabCustomize} onOpenChange={setShowTabCustomize}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t("customize_menu") || "Customize menu bar"}</DialogTitle>
          </DialogHeader>
          <p className="-mt-1 text-[13px] text-muted-foreground">
            {t("customize_menu_hint") || "Choose which items show in your upper menu bar. This is saved just for you."}
          </p>
          <div className="mt-1 flex flex-col divide-y divide-border/60">
            {tabDef.map(td => {
              const mandatory = td.id === "overview";
              return (
                <div key={td.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[13px] font-medium text-foreground">{td.label}</span>
                  <Switch
                    checked={isTabVisible(td.id)}
                    disabled={mandatory}
                    onCheckedChange={() => toggleTabVisible(td.id)}
                    aria-label={`Toggle ${td.label}`}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { persistVisibleTabs(tabDef.map(t => t.id as string)); }}>
              {t("show_all") || "Show all"}
            </Button>
            <Button onClick={() => setShowTabCustomize(false)}>{t("done") || "Done"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {message && (
        <div className="rounded-md bg-primary/15 px-4 py-2.5 text-[13px] font-medium text-primary">{message}</div>
      )}

      {/* ═══════ OVERVIEW ═══════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { title: t("total_users"), value: stats.totalUsers, icon: Users, color: "var(--blue)" },
              { title: t("coaches"), value: stats.coaches, icon: UserCheck, color: "var(--cyan)" },
              { title: t("total_revenue"), value: `${stats.revenue.toFixed(0)} EGP`, icon: DollarSign, color: "var(--amber)" },
            ].map(s => (
              <Card key={s.title} className="gap-0 p-5">
                <div className="mb-2 flex items-center justify-between">
                  <StatLabel>{s.title}</StatLabel>
                  <s.icon size={18} strokeWidth={2} style={{ color: s.color }} />
                </div>
                <p className="text-[28px] font-bold leading-none tabular-nums tracking-tight">{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Charts — revenue trend + user growth */}
          {(() => {
            const months = Array.from({ length: 6 }, (_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - (5 - i));
              return {
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                name: d.toLocaleString("en", { month: "short" }),
              };
            });
            const revenueData = months.map(m => ({
              name: m.name,
              revenue: payments
                .filter(p => p.status === "completed" && p.created_at?.startsWith(m.key))
                .reduce((s, p) => s + p.amount, 0),
            }));
            const userData = months.map(m => ({
              name: m.name,
              users: users.filter(u => u.role === "user" && u.created_at?.startsWith(m.key)).length,
            }));
            return (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="gap-0 p-5">
                  <p className="mb-4 text-[15px] font-semibold">{t("revenue_trend") || "Revenue trend (6 mo)"}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={revenueData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: any) => [`${v} EGP`, "Revenue"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="revenue" fill="var(--amber)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card className="gap-0 p-5">
                  <p className="mb-4 text-[15px] font-semibold">{t("user_growth") || "User growth (6 mo)"}</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={userData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: any) => [v, "New users"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="users" stroke="var(--blue)" fill="rgba(59,130,246,0.12)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            );
          })()}

          {/* Recent activity — every notable event across the app */}
          <Card className="gap-0 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold">{t("recent_activity") || "Recent activity"}</p>
              <Button variant="ghost" size="icon-sm" onClick={() => fetchAll(true)} aria-label="Refresh activity" className="text-muted-foreground">
                <RefreshCw size={15} strokeWidth={2} />
              </Button>
            </div>
            {recentActivity.length === 0 ? (
              <p className="py-4 text-[13px] text-muted-foreground">{t("no_activity_yet") || "No recent activity yet."}</p>
            ) : (
              <div className="-my-1 flex max-h-[440px] flex-col divide-y divide-border/60 overflow-y-auto">
                {recentActivity.map((a: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[15px]" aria-hidden>{ACTIVITY_ICON[a.type] || "•"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground">{a.title}</p>
                      {a.detail && <p className="truncate text-[12px] text-muted-foreground">{a.detail}</p>}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="gap-0 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[15px] font-semibold">{t("recent_users")}</p>
                <TrendingUp size={18} strokeWidth={2} className="text-muted-foreground" />
              </div>
              {users.length === 0 ? <p className="text-[13px] text-muted-foreground">{t("no_users_yet")}</p> : (
                <div className="flex flex-col">
                  {users.slice(0, 5).map((u, i, arr) => (
                    <div key={u.id}>
                      <div className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarImage src={u.avatar || getAvatar(u.email, null, u.gender, u.name)} alt={u.name} />
                            <AvatarFallback>{(u.name || "U").slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold">{u.name}</p>
                            <p className="text-[11px] capitalize" style={{ color: roleColor(u.role) }}>{u.role}</p>
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{u.role}</span>
                      </div>
                      {i < arr.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card className="gap-0 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[15px] font-semibold">{t("recent_payments")}</p>
                <CreditCard size={18} strokeWidth={2} className="text-primary" />
              </div>
              {payments.length === 0 ? <p className="text-[13px] text-muted-foreground">{t("no_payments_yet")}</p> : (
                <div className="flex flex-col">
                  {payments.slice(0, 5).map((p, i, arr) => (
                    <div key={p.id}>
                      <div className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold">{p.user_name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.plan} · ****{p.card_last4}</p>
                        </div>
                        <p className="text-[14px] font-bold tabular-nums text-primary">{p.amount.toFixed(0)} EGP</p>
                      </div>
                      {i < arr.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ USERS ═══════════════════════════ */}
      {tab === "users" && (
        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-center gap-3 p-5">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} strokeWidth={2} className="pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search_users")} className="ps-10" />
            </div>
            <span className="text-[12px] text-muted-foreground">
              {t("users_admins_count", { users: users.filter(u => u.role === "user").length, admins: users.filter(u => u.role === "admin").length })}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-start">
              <thead>
                <tr className="bg-muted">
                  {[t("table_user"), t("role_label"), t("coach_member"), t("points"), t("steps"), t("actions")].map(h => (
                    <th key={h} className="px-4 py-2.5 text-start text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={u.avatar || getAvatar(u.email, null, u.gender, u.name)} alt={u.name} />
                          <AvatarFallback>{(u.name || "U").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={u.role} onValueChange={v => updateUserRole(u.id, v)}>
                        <SelectTrigger size="sm" className="w-[130px]" style={{ color: roleColor(u.role) }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{t("role_user")}</SelectItem>
                          <SelectItem value="coach">{t("role_coach")}</SelectItem>
                          <SelectItem value="moderator">{t("role_moderator")}</SelectItem>
                          <SelectItem value="admin">{t("role_admin")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "coach" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => { const paid = !(u as any).membership_paid; await api(`/api/admin/users/${u.id}/coach-membership`, { method: "PATCH", body: JSON.stringify({ membership_paid: paid }) }); fetchAll(); showMsg(paid ? t("coach_membership_activated") : t("coach_membership_revoked")); }}
                          className="h-7 px-2.5"
                          style={{ color: (u as any).membership_paid ? "var(--cyan)" : "var(--red)" }}
                        >
                          {(u as any).membership_paid ? `✓ ${t("active")}` : `✗ ${t("inactive")}`}
                        </Button>
                      ) : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums">{u.points?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums">{u.steps?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditUser(u)} aria-label={t("edit_user")} title={t("edit_user")} className="bg-[var(--secondary-dim)] text-[var(--secondary)]">
                          <Edit3 size={16} strokeWidth={2} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => { setGiftForm(f => ({ ...f, user_id: u.id })); setShowGiftModal(true); setTab("gifts"); }} aria-label="Send gift" className="bg-[color-mix(in_srgb,var(--amber)_16%,transparent)] text-[var(--amber)]">
                          <Gift size={16} strokeWidth={2} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteUser(u.id)} aria-label="Delete user" className="bg-destructive/12 text-destructive">
                          <Trash2 size={16} strokeWidth={2} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ═══════ COACHES ═══════════════════════════ */}
      {tab === "coaches" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xl font-semibold tracking-tight">{t("manage_coaches")}</p>
            {/* Fake-coach generator moved to admin Settings (May meeting) so all
                testing helpers live in one place. */}
          </div>
          <p className="text-[13px] text-muted-foreground">
            Need fake demo coaches? Generate them from <a href="/admin/settings" className="font-semibold text-primary hover:underline">Settings → System</a>.
          </p>
          {coaches.length === 0 ? (
            <Card className="items-center p-10 text-center text-[14px] text-muted-foreground">
              {t("no_coaches_yet_hint")}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {coaches.map(c => (
                <Card key={c.id} className="gap-0 p-5">
                  <div className="mb-4 flex gap-3.5">
                    <Avatar className="size-13 size-[52px]">
                      <AvatarImage src={c.avatar || getAvatar(c.email, null, c.gender, c.name)} alt={c.name} />
                      <AvatarFallback>{(c.name || "C").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-semibold">{c.name}</h3>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--cyan)]">{c.email}</p>
                      <p className="mt-1 text-[11px] text-primary">⚡ {c.points?.toLocaleString()} {t("points_short")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const paid = !(c as any).membership_paid;
                        await api(`/api/admin/users/${c.id}/coach-membership`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ membership_paid: paid }) });
                        fetchAll();
                        showMsg(paid ? t("coach_membership_activated") : t("coach_membership_deactivated"));
                      }}
                      className="flex-1"
                      style={{ color: (c as any).membership_paid ? "var(--cyan)" : "var(--red)" }}
                    >
                      {(c as any).membership_paid ? `✓ ${t("active")}` : `✗ ${t("inactive")}`}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => updateUserRole(c.id, "user")} className="text-destructive">
                      {t("demote")}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ PAYMENTS ═══════════════════════════ */}
      {tab === "payments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t("total_revenue"), value: `${payments.filter(p => p.status === "completed").reduce((s, p) => s + p.amount, 0).toFixed(0)} EGP`, color: "var(--primary)" },
              { label: t("transactions"), value: payments.length, color: "var(--cyan)" },
              { label: t("table_type"), value: payments.filter(p => p.type === "premium").length, color: "var(--amber)" },
              { label: t("coach_members"), value: payments.filter(p => p.type === "coach_membership").length, color: "var(--blue)" },
            ].map(s => (
              <Card key={s.label} className="gap-0 p-5">
                <StatLabel>{s.label}</StatLabel>
                <p className="mt-1.5 text-[26px] font-bold leading-none tabular-nums tracking-tight" style={{ color: s.color }}>{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Pending e-wallet approvals */}
          {payments.filter(p => p.status === "pending" && p.payment_method === "ewallet").length > 0 && (
            <Card className="gap-0 overflow-hidden p-0 ring-1 ring-[color-mix(in_srgb,var(--amber)_35%,transparent)]">
              <div className="flex items-center gap-2.5 bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] px-5 py-3.5">
                <p className="text-[14px] font-bold text-[var(--amber)]">⏳ Pending E-Wallet Approvals</p>
                <Badge variant="warning">{payments.filter(p => p.status === "pending" && p.payment_method === "ewallet").length}</Badge>
              </div>
              <div className="flex flex-col">
                {payments.filter(p => p.status === "pending" && p.payment_method === "ewallet").map((p, i, arr) => (
                  <div key={p.id}>
                    <div className="flex flex-wrap items-center gap-3.5 px-5 py-4">
                      <div className="min-w-[200px] flex-1">
                        <p className="text-[13px] font-semibold">{p.user_name}</p>
                        <p className="text-[12px] text-muted-foreground">{p.user_email}</p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {p.type === "premium" ? "User Plan" : t("coach_membership")} · {p.plan} · <strong className="text-primary">{p.amount?.toFixed(0)} EGP</strong>
                        </p>
                        {p.proof_url && (
                          <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 rounded-sm bg-[var(--secondary-dim)] px-2 py-1 text-[11px] text-[var(--secondary)]">
                            <Paperclip size={12} strokeWidth={2} /> View Payment Proof
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              const r = await api(`/api/payments/approve/${p.id}`, { method: "PATCH" });
                              if (r.ok) {
                                setPayments(prev => prev.map(x => x.id === p.id ? { ...x, status: "completed" } : x));
                              }
                            } catch {}
                          }}
                        >
                          ✓ Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            try {
                              const r = await api(`/api/payments/reject/${p.id}`, { method: "PATCH" });
                              if (r.ok) {
                                setPayments(prev => prev.map(x => x.id === p.id ? { ...x, status: "rejected" } : x));
                              }
                            } catch {}
                          }}
                        >
                          ✗ Reject
                        </Button>
                      </div>
                    </div>
                    {i < arr.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="gap-0 overflow-hidden p-0">
            <div className="px-5 py-3.5">
              <p className="text-[15px] font-semibold">{t("payment_transactions")}</p>
            </div>
            {payments.length === 0 ? (
              <div className="p-10 text-center text-[14px] text-muted-foreground">{t("no_payments_recorded")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      {[t("table_user"), t("table_type"), t("table_method"), t("table_amount"), t("table_status"), t("table_date")].map(h => (
                        <th key={h} className="px-4 py-2.5 text-start text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={p.id} className={i < payments.length - 1 ? "[&>td]:border-b-0" : ""}>
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-semibold">{p.user_name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.user_email}</p>
                        </td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: p.type === "premium" ? "var(--primary)" : "var(--cyan)" }}>{p.type === "premium" ? "User Plan" : t("coach_member")}</td>
                        <td className="px-4 py-3 text-[12px] capitalize text-muted-foreground">{p.payment_method || "card"}</td>
                        <td className="px-4 py-3 text-[14px] font-bold tabular-nums text-primary">{p.amount?.toFixed(0)} EGP</td>
                        <td className="px-4 py-3">
                          <Badge variant={payStatusVariant(p.status)}>
                            {p.status === "completed" ? `✓ ${t("paid")}` : p.status === "pending" ? `⏳ ${t("pending")}` : `✗ ${t("rejected")}`}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══════ VIDEOS ═══════════════════════════ */}
      {tab === "videos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xl font-semibold tracking-tight">{t("training_videos")}</p>
            <Button variant="destructive" size="sm" onClick={() => setShowVideoModal(true)}>
              <Plus size={16} strokeWidth={2} /> {t("add_video")}
            </Button>
          </div>
          {videos.length === 0 && !loading && (
            <Card className="items-center p-10 text-center text-[14px] text-muted-foreground">
              {t("no_videos_uploaded")}
            </Card>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {videos.map(v => {
              const vStatus = v.approval_status || "approved";
              const vVariant = vStatus === "approved" ? "success" : vStatus === "rejected" ? "destructive" : "warning";
              return (
                <Card key={v.id} className="gap-0 overflow-hidden p-0">
                  <div className="relative grid h-[140px] place-items-center bg-muted">
                    <span className="grid size-12 place-items-center rounded-full bg-destructive/15">
                      <Play size={20} strokeWidth={2} className="ms-0.5 text-destructive" />
                    </span>
                    <div className="absolute bottom-2 start-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock size={11} strokeWidth={2} /> {v.duration}
                    </div>
                    <Badge variant={vVariant} className="absolute top-2 start-3 capitalize">{vStatus}</Badge>
                  </div>
                  <div className="p-4">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <h3 className="text-[14px] font-semibold leading-snug">{v.title}</h3>
                      <Badge variant="muted" className="shrink-0">{v.category}</Badge>
                    </div>
                    <p className="mb-3 text-[12px] leading-normal text-muted-foreground">{v.description}</p>
                    {v.submitted_by_name && (
                      <p className="mb-2 text-[11px] text-muted-foreground">Submitted by: {v.submitted_by_name}</p>
                    )}
                    {v.approval_status === "rejected" && v.rejection_reason && (
                      <p className="mb-2 text-[11px] text-destructive">Reason: {v.rejection_reason}</p>
                    )}
                    {v.training_id != null && (
                      <p className="mb-2 text-[11px] text-muted-foreground">
                        Training: {trainings.find(tr => tr.id === v.training_id)?.title || `#${v.training_id}`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {v.approval_status !== "approved" && (
                        <Button variant="ghost" size="sm" onClick={() => reviewVideo(v.id, "approved")} className="bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-[var(--green)]">
                          <CheckCircle size={16} strokeWidth={2} /> Approve
                        </Button>
                      )}
                      {v.approval_status !== "rejected" && (
                        <Button variant="ghost" size="sm" onClick={() => reviewVideo(v.id, "rejected")} className="bg-destructive/12 text-destructive">
                          <X size={16} strokeWidth={2} /> Reject
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => deleteVideo(v.id)} aria-label="Delete video" className="bg-destructive/12 text-destructive">
                        <Trash2 size={16} strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ ADS ═══════════════════════════ */}
      {tab === "ads" && (() => {
        const adFilter = (search || "").startsWith("ads:") ? search.replace("ads:", "").trim() : "";
        const statusFilters = ["all", "pending", "active", "rejected", "expired"] as const;
        const currentFilter = (["pending", "active", "rejected", "expired"].includes(adFilter) ? adFilter : "all") as typeof statusFilters[number];
        const filteredAds = currentFilter === "all" ? ads : ads.filter(a => a.status === currentFilter);
        const adStatsLocal = {
          total: ads.length,
          pending: ads.filter(a => a.status === "pending").length,
          active: ads.filter(a => a.status === "active").length,
          rejected: ads.filter(a => a.status === "rejected").length,
          expired: ads.filter(a => a.status === "expired").length,
          revenue: ads.reduce((s, a) => s + (a.payment_status === "approved" ? (a.paid_amount || 0) : 0), 0),
          pendingRevenue: ads.reduce((s, a) => s + (a.payment_status === "pending" ? (a.paid_amount || 0) : 0), 0),
          impressions: ads.reduce((s, a) => s + (a.impressions || 0), 0),
          clicks: ads.reduce((s, a) => s + (a.clicks || 0), 0),
        };
        const ctr = adStatsLocal.impressions > 0 ? ((adStatsLocal.clicks / adStatsLocal.impressions) * 100).toFixed(1) : "0";
        return (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-semibold tracking-tight">📢 Ad Manager</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Rate: <strong>4 EGP/min</strong> · Review payment proof before activation</p>
            </div>
          </div>

          {/* Analytics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Revenue", value: `${adStatsLocal.revenue} EGP`, color: "var(--primary)" },
              { label: "Pending $", value: `${adStatsLocal.pendingRevenue} EGP`, color: "var(--amber)" },
              { label: "Impressions", value: adStatsLocal.impressions.toLocaleString(), color: "var(--blue)" },
              { label: "Clicks", value: adStatsLocal.clicks.toLocaleString(), color: "var(--cyan)" },
              { label: "CTR", value: `${ctr}%`, color: "var(--primary)" },
            ].map(s => (
              <Card key={s.label} className="gap-0 p-4">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="text-[18px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Status Filter Tabs */}
          <div className="scroll-x flex gap-1 overflow-x-auto rounded-md bg-muted p-1">
            {statusFilters.map(f => {
              const count = f === "all" ? ads.length : ads.filter(a => a.status === f).length;
              const isActive = currentFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setSearch(f === "all" ? "" : `ads:${f}`)}
                  aria-pressed={isActive}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3.5 py-2 text-[12px] font-semibold transition-all ${isActive ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  {count > 0 && (
                    <span className="rounded-full px-1.5 text-[10px] font-bold" style={{
                      background: f === "pending" ? "color-mix(in srgb, var(--amber) 20%, transparent)" : f === "active" ? "var(--primary)" : "var(--muted)",
                      color: f === "pending" ? "var(--amber)" : f === "active" ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Ads List */}
          {filteredAds.length === 0 ? (
            <Card className="items-center p-10 text-center text-[14px] text-muted-foreground">
              {ads.length === 0 ? t("no_ads_submitted_yet") : `${t("no_label")} ${currentFilter} ${t("ads")}.`}
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredAds.map(ad => {
                const statusColor = ad.status === "active" ? "var(--primary)" : ad.status === "pending" ? "var(--amber)" : ad.status === "expired" ? "var(--muted-foreground)" : "var(--red)";
                const statusVariant = ad.status === "active" ? "default" : ad.status === "pending" ? "warning" : ad.status === "expired" ? "muted" : "destructive";
                const adCtr = (ad.impressions || 0) > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : "0";
                const boostEnd = ad.boost_end ? new Date(ad.boost_end) : null;
                const boostStart = ad.boost_start ? new Date(ad.boost_start) : null;
                const isExpired = boostEnd && boostEnd < new Date();
                const remainingMs = boostEnd && !isExpired ? boostEnd.getTime() - Date.now() : 0;
                const remainingHours = Math.floor(remainingMs / 3600000);
                const remainingDays = Math.floor(remainingHours / 24);
                const remainingH = remainingHours % 24;

                return (
                  <Card key={ad.id} className="gap-0 p-5" style={{ opacity: ad.status === "expired" ? 0.75 : 1 }}>
                    <div className="flex flex-wrap gap-3.5">
                      {/* Coach avatar */}
                      <Avatar className="size-12 shrink-0 ring-2" style={{ "--tw-ring-color": statusColor } as React.CSSProperties}>
                        <AvatarImage src={ad.coach_avatar || getAvatar(ad.coach_email, null, ad.coach_gender, ad.coach_name)} alt={ad.coach_name} />
                        <AvatarFallback>{(ad.coach_name || "C").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-[200px] flex-1">
                        {/* Top row: title + status */}
                        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-[15px] font-semibold">{ad.title}</h3>
                            <p className="mt-0.5 text-[12px] text-[var(--cyan)]">{ad.coach_name} · <span className="text-muted-foreground">{ad.coach_email}</span></p>
                          </div>
                          <Badge variant={statusVariant}>
                            {ad.status === "active" ? "✓ ACTIVE" : ad.status === "pending" ? "⏳ PENDING" : ad.status === "expired" ? "⌛ EXPIRED" : "✗ REJECTED"}
                          </Badge>
                        </div>

                        {/* Tags row */}
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          <Badge variant="muted">{ad.ad_type === "home_banner" ? "🏠 Banner" : "📱 Community"}</Badge>
                          <Badge variant="muted">{ad.objective === "coaching" ? "🎯 Booking" : "👁 Awareness"}</Badge>
                          <Badge variant="muted">{ad.media_type === "video" ? "🎬 Video" : "🖼 Image"} · {ad.specialty}</Badge>
                        </div>

                        <p className="mb-2 text-[13px] leading-normal text-muted-foreground">{ad.description.length > 160 ? ad.description.slice(0, 160) + "…" : ad.description}</p>

                        {/* Media preview */}
                        {(ad.image_url || ad.video_url) && (
                          <div className="mb-2.5 max-h-[120px] overflow-hidden rounded-md">
                            {ad.media_type === "video" && ad.video_url
                              ? <video src={ad.video_url} className="block max-h-[120px] w-full object-cover" />
                              : ad.image_url ? <img src={ad.image_url} alt={ad.title} className="block max-h-[120px] w-full object-cover" /> : null}
                          </div>
                        )}

                        {/* Payment + Schedule Info */}
                        <div className="mb-2.5 grid grid-cols-2 gap-2">
                          {/* Payment */}
                          <div className="rounded-md bg-muted p-3">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">💳 Payment</p>
                            <div className="flex flex-col gap-0.5 text-[12px]">
                              <span>{t("table_amount")}: <strong className="text-[var(--amber)]">{ad.paid_amount || 0} EGP</strong></span>
                              <span>Duration: <strong className="text-primary">{ad.paid_minutes || 0} min</strong></span>
                              <span>{t("table_status")}: <strong style={{ color: ad.payment_status === "approved" ? "var(--primary)" : ad.payment_status === "pending" ? "var(--amber)" : "var(--red)" }}>{ad.payment_status || t("unpaid")}</strong></span>
                              {ad.payment_phone && <span className="text-[11px] text-muted-foreground">📱 {ad.payment_phone}</span>}
                            </div>
                            {ad.payment_proof && (
                              <a href={ad.payment_proof} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--secondary)] underline">
                                <Paperclip size={12} strokeWidth={2} /> View proof
                              </a>
                            )}
                          </div>
                          {/* Schedule + Analytics */}
                          <div className="rounded-md bg-muted p-3">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">📊 Performance</p>
                            <div className="flex flex-col gap-0.5 text-[12px]">
                              <span>👁 {(ad.impressions || 0).toLocaleString()} impressions</span>
                              <span>🖱 {ad.clicks || 0} clicks · <strong className="text-[var(--blue)]">{adCtr}% CTR</strong></span>
                              {boostStart && <span className="text-[11px] text-muted-foreground">Start: {boostStart.toLocaleDateString()}</span>}
                              {boostEnd && (
                                <span className="text-[11px]" style={{ color: isExpired ? "var(--red)" : "var(--primary)" }}>
                                  {isExpired ? `Ended: ${boostEnd.toLocaleDateString()}` : `⏱ ${remainingDays > 0 ? `${remainingDays}d ` : ""}${remainingH}h left`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Admin note */}
                        {ad.admin_note && (
                          <div className="mb-2.5 rounded-md bg-destructive/8 p-2.5 text-[12px] text-muted-foreground">
                            <strong className="text-destructive">Admin note:</strong> {ad.admin_note}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          {ad.status !== "active" && (
                            <Button variant="ghost" size="sm" onClick={() => updateAdStatus(ad.id, "active")} className="bg-primary/15 text-primary">
                              <CheckCircle size={16} strokeWidth={2} /> Activate
                            </Button>
                          )}
                          {ad.status === "active" && (
                            <Button variant="ghost" size="sm" onClick={() => updateAdStatus(ad.id, "expired")} className="bg-muted text-muted-foreground">
                              <Clock size={16} strokeWidth={2} /> Expire
                            </Button>
                          )}
                          {ad.status === "pending" && (
                            <Button variant="ghost" size="sm" onClick={async () => {
                              const note = prompt("Rejection reason (optional):") || "";
                              const res = await api(`/api/admin/ads/${ad.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "rejected", admin_note: note }) });
                              if (res.ok) { showMsg("Ad rejected"); fetchAll(); }
                            }} className="bg-destructive/12 text-destructive">
                              <X size={16} strokeWidth={2} /> Reject
                            </Button>
                          )}
                          {ad.payment_status === "pending" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={async () => {
                                const res = await api(`/api/admin/ads/${ad.id}/payment`, { method: "PATCH", body: JSON.stringify({ payment_status: "approved" }) });
                                if (res.ok) { showMsg("✅ Payment approved & ad activated!"); fetchAll(); }
                              }} className="bg-[var(--secondary-dim)] text-[var(--secondary)]">
                                <CreditCard size={16} strokeWidth={2} /> Approve Payment
                              </Button>
                              <Button variant="ghost" size="sm" onClick={async () => {
                                const res = await api(`/api/admin/ads/${ad.id}/payment`, { method: "PATCH", body: JSON.stringify({ payment_status: "rejected" }) });
                                if (res.ok) { showMsg("Payment rejected"); fetchAll(); }
                              }} className="bg-destructive/12 text-destructive">
                                <X size={16} strokeWidth={2} /> Reject Payment
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon-sm" onClick={() => deleteAd(ad.id)} aria-label="Delete ad" className="bg-muted text-muted-foreground">
                            <Trash2 size={16} strokeWidth={2} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>);
      })()}

      {/* ═══════ GIFTS ═══════════════════════════ */}
      {tab === "gifts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xl font-semibold tracking-tight">Gift System</p>
            <Button variant="destructive" size="sm" onClick={() => setShowGiftModal(true)}>
              <Plus size={16} strokeWidth={2} /> Send Gift
            </Button>
          </div>
          {gifts.length === 0 ? (
            <Card className="items-center p-10 text-center text-muted-foreground">
              <Gift size={40} strokeWidth={1} className="mb-3" />
              <p>{t("no_gifts_sent_yet")}</p>
              <p className="mt-1 text-[13px]">Send points to athletes</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {gifts.map(g => (
                <Card key={g.id} className="gap-0 p-5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-full bg-primary/15">
                        <Gift size={16} strokeWidth={2} className="text-primary" />
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold">{g.title}</p>
                        <p className="text-[11px] text-muted-foreground">{g.type} · {g.value}</p>
                      </div>
                    </div>
                    <Badge variant="default">{g.type}</Badge>
                  </div>
                  {g.description && <p className="mb-2 text-[12px] text-muted-foreground">{g.description}</p>}
                  <p className="text-[11px] text-muted-foreground">To: {g.user_name || `User #${g.user_id}`} · {new Date(g.created_at).toLocaleDateString()}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ COMMUNITY MODERATION ═══════════════════════════ */}
      {tab === "community" && (
        <div className="space-y-4">

          {/* ── Header ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-semibold tracking-tight">🛡 Community Management</p>
              <p className="text-[13px] text-muted-foreground">Moderate posts, manage challenges, review comments</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchCommunityAll}>
              <RefreshCw size={16} strokeWidth={2} /> Refresh All
            </Button>
          </div>

          {/* ── Stats Bar ── */}
          {communityStats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Total Posts",     value: communityStats.totalPosts,     color: "var(--primary)" },
                { label: "Hidden Posts",    value: communityStats.hiddenPosts,    color: "var(--red)" },
                { label: "Comments",        value: communityStats.totalComments,  color: "var(--blue)" },
                { label: "Challenges",      value: communityStats.totalChallenges, color: "var(--secondary)" },
                { label: "Active Now",      value: communityStats.activeChallenges, color: "var(--green)" },
                { label: "Total Likes",     value: communityStats.totalLikes,     color: "var(--amber)" },
              ].map(s => (
                <Card key={s.label} className="gap-0 p-4">
                  <p className="mb-1 text-[11px] text-muted-foreground">{s.label}</p>
                  <p className="text-[20px] font-bold tabular-nums" style={{ color: s.color }}>{s.value ?? "—"}</p>
                </Card>
              ))}
            </div>
          )}
          {!communityStats && communityPosts.length === 0 && (
            <div className="py-6 text-center">
              <Button onClick={fetchCommunityAll}>Load Community Data</Button>
            </div>
          )}

          {/* ── Announcement Form ── */}
          <Card className="gap-0 p-5 ring-1 ring-[color-mix(in_srgb,var(--secondary)_25%,transparent)]">
            <div className="mb-3.5 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-[10px] bg-[var(--secondary-dim)]">
                <Megaphone size={16} strokeWidth={2} className="text-[var(--secondary)]" />
              </span>
              <div>
                <p className="text-[14px] font-semibold">📢 Post Announcement</p>
                <p className="text-[11px] text-muted-foreground">Pinned at the top with an Announcement badge</p>
              </div>
            </div>
            <Textarea value={announcementContent} onChange={e => setAnnouncementContent(e.target.value)} placeholder="Write your announcement..." rows={2} />
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <Input value={announcementHashtags} onChange={e => setAnnouncementHashtags(e.target.value)} placeholder="#hashtags (optional)" className="h-9 min-w-[160px] flex-1 text-[13px]" />
              <Button onClick={postAnnouncement} disabled={announcementPosting || !announcementContent.trim()} className="bg-[var(--secondary)] text-white hover:bg-[var(--secondary)]/90">
                <Megaphone size={16} strokeWidth={2} /> {announcementPosting ? "Posting…" : "Post Announcement"}
              </Button>
            </div>
          </Card>

          {/* ── Sub-tabs ── */}
          <div className="flex w-max gap-1 rounded-md bg-muted p-1">
            {([["posts","📝 Posts"], ["challenges","🏆 Challenges"], ["comments","💬 Comments"]] as const).map(([id, label]) => {
              const active = communitySubTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setCommunitySubTab(id)}
                  aria-pressed={active}
                  className={`whitespace-nowrap rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-all ${active ? "bg-card text-foreground shadow-soft-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label} {id === "posts" ? `(${communityPosts.length})` : id === "challenges" ? `(${communityChallenges.length})` : `(${communityComments.length})`}
                </button>
              );
            })}
          </div>

          {/* ── Search ── */}
          <Input value={communitySearch} onChange={e => setCommunitySearch(e.target.value)} placeholder={`Search ${communitySubTab}…`} />

          {/* ── POSTS ── */}
          {communitySubTab === "posts" && (
            <div className="flex flex-col gap-2.5">
              {communityPosts.filter(p => !communitySearch || p.content?.toLowerCase().includes(communitySearch.toLowerCase()) || p.user_name?.toLowerCase().includes(communitySearch.toLowerCase())).map((post: any) => (
                <Card key={post.id} className="gap-0 p-4" style={{ opacity: post.is_hidden ? 0.75 : 1 }}>
                  <div className="mb-2 flex items-start gap-2.5">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={post.user_avatar || getAvatar(post.user_email, null, post.user_gender, post.user_name)} alt="" />
                      <AvatarFallback>{(post.user_name || "U").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold">{post.user_name}</span>
                        <Badge variant={post.user_role === "coach" ? "accent" : "muted"} className="capitalize">{String(post.user_role || "").replace(/_/g, " ")}</Badge>
                        {post.is_pinned && <Badge variant="default">📌 Pinned</Badge>}
                        {post.is_announcement && <Badge variant="accent">📢 Announcement</Badge>}
                        {post.is_hidden && <Badge variant="destructive">🚫 Hidden</Badge>}
                        <span className="ms-auto text-[11px] text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{post.user_email}</p>
                    </div>
                  </div>
                  <p className="mb-1.5 text-[13px] leading-relaxed">{post.content}</p>
                  {post.hashtags && <p className="mb-1.5 text-[12px] text-primary">{post.hashtags}</p>}
                  {post.media_url && <img src={post.media_url} alt="" className="mb-2 max-h-[140px] w-full rounded-md object-cover" />}
                  <div className="mb-2.5 flex gap-2 text-[12px] text-muted-foreground">
                    <span>❤️ {post.likes || 0}</span>
                    <span>💬 {post.comment_count || 0}</span>
                    {post.moderation_reason && <span className="text-destructive">Reason: {post.moderation_reason}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => togglePin(post.id)} className={post.is_pinned ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}>
                      <Pin size={16} strokeWidth={2} /> {post.is_pinned ? "Unpin" : "Pin"}
                    </Button>
                    {post.is_hidden ? (
                      <Button variant="ghost" size="sm" onClick={async () => { await api(`/api/admin/community/posts/${post.id}/restore`, { method: "PATCH" }); fetchCommunityPosts(); showMsg("✅ Post restored"); }} className="bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-[var(--green)]">
                        <Check size={16} strokeWidth={2} /> Restore
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={async () => { const reason = prompt("Reason (optional):") || "Policy violation"; await api(`/api/admin/community/posts/${post.id}/hide`, { method: "PATCH", body: JSON.stringify({ reason }) }); fetchCommunityPosts(); showMsg("Post hidden"); }} className="bg-[color-mix(in_srgb,var(--amber)_16%,transparent)] text-[var(--amber)]">
                        <EyeOff size={16} strokeWidth={2} /> Hide
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={async () => { if (!confirm("Delete this post permanently?")) return; await api(`/api/admin/community/posts/${post.id}`, { method: "DELETE" }); fetchCommunityPosts(); showMsg("Post deleted"); }} className="bg-destructive/12 text-destructive">
                      <Trash2 size={16} strokeWidth={2} /> Delete
                    </Button>
                  </div>
                </Card>
              ))}
              {communityPosts.length === 0 && <p className="py-8 text-center text-[13px] text-muted-foreground">No posts yet — click Refresh All above.</p>}
            </div>
          )}

          {/* ── CHALLENGES ── */}
          {communitySubTab === "challenges" && (
            <div className="flex flex-col gap-2.5">
              {communityChallenges.filter(c => !communitySearch || c.title?.toLowerCase().includes(communitySearch.toLowerCase())).map((ch: any) => {
                const isActive = new Date(ch.end_date) >= new Date();
                return (
                  <Card key={ch.id} className="gap-0 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[14px] font-semibold">{ch.title}</span>
                          <Badge variant={isActive ? "success" : "muted"}>{isActive ? "🟢 Active" : "⚫ Ended"}</Badge>
                        </div>
                        <p className="mb-1.5 text-[12px] text-muted-foreground">{ch.description}</p>
                        <div className="flex flex-wrap gap-4 text-[12px] text-muted-foreground">
                          <span>👤 {ch.creator_name || "Unknown"}</span>
                          <span>👥 {ch.participant_count} participants</span>
                          <span>📅 {ch.start_date} → {ch.end_date}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        if (!confirm("Delete this challenge?")) return;
                        try {
                          const r = await api(`/api/admin/community/challenges/${ch.id}`, { method: "DELETE" });
                          if (!r.ok) { const d = await r.json().catch(() => ({})); showMsg(`❌ ${d?.message || "Failed to delete challenge"}`); return; }
                          setCommunityChallenges(prev => prev.filter(x => x.id !== ch.id));
                          showMsg("🗑️ Challenge deleted");
                          fetchCommunityAll();
                        } catch { showMsg("❌ Failed to delete challenge"); }
                      }} className="bg-destructive/12 text-destructive">
                        <Trash2 size={16} strokeWidth={2} /> Delete
                      </Button>
                    </div>
                  </Card>
                );
              })}
              {communityChallenges.length === 0 && <p className="py-8 text-center text-[13px] text-muted-foreground">No challenges yet.</p>}
            </div>
          )}

          {/* ── COMMENTS ── */}
          {communitySubTab === "comments" && (
            <div className="flex flex-col gap-2">
              {communityComments.filter(c => !communitySearch || c.content?.toLowerCase().includes(communitySearch.toLowerCase()) || c.user_name?.toLowerCase().includes(communitySearch.toLowerCase())).map((c: any) => (
                <Card key={c.id} className="gap-0 p-4">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Avatar className="size-6.5 size-[26px]">
                          <AvatarImage src={c.user_avatar} alt="" />
                          <AvatarFallback>{(c.user_name || "U").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <span className="text-[13px] font-semibold">{c.user_name}</span>
                        <span className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mb-1 text-[13px] leading-normal">{c.content}</p>
                      {c.post_preview && <p className="text-[11px] text-muted-foreground">On post: "{String(c.post_preview).slice(0, 60)}…"</p>}
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={async () => { if (!confirm("Delete this comment?")) return; await api(`/api/admin/community/comments/${c.id}`, { method: "DELETE" }); setCommunityComments(prev => prev.filter(x => x.id !== c.id)); showMsg("Comment deleted"); }} aria-label="Delete comment" className="shrink-0 bg-destructive/12 text-destructive">
                      <Trash2 size={16} strokeWidth={2} />
                    </Button>
                  </div>
                </Card>
              ))}
              {communityComments.length === 0 && <p className="py-8 text-center text-[13px] text-muted-foreground">No comments yet.</p>}
            </div>
          )}

        </div>
      )}


      {/* ═══════ WEBSITE & CONFIG ═══════════════════════════ */}
      {tab === "website" && (
        <WebsiteCMS token={token} showMsg={showMsg} />
      )}

      {/* ═══════ SUBSCRIPTIONS ═══════════════════════════ */}
      {tab === "subscriptions" && (
        <Card className="gap-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold">{t("coach_subscriptions")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted-foreground">{t("pending_count_label", { n: coachSubscriptions.filter(s => s.status === "pending" || s.status === "pending_admin").length })}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const r = await api("/api/payments/coach-subscriptions/approve-all", { method: "PATCH" });
                    const d = await r.json().catch(() => ({}));
                    if (r.ok) {
                      setCoachSubscriptions(prev => prev.map(s => (s.status === "pending" || s.status === "pending_admin") ? { ...s, status: "pending_coach" } : s));
                      showMsg(`✅ ${d?.message || "All pending subscriptions verified"}`);
                    } else {
                      showMsg(`❌ ${d?.message || "Failed to verify all"}`);
                    }
                  } catch {
                    showMsg("❌ Failed to verify all subscriptions");
                  }
                }}
                className="bg-primary/15 text-primary"
              >
                ✓ Verify All Payments
              </Button>
            </div>
          </div>
          {coachSubscriptions.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">{t("no_coach_subscriptions")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {coachSubscriptions.map((sub: any) => (
                <div key={sub.id} className="rounded-md bg-muted p-4">
                  <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold">{sub.user_name || "Unknown User"} → {sub.coach_name || "Unknown Coach"}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="accent">
                          {sub.plan_type === "workout" ? "💪 Workout" : sub.plan_type === "nutrition" ? "🥗 Nutrition" : "🏆 Complete"}
                        </Badge>
                        <Badge variant="default">{sub.plan_cycle} · {sub.amount} EGP</Badge>
                      </div>
                    </div>
                    <Badge variant={payStatusVariant(String(sub.status))} className="capitalize">
                      {String(sub.status || "").replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {sub.payment_proof && (
                    <div className="mb-2.5">
                      <p className="mb-1 text-[11px] text-muted-foreground">{t("payment_proof")}</p>
                      <img src={sub.payment_proof.startsWith("http") ? sub.payment_proof : getApiBase() + `/uploads/${sub.payment_proof}`} alt="proof" className="max-h-[120px] rounded-md" />
                    </div>
                  )}
                  <p className="mb-2 text-[11px] text-muted-foreground">{t("created_on")}: {new Date(sub.created_at).toLocaleDateString()}</p>
                  {(sub.status === "pending_admin" || sub.status === "pending") && (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={async () => {
                        try {
                          const r = await api(`/api/payments/coach-subscriptions/${sub.id}/approve`, { method: "PATCH" });
                          if (r.ok) {
                            setCoachSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "pending_coach" } : s));
                            showMsg(t("payment_verified_waiting_coach"));
                          }
                        } catch {}
                      }}>
                        ✓ {t("verify_payment")}
                      </Button>
                      <Button variant="destructive" size="sm" className="flex-1" onClick={async () => {
                        try {
                          const r = await api(`/api/payments/coach-subscriptions/${sub.id}/reject`, { method: "PATCH" });
                          if (r.ok) {
                            setCoachSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "rejected_admin" } : s));
                            showMsg(t("payment_rejected_refunded"));
                          }
                        } catch {}
                      }}>
                        ✗ {t("reject_refund")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ═══════ WITHDRAWALS ═══════════════════════════ */}
      {tab === "withdrawals" && (
        <Card className="gap-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold">{t("coach_withdrawal_requests")}</p>
            <span className="text-[12px] text-muted-foreground">{t("pending_count_label", { n: withdrawalRequests.filter(w => w.status === "pending").length })}</span>
          </div>
          {withdrawalRequests.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">{t("no_withdrawal_requests")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {withdrawalRequests.map((wd: any) => (
                <div key={wd.id} className="rounded-md bg-muted p-4">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold">{wd.coach_name || `Coach #${wd.coach_id}`}</p>
                      <p className="mt-1 text-[20px] font-bold tabular-nums text-primary">{wd.amount} <span className="text-[12px] font-normal">EGP</span></p>
                    </div>
                    <Badge variant={payStatusVariant(String(wd.status))} className="capitalize">
                      {String(wd.status || "").replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="mb-2 text-[12px] text-muted-foreground">
                    {(() => {
                      const mtype = wd.payment_method_type || "ewallet";
                      if (mtype === "ewallet") return <p>📱 {wd.wallet_type ? wd.wallet_type.charAt(0).toUpperCase() + wd.wallet_type.slice(1) : "E-Wallet"}: <strong className="text-foreground">{wd.payment_phone || "N/A"}</strong></p>;
                      if (mtype === "paypal") return <p>🅿️ PayPal: <strong className="text-foreground">{wd.paypal_email || "N/A"}</strong></p>;
                      if (mtype === "credit_card") return <p>💳 Card: <strong className="text-foreground">{wd.card_holder_name || "N/A"}</strong> — {wd.card_number || "N/A"}</p>;
                      if (mtype === "instapay") return <p>⚡ InstaPay: <strong className="text-foreground">{wd.instapay_handle || "N/A"}</strong></p>;
                      return <p>📱 {wd.wallet_type || "Vodafone"}: {wd.payment_phone || "N/A"}</p>;
                    })()}
                    <p className="mt-1 text-[11px] text-muted-foreground">{t("requested_on")}: {new Date(wd.created_at).toLocaleDateString()}</p>
                  </div>
                  {wd.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={async () => {
                        try {
                          const r = await api(`/api/payments/withdrawals/${wd.id}/approve`, { method: "PATCH" });
                          if (r.ok) {
                            setWithdrawalRequests(prev => prev.map(w => w.id === wd.id ? { ...w, status: "approved" } : w));
                            showMsg(t("withdrawal_approved_pay_coach"));
                          }
                        } catch {}
                      }}>
                        ✓ {t("approve_pay")}
                      </Button>
                      <Button variant="destructive" size="sm" className="flex-1" onClick={async () => {
                        try {
                          const r = await api(`/api/payments/withdrawals/${wd.id}/reject`, { method: "PATCH" });
                          if (r.ok) {
                            setWithdrawalRequests(prev => prev.map(w => w.id === wd.id ? { ...w, status: "rejected" } : w));
                            showMsg(t("withdrawal_rejected_refunded"));
                          }
                        } catch {}
                      }}>
                        ✗ {t("reject_refund")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ═══════ CHAT (moved) ═══════════════════════════ */}
      {tab === "chat" && (
        <Card className="p-8 text-center">
          <p className="mb-2 text-[15px] font-semibold">Chat moved</p>
          <p className="text-[13px] text-muted-foreground">
            1:1 chat was removed. Read & post in groups from{" "}
            <a href="/admin/chat" className="font-semibold text-primary hover:underline">Admin → Chat</a>. Direct contact lives in{" "}
            <a href="/admin/tickets" className="font-semibold text-primary hover:underline">Tickets</a>.
          </p>
        </Card>
      )}

      {/* ═══════ USER EDIT MODAL ═══════════════════════════ */}
      {(() => {
        // Coaches don't track steps, weight/height, or have a medical file —
        // those are athlete-only fields. Hide them so the coach edit form is
        // focused on what an admin actually needs to manage for a coach.
        const isCoachRow = userEditForm.role === "coach";
        return (
        <Dialog open={showUserEditModal} onOpenChange={setShowUserEditModal}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>Edit {isCoachRow ? "Coach" : userEditForm.role === "admin" ? "Admin" : userEditForm.role === "moderator" ? "Moderator" : "User"}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">ID</Label><Input type="number" value={userEditForm.id} onChange={e => setUserEditForm((f: any) => ({ ...f, id: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Name</Label><Input value={userEditForm.name} onChange={e => setUserEditForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Email</Label><Input type="email" value={userEditForm.email} onChange={e => setUserEditForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Password (leave blank to keep)</Label><Input type="password" value={userEditForm.password} onChange={e => setUserEditForm((f: any) => ({ ...f, password: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Role</Label>
                <Select value={userEditForm.role} onValueChange={v => setUserEditForm((f: any) => ({ ...f, role: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Avatar URL</Label><Input value={userEditForm.avatar} onChange={e => setUserEditForm((f: any) => ({ ...f, avatar: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Gender</Label><Input value={userEditForm.gender} onChange={e => setUserEditForm((f: any) => ({ ...f, gender: e.target.value }))} /></div>
              {!isCoachRow && <>
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Points</Label><Input type="number" value={userEditForm.points} onChange={e => setUserEditForm((f: any) => ({ ...f, points: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Steps</Label><Input type="number" value={userEditForm.steps} onChange={e => setUserEditForm((f: any) => ({ ...f, steps: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Step Goal</Label><Input type="number" value={userEditForm.step_goal} onChange={e => setUserEditForm((f: any) => ({ ...f, step_goal: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Height</Label><Input type="number" value={userEditForm.height} onChange={e => setUserEditForm((f: any) => ({ ...f, height: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Weight</Label><Input type="number" value={userEditForm.weight} onChange={e => setUserEditForm((f: any) => ({ ...f, weight: e.target.value }))} /></div>
              </>}
            </div>

            {!isCoachRow && <>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Medical History</Label>
                <Textarea rows={3} value={userEditForm.medical_history} onChange={e => setUserEditForm((f: any) => ({ ...f, medical_history: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Medical File URL</Label>
                <div className="flex flex-wrap gap-2">
                  <Input value={userEditForm.medical_file_url} onChange={e => setUserEditForm((f: any) => ({ ...f, medical_file_url: e.target.value }))} className="min-w-[220px] flex-1" />
                  <label className="inline-flex h-11 items-center rounded-md bg-muted px-3 text-[12px] whitespace-nowrap text-muted-foreground ring-1 ring-inset ring-border" style={{ cursor: medicalUploading ? "not-allowed" : "pointer" }}>
                    {medicalUploading ? "Uploading..." : "Upload Medical File"}
                    <input type="file" hidden accept="image/*" disabled={medicalUploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMedicalForUser(f); }} />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">JPG, PNG — max 5 MB</p>
              </div>
            </>}

            <div className="flex flex-wrap gap-4">
              {!isCoachRow && (
                <div className="flex items-center gap-2">
                  <Switch checked={!!userEditForm.membership_paid} onCheckedChange={v => setUserEditForm((f: any) => ({ ...f, membership_paid: v }))} id="membership_paid" />
                  <Label htmlFor="membership_paid" className="text-[13px]">Membership Paid</Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={!!userEditForm.coach_membership_active} onCheckedChange={v => setUserEditForm((f: any) => ({ ...f, coach_membership_active: v }))} id="coach_membership_active" />
                <Label htmlFor="coach_membership_active" className="text-[13px]">{t("coach_membership")} {t("active")}</Label>
              </div>
            </div>

            {isCoachRow && (
              <div className="space-y-3 pt-4">
                <Separator />
                <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Coach profile</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Specialty</Label><Input value={userEditForm.coach_specialty} onChange={e => setUserEditForm((f: any) => ({ ...f, coach_specialty: e.target.value }))} placeholder="e.g. Strength Training" /></div>
                  <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">Location</Label><Input value={userEditForm.coach_location} onChange={e => setUserEditForm((f: any) => ({ ...f, coach_location: e.target.value }))} placeholder="e.g. Cairo" /></div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Bio</Label>
                  <Textarea rows={3} value={userEditForm.coach_bio} onChange={e => setUserEditForm((f: any) => ({ ...f, coach_bio: e.target.value }))} placeholder="Short bio shown on the coach's profile" />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!userEditForm.coach_available} onCheckedChange={v => setUserEditForm((f: any) => ({ ...f, coach_available: v }))} id="coach_available" />
                    <Label htmlFor="coach_available" className="text-[13px]">Available for clients</Label>
                  </div>
                  <span className="text-[13px]" style={{ color: userEditForm.coach_certified ? "var(--green)" : "var(--muted-foreground)" }}>{userEditForm.coach_certified ? "✓ Certified" : "Not certified"}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Subscription prices are set globally on the Settings page. Certification is managed from the Certifications page.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUserEditModal(false)}>Cancel</Button>
              <Button onClick={saveUserEdit} disabled={userEditSaving}>
                {userEditSaving ? "Saving..." : "Save User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        );
      })()}

      {/* ═══════ GIFT MODAL ═══════════════════════════ */}
      <Dialog open={showGiftModal} onOpenChange={setShowGiftModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>🎁 Send Gift</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Recipient</Label>
              <Select value={String(giftForm.user_id)} onValueChange={v => setGiftForm(f => ({ ...f, user_id: Number(v) }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select user..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select user...</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Gift Title</Label>
              <Input value={giftForm.title} onChange={e => setGiftForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Welcome Bonus" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("table_type")}</Label>
                <Select value={giftForm.type} onValueChange={v => setGiftForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Value</Label>
                <Input type="number" value={giftForm.value} onChange={e => setGiftForm(f => ({ ...f, value: Number(e.target.value) }))} min={0} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Message (optional)</Label>
              <Textarea value={giftForm.description} onChange={e => setGiftForm(f => ({ ...f, description: e.target.value }))} placeholder="Personal message..." rows={2} className="resize-none" />
            </div>
            <Button onClick={sendGift} className="w-full">
              <Gift size={16} strokeWidth={2} /> Send Gift
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════ VIDEO MODAL ═══════════════════════════ */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>🎬 Upload Training Video</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3.5">

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Title *</Label>
              <Input value={videoForm.title} onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Full Body HIIT Blast" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Training *</Label>
              <Select value={videoForm.training_id || "none"} onValueChange={v => setVideoForm(f => ({ ...f, training_id: v === "none" ? "" : v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="— Select training —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select training —</SelectItem>
                  {trainings.map(tr => <SelectItem key={tr.id} value={String(tr.id)}>{tr.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5">
                <Input value={newTrainingTitle} onChange={e => setNewTrainingTitle(e.target.value)} placeholder="Or create a new training…" className="h-9 flex-1 text-[12px]" />
                <Button size="sm" onClick={createInlineTraining} disabled={!newTrainingTitle.trim()}>+ Add</Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Video File * (.mp4, .mov, .webm — max 50MB)</Label>
              <div
                className="cursor-pointer rounded-md p-[18px] text-center ring-1 ring-inset ring-border"
                style={{ backgroundColor: videoFile ? "color-mix(in srgb, var(--green) 8%, var(--muted))" : "var(--muted)" }}
                onClick={() => document.getElementById("videoFileInput")?.click()}
              >
                {videoFile ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Play size={18} strokeWidth={2} className="text-[var(--green)]" />
                    <span className="text-[13px] font-semibold text-[var(--green)]">{videoFile.name}</span>
                    <span className="text-[11px] text-muted-foreground">({(videoFile.size / 1024 / 1024).toFixed(1)} MB{videoForm.duration ? ` · ${videoForm.duration}` : ""})</span>
                  </div>
                ) : (
                  <div>
                    <Play size={28} strokeWidth={2} className="mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-[13px] text-muted-foreground">Click to select video file</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">MP4 or MOV — max 50 MB · duration auto-detected</p>
                  </div>
                )}
              </div>
              <input id="videoFileInput" type="file" accept="video/*" className="hidden" onChange={e => handleVideoFilePicked(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Thumbnail Image (optional)</Label>
              <div
                className="cursor-pointer rounded-md bg-muted p-3 text-center ring-1 ring-inset ring-border"
                onClick={() => document.getElementById("thumbFileInput")?.click()}
              >
                {thumbnailFile ? <span className="text-[13px] text-[var(--green)]">✅ {thumbnailFile.name}</span>
                  : <span className="text-[12px] text-muted-foreground">Click to select thumbnail</span>}
              </div>
              <p className="text-[10px] text-muted-foreground">JPG or PNG — recommended 1280×720px (16:9)</p>
              <input id="thumbFileInput" type="file" accept="image/*" className="hidden" onChange={e => setThumbnailFile(e.target.files?.[0] || null)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</Label>
              <Textarea value={videoForm.description} onChange={e => setVideoForm(f => ({ ...f, description: e.target.value }))} rows={2} className="resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Category</Label>
              <Select value={videoForm.category} onValueChange={v => setVideoForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["HIIT", "Strength", "Yoga", "Cardio", "Nutrition", "General"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Goal</Label>
                <Select value={videoForm.goal || "any"} onValueChange={v => setVideoForm(f => ({ ...f, goal: v === "any" ? "" : v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="— Any —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">— Any —</SelectItem>
                    <SelectItem value="fat_loss">Fat loss</SelectItem>
                    <SelectItem value="muscle_gain">Muscle gain</SelectItem>
                    <SelectItem value="mobility">Mobility</SelectItem>
                    <SelectItem value="endurance">Endurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Body Area</Label>
                <Select value={videoForm.body_area || "any"} onValueChange={v => setVideoForm(f => ({ ...f, body_area: v === "any" ? "" : v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="— Any —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">— Any —</SelectItem>
                    <SelectItem value="full_body">Full body</SelectItem>
                    <SelectItem value="legs">Legs</SelectItem>
                    <SelectItem value="core">Core</SelectItem>
                    <SelectItem value="upper_body">Upper body</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Equipment</Label>
                <Select value={videoForm.equipment || "any"} onValueChange={v => setVideoForm(f => ({ ...f, equipment: v === "any" ? "" : v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="— Any —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">— Any —</SelectItem>
                    <SelectItem value="none">No equipment</SelectItem>
                    <SelectItem value="dumbbells">Dumbbells</SelectItem>
                    <SelectItem value="bands">Bands</SelectItem>
                    <SelectItem value="gym">Gym</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Level</Label>
                <Select value={videoForm.level || "any"} onValueChange={v => setVideoForm(f => ({ ...f, level: v === "any" ? "" : v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="— Any —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">— Any —</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-5">
              <div className="flex items-center gap-2.5">
                <Switch checked={videoForm.is_short} onCheckedChange={v => setVideoForm(f => ({ ...f, is_short: v }))} id="is_short" />
                <Label htmlFor="is_short" className="text-[14px] text-muted-foreground">Shorty (&lt; 2 min)</Label>
              </div>
            </div>
            {videoUploadProgress && (
              <div className="rounded-md bg-[color-mix(in_srgb,var(--green)_10%,transparent)] px-3.5 py-2.5 text-center text-[13px] text-[var(--green)]">
                ⏳ {videoUploadProgress}
              </div>
            )}
            <Button variant="destructive" onClick={addVideo} disabled={!!videoUploadProgress} className="h-12">
              {videoUploadProgress ? "Saving..." : "Upload Video"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
