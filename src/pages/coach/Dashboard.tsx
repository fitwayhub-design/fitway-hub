import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { Users, TrendingUp, Star, ClipboardList, BookOpen, ArrowRight, DollarSign, Heart, MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Link } from "react-router-dom";
import { fetchPublicBlogs, resolveMediaUrl, type BlogPost } from "@/lib/blogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

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

/* Section header with optional "see all" link. */
function SectionHeader({ title, linkTo, viewAll }: { title: string; linkTo?: string; viewAll?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {linkTo && (
        <Link to={linkTo} className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-primary transition-opacity hover:opacity-75">
          {viewAll} <ArrowRight size={14} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

export default function CoachHome() {
  const { user, token } = useAuth();
  const { t, lang } = useI18n();
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
    apiFetch(path, { headers: { Authorization: `Bearer ${token}` } }).then((r) => {
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
    if (item.type === "message") return { icon: MessageSquare, color: "var(--secondary)", text: t("sent_you_message").replace("{name}", item.actor_name) };
    if (item.type === "review") return { icon: Star, color: "var(--amber)", text: t("new_review_from").replace("{rating}", String(item.rating || 0)).replace("{name}", item.actor_name) };
    return { icon: TrendingUp, color: "var(--green)", text: t("activity") };
  };

  const statusColor = (status?: string) =>
    status === "active" ? "text-[var(--green)]" : status?.includes("reject") ? "text-destructive" : "text-[var(--amber)]";

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-4 pb-4">
        <div className="space-y-6 pt-1">
          <Skeleton className="h-12 w-64 rounded-md" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }

  const statCards = [
    { label: t("my_athletes"), value: stats?.athletes ?? 0, icon: Users, link: "/coach/athletes" },
    { label: t("pending_requests"), value: stats?.pendingRequests ?? 0, icon: ClipboardList, link: "/coach/requests" },
    { label: t("monthly_revenue"), value: `${(Number(stats?.monthlyRevenue) || 0).toFixed(0)} ${t('currency_egp')}`, icon: DollarSign, link: "/coach/ads" },
    { label: t("avg_rating"), value: `${stats?.avgRating ?? "—"}★`, icon: Star, link: "/coach/profile" },
    { label: t("completion_rate"), value: `${stats?.completionRate ?? 0}%`, icon: TrendingUp, link: "/coach/athletes" },
  ];

  const weeklyTotal = (stats?.weekly || []).reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-4">
      <div className="space-y-6">

        {/* ═══════ HEADER ═══════════════════════════ */}
        <header className="flex flex-wrap items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">
              {t("welcome_back_name").replace("{name}", user?.name?.split(" ")[0] || "")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("coach_overview_week")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/coach/requests">
                <ClipboardList size={16} strokeWidth={2} /> {t("requests")}
                {(stats?.pendingRequests || 0) > 0 && (
                  <Badge variant="secondary" className="ms-0.5 bg-primary-foreground/20 px-1.5 py-0 text-primary-foreground tabular-nums">{stats?.pendingRequests}</Badge>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/coach/profile">{t("view_profile")}</Link>
            </Button>
          </div>
        </header>

        {/* ═══════ STATS ROW ═══════════════════════════ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} asChild className="gap-0 p-4 shadow-soft-sm transition active:scale-[0.98]">
                <Link to={s.link}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{s.label}</p>
                    <Icon size={16} strokeWidth={2} className="text-primary" />
                  </div>
                  <p className="text-2xl leading-none font-bold tabular-nums tracking-tight">{s.value}</p>
                </Link>
              </Card>
            );
          })}
        </div>

        {/* ═══════ FEED GRID ═══════════════════════════ */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* My athletes */}
          <Card className="gap-0 p-5 shadow-soft-sm">
            <SectionHeader title={t("my_athletes")} linkTo="/coach/athletes" viewAll={t("view_all")} />
            {homeFeed.athletes.length === 0 ? (
              <p className="py-2 text-[13px] text-muted-foreground">{lang === "ar" ? "لسه مفيش لاعيبة." : "No athletes yet."}</p>
            ) : (
              <div className="flex flex-col">
                {homeFeed.athletes.map((athlete, i, arr) => (
                  <div key={athlete.id}>
                    <div className="flex items-center justify-between gap-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarImage src={athlete.avatar} alt={athlete.name} />
                          <AvatarFallback>{(athlete.name || "A").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate text-[13px] font-semibold">{athlete.name}</span>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{athlete.plan_type || "plan"}</span>
                    </div>
                    {i < arr.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent requests */}
          <Card className="gap-0 p-5 shadow-soft-sm">
            <SectionHeader title={lang === "ar" ? "أحدث الطلبات" : "Recent Requests"} linkTo="/coach/requests" viewAll={t("view_all")} />
            {homeFeed.recentRequests.length === 0 ? (
              <p className="py-2 text-[13px] text-muted-foreground">{lang === "ar" ? "مفيش طلبات جديدة." : "No recent requests."}</p>
            ) : (
              <div className="flex flex-col">
                {homeFeed.recentRequests.map((request, i, arr) => (
                  <div key={request.id}>
                    <div className="flex items-center justify-between gap-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarImage src={request.user_avatar} alt={request.user_name || "Athlete"} />
                          <AvatarFallback>{(request.user_name || "A").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate text-[13px] font-semibold">{request.user_name || (lang === "ar" ? "لاعب" : "Athlete")}</span>
                      </div>
                      <span className={`shrink-0 text-[11px] font-semibold capitalize ${request.status === "pending" ? "text-[var(--amber)]" : "text-muted-foreground"}`}>{String(request.status || "pending").replace(/_/g, " ")}</span>
                    </div>
                    {i < arr.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent community posts */}
          <Card className="gap-0 p-5 shadow-soft-sm">
            <SectionHeader title={lang === "ar" ? "أحدث منشورات المجتمع" : "Recent Community Posts"} linkTo="/coach/community" viewAll={t("view_all")} />
            {homeFeed.recentPosts.length === 0 ? (
              <p className="py-2 text-[13px] text-muted-foreground">{lang === "ar" ? "لسه مفيش منشورات." : "No recent community posts."}</p>
            ) : (
              <div className="flex flex-col">
                {homeFeed.recentPosts.map((post, i, arr) => (
                  <div key={post.id}>
                    <div className="flex flex-col gap-1 py-2.5">
                      <p className="truncate text-[13px] font-semibold">{post.content || (lang === "ar" ? "منشور بدون نص" : "Post")}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{post.author_name || "User"}</span>
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1"><Heart size={11} strokeWidth={2} /> {post.likes || 0}</span>
                          <span className="inline-flex items-center gap-1"><MessageSquare size={11} strokeWidth={2} /> {post.comments || 0}</span>
                        </span>
                      </div>
                    </div>
                    {i < arr.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent transactions */}
          <Card className="gap-0 p-5 shadow-soft-sm">
            <SectionHeader title={t("recent_transactions")} linkTo="/coach/requests" viewAll={t("view_all")} />
            {homeFeed.recentTransactions.length === 0 ? (
              <p className="py-2 text-[13px] text-muted-foreground">{lang === "ar" ? "مفيش معاملات لسه." : "No recent transactions."}</p>
            ) : (
              <div className="flex flex-col">
                {homeFeed.recentTransactions.map((tx, i, arr) => (
                  <div key={tx.id}>
                    <div className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{tx.user_name || (lang === "ar" ? "عميل" : "Client")}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                      </div>
                      <div className="text-end">
                        <p className="text-[13px] font-bold text-primary tabular-nums">{Number(tx.credited_amount ?? tx.amount ?? 0).toFixed(0)} {t("currency_egp")}</p>
                        <p className={`text-[11px] capitalize ${statusColor(tx.status)}`}>{tx.status || "pending"}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ═══════ WEEKLY REVENUE ═══════════════════════════ */}
        <Card className="gap-0 p-5 shadow-soft-sm">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">{t("weekly_revenue") || "Weekly Revenue"}</h2>
            <span className="text-[13px] font-bold text-primary tabular-nums">{weeklyTotal.toFixed(0)} {t('currency_egp')}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(stats?.weekly || []).map((d) => (
              <div key={d.day} className="flex items-center justify-between rounded-md bg-muted px-3.5 py-3">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{d.day}</span>
                <span className="text-[15px] font-bold tabular-nums">{(Number(d.revenue) || 0).toFixed(0)} {t('currency_egp')}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ═══════ RECENT ACTIVITY ═══════════════════════════ */}
        <Card className="gap-0 p-5 shadow-soft-sm">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">{t("recent_activity")}</h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--green)]">
              <span className="size-1.5 rounded-full bg-[var(--green)]" /> {t("live")}
            </span>
          </div>
          {activity.length === 0 ? (
            <p className="py-2 text-center text-[13px] text-muted-foreground">{t("no_recent_activity")}</p>
          ) : (
            <div className="flex flex-col">
              {activity.map((a, i) => {
                const { icon: Icon, color, text } = getActivityIcon(a);
                return (
                  <div key={`${a.type}-${a.id}`}>
                    <div className="flex items-center gap-3 py-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
                        <Icon size={16} strokeWidth={2} style={{ color }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{text}</p>
                        {a.type === "message" && a.content && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{a.content}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(a.created_at)}</span>
                    </div>
                    {i < activity.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ═══════ RECENT BLOGS ═══════════════════════════ */}
        {recentBlogs.length > 0 && (
          <Card className="gap-0 p-5 shadow-soft-sm">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <h2 className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <BookOpen size={16} strokeWidth={2} className="text-[var(--secondary)]" />
                {t("recent_articles") || (lang === "ar" ? "أحدث المقالات" : "Recent Articles")}
              </h2>
              <Link to="/coach/blogs" className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-primary transition-opacity hover:opacity-75">
                {t("view_all") || (lang === "ar" ? "عرض الكل" : "View All")} <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentBlogs.map((blog) => (
                <Link
                  key={blog.id}
                  to={`/coach/blogs/${blog.slug}`}
                  className="flex flex-col overflow-hidden rounded-md bg-muted shadow-soft-xs transition active:scale-[0.98]"
                >
                  {/* Blog Image */}
                  <div
                    className="relative h-[120px] w-full bg-cover bg-center"
                    style={{
                      backgroundImage: blog.header_image_url
                        ? `url(${resolveMediaUrl(blog.header_image_url)})`
                        : "linear-gradient(135deg, var(--secondary) 0%, var(--card) 100%)",
                    }}
                  >
                    <span className="absolute top-1.5 start-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      {blog.language === "ar" ? "🇸🇦 AR" : "🇬🇧 EN"}
                    </span>
                  </div>

                  {/* Blog Content */}
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <h3 className="line-clamp-2 text-[14px] leading-snug font-bold text-foreground">{blog.title}</h3>
                    {blog.excerpt && (
                      <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{blog.excerpt}</p>
                    )}
                    <div className="mt-auto flex items-center gap-1.5 pt-1.5 text-[11px] text-muted-foreground">
                      <Avatar className="size-[18px]">
                        <AvatarImage src={blog.author_avatar ? resolveMediaUrl(blog.author_avatar) : undefined} alt={blog.author_name || ""} />
                        <AvatarFallback className="text-[8px]">{(blog.author_name || "U")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate font-medium">
                        {blog.author_name || (lang === "ar" ? "غير معروف" : "Unknown")}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
