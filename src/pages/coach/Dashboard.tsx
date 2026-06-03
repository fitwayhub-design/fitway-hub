import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { Users, TrendingUp, Activity, CheckCircle, Clock, DollarSign, Star, MessageSquare, ClipboardList, BookOpen, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Link } from "react-router-dom";
import { fetchPublicBlogs, resolveMediaUrl, type BlogPost } from "@/lib/blogs";
import { getAvatar } from "@/lib/avatar";

interface CoachStats {
  athletes: number;
  pendingRequests: number;
  monthlyRevenue: number;
  avgRating: number;
  reviewCount: number;
  completionRate: number;
  weekly: { day: string; sessions: number; revenue: number }[];
}

interface ActivityItem {
  type: "booking" | "message" | "review";
  id: number;
  actor_name: string;
  actor_avatar: string;
  created_at: string;
  status?: string;
  content?: string;
  rating?: number;
}

interface HomeAthlete {
  id: number;
  name: string;
  avatar?: string;
  email?: string;
  plan_type?: string;
  plan_cycle?: string;
}

interface HomeRequest {
  id: number;
  status?: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

interface HomePost {
  id: number;
  content?: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  likes?: number;
  comments?: number;
}

interface HomeTransaction {
  id: number;
  status?: string;
  amount?: number;
  credited_amount?: number;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

interface HomeFeed {
  athletes: HomeAthlete[];
  recentRequests: HomeRequest[];
  recentPosts: HomePost[];
  recentTransactions: HomeTransaction[];
}

export default function CoachHome() {
  const { user, token } = useAuth();
  const { t, lang } = useI18n();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentBlogs, setRecentBlogs] = useState<BlogPost[]>([]);
  const [homeFeed, setHomeFeed] = useState<HomeFeed>({
    athletes: [],
    recentRequests: [],
    recentPosts: [],
    recentTransactions: [],
  });

  const api = (path: string) =>
    fetch(getApiBase() + path, { headers: { Authorization: `Bearer ${token}` } }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      api("/api/coach/stats"),
      api("/api/coach/activity"),
      api("/api/coach/dashboard-home"),
    ])
      .then(([statsResult, activityResult, homeResult]) => {
        if (statsResult.status === "fulfilled" && statsResult.value?.weekly) {
          setStats(statsResult.value);
        } else {
          // Set empty stats to avoid crash
          setStats({ athletes: 0, pendingRequests: 0, monthlyRevenue: 0, avgRating: 0, reviewCount: 0, completionRate: 0, weekly: [{day:'Sun',sessions:0,revenue:0},{day:'Mon',sessions:0,revenue:0},{day:'Tue',sessions:0,revenue:0},{day:'Wed',sessions:0,revenue:0},{day:'Thu',sessions:0,revenue:0},{day:'Fri',sessions:0,revenue:0},{day:'Sat',sessions:0,revenue:0}] });
        }
        if (activityResult.status === "fulfilled") setActivity(activityResult.value?.activity || []);
        if (homeResult.status === "fulfilled") {
          setHomeFeed({
            athletes: homeResult.value?.athletes || [],
            recentRequests: homeResult.value?.recentRequests || [],
            recentPosts: homeResult.value?.recentPosts || [],
            recentTransactions: homeResult.value?.recentTransactions || [],
          });
        }
      })
      .finally(() => setLoading(false));
  }, [token]);
  useAutoRefresh(() => {
    if (!token) return;
    Promise.allSettled([api("/api/coach/stats"), api("/api/coach/activity"), api("/api/coach/dashboard-home")])
      .then(([sr, ar, hr]) => {
        if (sr.status === "fulfilled" && sr.value?.weekly) setStats(sr.value);
        if (ar.status === "fulfilled") setActivity(ar.value?.activity || []);
        if (hr.status === "fulfilled") setHomeFeed({ athletes: hr.value?.athletes || [], recentRequests: hr.value?.recentRequests || [], recentPosts: hr.value?.recentPosts || [], recentTransactions: hr.value?.recentTransactions || [] });
      });
  });

  // Fetch recent blogs filtered by language
  useEffect(() => {
    fetchPublicBlogs("", lang as "en" | "ar")
      .then((blogs) => setRecentBlogs(blogs.slice(0, 6)))
      .catch(() => setRecentBlogs([]));
  }, [lang]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return t("just_now");
    if (diff < 3600000) return `${Math.floor(diff / 60000)}${t("mins_ago")}`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}${t("hours_ago")}`;
    return `${Math.floor(diff / 86400000)}${t("days_ago")}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "short", day: "numeric" });
  };

  const getActivityIcon = (item: ActivityItem) => {
    if (item.type === "booking") return { icon: ClipboardList, color: "var(--amber)", text: item.status === "pending" ? t("new_coaching_request_from").replace("{name}", item.actor_name) : t("booking_status_for").replace("{status}", item.status || "").replace("{name}", item.actor_name) };
    if (item.type === "message") return { icon: MessageSquare, color: "var(--blue)", text: t("sent_you_message").replace("{name}", item.actor_name) };
    if (item.type === "review") return { icon: Star, color: "var(--amber)", text: t("new_review_from").replace("{rating}", String(item.rating || 0)).replace("{name}", item.actor_name) };
    return { icon: CheckCircle, color: "var(--accent)", text: t("activity") };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "var(--text-muted)", fontSize: 14 }}>
        {t("loading_dashboard")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: "clamp(28px,5vw,44px)", fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.0, textTransform: "uppercase" }}>
            {t("welcome_back_name").replace("{name}", user?.name?.split(" ")[0] || "")}
          </h1>
          <p style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 11, color: "var(--text-muted)", marginTop: 6, letterSpacing: "0.18em", textTransform: "uppercase" }}>— {t("coach_overview_week")}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/coach/requests" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: "var(--radius-full)", backgroundColor: "var(--main)", color: "#0a0a0a", fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontWeight: 600, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>
            <ClipboardList size={13} /> {t("requests")}
            {(stats?.pendingRequests || 0) > 0 && (
              <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: "var(--radius-full)", backgroundColor: "#0a0a0a", color: "var(--main)", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{stats?.pendingRequests}</span>
            )}
          </Link>
          <Link to="/coach/profile" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: "var(--radius-full)", backgroundColor: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontWeight: 600, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>
            {t("view_profile")}
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { label: t("my_athletes"), value: stats?.athletes ?? 0, icon: Users, color: "var(--blue)", link: "/coach/athletes" },
          { label: t("pending_requests"), value: stats?.pendingRequests ?? 0, icon: ClipboardList, color: "var(--amber)", link: "/coach/requests" },
          { label: t("monthly_revenue"), value: `${(stats?.monthlyRevenue ?? 0).toFixed(0)} ${t('currency_egp')}`, icon: DollarSign, color: "var(--cyan)", link: "/coach/ads" },
          { label: t("avg_rating"), value: `${stats?.avgRating ?? "—"}★`, icon: Star, color: "var(--amber)", link: "/coach/profile" },
          { label: t("completion_rate"), value: `${stats?.completionRate ?? 0}%`, icon: TrendingUp, color: "var(--accent)", link: "/coach/athletes" },
        ].map((s) => (
          <Link key={s.label} to={s.link} style={{ textDecoration: "none", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: 18, display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.2em" }}>{s.label}</p>
              <s.icon size={14} color="var(--main)" />
            </div>
            <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 32, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.0, color: "var(--text-primary)" }}>{s.value}</p>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 18, fontWeight: 300, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{t("my_athletes")}</p>
            <Link to="/coach/athletes" style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 10, color: "var(--main)", textDecoration: "none", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>{t("view_all")}</Link>
          </div>
          {homeFeed.athletes.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>{lang === "ar" ? "لسه مفيش لاعيبة." : "No athletes yet."}</p>
          ) : homeFeed.athletes.map((athlete) => (
            <div key={athlete.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <img src={athlete.avatar || getAvatar(athlete.email || "", null, null, athlete.name)} alt={athlete.name} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border)", objectFit: "cover" }} />
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{athlete.name}</span>
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{athlete.plan_type || "plan"}</span>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 18, fontWeight: 300, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{lang === "ar" ? "أحدث الطلبات" : "Recent Requests"}</p>
            <Link to="/coach/requests" style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 10, color: "var(--main)", textDecoration: "none", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>{t("view_all")}</Link>
          </div>
          {homeFeed.recentRequests.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>{lang === "ar" ? "مفيش طلبات جديدة." : "No recent requests."}</p>
          ) : homeFeed.recentRequests.map((request) => (
            <div key={request.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <img src={request.user_avatar || getAvatar("", null, null, request.user_name)} alt={request.user_name || "Athlete"} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border)", objectFit: "cover" }} />
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{request.user_name || (lang === "ar" ? "لاعب" : "Athlete")}</span>
              </div>
              <span style={{ fontSize: 10, color: request.status === "pending" ? "var(--amber)" : "var(--text-muted)", fontWeight: 700 }}>{String(request.status || "pending").replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 18, fontWeight: 300, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{lang === "ar" ? "أحدث منشورات المجتمع" : "Recent Community Posts"}</p>
            <Link to="/coach/community" style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 10, color: "var(--main)", textDecoration: "none", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>{t("view_all")}</Link>
          </div>
          {homeFeed.recentPosts.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>{lang === "ar" ? "لسه مفيش منشورات." : "No recent community posts."}</p>
          ) : homeFeed.recentPosts.map((post) => (
            <div key={post.id} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.content || (lang === "ar" ? "منشور بدون نص" : "Post")}</p>
              <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{post.author_name || "User"}</span>
                <span>{post.likes || 0} ❤ · {post.comments || 0} 💬</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 18, fontWeight: 300, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{t("recent_transactions")}</p>
            <Link to="/coach/requests" style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 10, color: "var(--main)", textDecoration: "none", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>{t("view_all")}</Link>
          </div>
          {homeFeed.recentTransactions.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>{lang === "ar" ? "مفيش معاملات لسه." : "No recent transactions."}</p>
          ) : homeFeed.recentTransactions.map((tx) => (
            <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.user_name || (lang === "ar" ? "عميل" : "Client")}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{formatDate(tx.created_at)}</p>
              </div>
              <div style={{ textAlign: "end" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{Number(tx.credited_amount ?? tx.amount ?? 0).toFixed(0)} {t("currency_egp")}</p>
                <p style={{ fontSize: 10, color: tx.status === "active" ? "var(--accent)" : tx.status?.includes("reject") ? "var(--red)" : "var(--amber)" }}>{tx.status || "pending"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mid Row: Weekly Revenue */}
      <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 20, fontWeight: 300, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{t("weekly_revenue") || "Weekly Revenue"}</p>
          <span style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 11, color: "var(--main)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{((stats?.weekly || []).reduce((sum, d) => sum + (Number(d.revenue) || 0), 0)).toFixed(0)} {t('currency_egp')}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {(stats?.weekly || []).map((d) => (
            <div key={d.day} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "12px 14px" }}>
              <span style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>{d.day}</span>
              <span style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 18, color: "var(--main)", fontWeight: 300, letterSpacing: "-0.01em" }}>{(Number(d.revenue) || 0).toFixed(0)} {t('currency_egp')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 20, fontWeight: 300, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{t("recent_activity")}</p>
          <span style={{ fontFamily: "var(--fwh-mono, 'Geist Mono', monospace)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.18em", textTransform: "uppercase" }}>● {t("live")}</span>
        </div>
        {activity.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", paddingTop: 12 }}>{t("no_recent_activity")}</p>
        ) : activity.map((a, i) => {
          const { icon: Icon, color, text } = getActivityIcon(a);
          return (
            <div key={`${a.type}-${a.id}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < activity.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--radius-full)", border: "1px solid var(--border)", backgroundColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color="var(--main)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</p>
                {a.type === "message" && a.content && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.content}</p>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{formatTime(a.created_at)}</span>
            </div>
          );
        })}
      </div>

      {/* Recent Blogs Section */}
      {recentBlogs.length > 0 && (
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={16} color="var(--blue)" />
              <p style={{ fontFamily: "var(--fwh-display, 'Barlow Condensed', sans-serif)", fontSize: 20, fontWeight: 300, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
                {t("recent_articles") || (lang === "ar" ? "أحدث المقالات" : "Recent Articles")}
              </p>
            </div>
            <Link to="/coach/blogs" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              {t("view_all") || (lang === "ar" ? "عرض الكل" : "View All")} <ArrowRight size={12} />
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {recentBlogs.map((blog) => (
              <Link
                key={blog.id}
                to={`/coach/blogs/${blog.slug}`}
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-full)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  textDecoration: "none",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Blog Image */}
                <div style={{ 
                  width: "100%", 
                  height: 120, 
                  background: blog.header_image_url 
                    ? `url(${resolveMediaUrl(blog.header_image_url)})` 
                    : "linear-gradient(135deg, var(--blue) 0%, var(--bg-surface) 100%)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative"
                }}>
                  <div style={{ 
                    position: "absolute", 
                    top: 6, 
                    left: lang === "ar" ? "auto" : 6,
                    right: lang === "ar" ? 6 : "auto",
                    padding: "2px 6px", 
                    borderRadius: "var(--radius-full)",
                    background: "rgba(0, 0, 0, 0.6)",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 600
                  }}>
                    {blog.language === "ar" ? "🇸🇦 AR" : "🇬🇧 EN"}
                  </div>
                </div>

                {/* Blog Content */}
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <h4 style={{ 
                    margin: 0, 
                    fontSize: 14, 
                    fontWeight: 700,
                    color: "var(--text-primary)", 
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}>
                    {blog.title}
                  </h4>

                  {blog.excerpt && (
                    <p style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}>
                      {blog.excerpt}
                    </p>
                  )}

                  {/* Meta */}
                  <div style={{ 
                    marginTop: "auto",
                    paddingTop: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "var(--text-muted)"
                  }}>
                    {blog.author_avatar ? (
                      <img 
                        src={resolveMediaUrl(blog.author_avatar)} 
                        alt={blog.author_name || ""} 
                        style={{ 
                          width: 18, 
                          height: 18, 
                          borderRadius: "50%",
                          objectFit: "cover" 
                        }} 
                      />
                    ) : (
                      <div style={{ 
                        width: 18, 
                        height: 18, 
                        borderRadius: "50%", 
                        background: "var(--blue)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 700
                      }}>
                        {(blog.author_name || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {blog.author_name || (lang === "ar" ? "غير معروف" : "Unknown")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
