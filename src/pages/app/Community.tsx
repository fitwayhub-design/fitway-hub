import { apiFetch } from "@/lib/api";
import ErrorState from "@/components/ui/ErrorState";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getAvatar } from "@/lib/avatar";
import {
  Heart, MessageCircle, Image as ImageIcon, Plus, Trophy, Calendar, X, Users, Megaphone,
  ExternalLink, Phone, UserPlus, UserCheck, Send, Hash, TrendingUp, Trash2, Eye, EyeOff,
  Clock, Flame, Award, Target, Sparkles, Pin, Star
} from "lucide-react";
import VideoPlayer from "@/components/app/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChallengesPage from "@/pages/app/Challenges";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/* ───── Interfaces ───── */
interface Post {
  id: number; user_id: number; content: string; media_url: string | null; hashtags: string | null;
  likes: number; created_at: string; user_name: string; user_avatar: string; user_role: string;
  isLiked?: boolean; is_hidden?: number; comments?: Comment[]; comment_count?: number;
  is_announcement?: number; is_pinned?: number;
}
interface Comment {
  id: number; post_id: number; user_id: number; content: string; created_at: string;
  user_name: string; user_avatar: string;
}
interface Challenge {
  id: number; title: string; description: string; image_url: string | null;
  start_date: string; end_date: string; participant_count: number;
  creator_name: string; creator_avatar: string; is_joined?: number;
}
interface SponsoredAd {
  id: number; title: string; description: string; image_url?: string; video_url?: string;
  media_type?: string; coach_name: string; coach_avatar?: string; coach_id?: number; objective?: string; contact_phone?: string;
  cta: string; specialty: string;
  coach_rating?: number; coach_review_count?: number;
}
interface TrendingTag { tag: string; count: number; }

/* ───── Time ago helper ───── */
const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function Community() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  /* ───── State ───── */
  const [activeTab, setActiveTab] = useState<"feed" | "challenges">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [sponsoredAds, setSponsoredAds] = useState<SponsoredAd[]>([]);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [communityStats, setCommunityStats] = useState<any>(null);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostHashtags, setNewPostHashtags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postErr, setPostErr] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [commentInputs, setCommentInputs] = useState<{ [k: number]: string }>({});
  const [showComments, setShowComments] = useState<{ [k: number]: boolean }>({});
  const [followedCoaches, setFollowedCoaches] = useState<Set<number>>(new Set());
  const [viewingCoachId, setViewingCoachId] = useState<number | null>(null);
  const [coachProfile, setCoachProfile] = useState<any>(null);
  const [coachPosts, setCoachPosts] = useState<Post[]>([]);
  const [likeAnimating, setLikeAnimating] = useState<Set<number>>(new Set());
    const [coachVideos, setCoachVideos] = useState<any[]>([]);
    const [coachShorties, setCoachShorties] = useState<any[]>([]);
    const [coachPhotos, setCoachPhotos] = useState<any[]>([]);
    const [profileTab, setProfileTab] = useState<"posts" | "videos" | "shorties" | "photos">("posts");
    const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ───── Data fetching ───── */
  const fetchPosts = useCallback(async (tag?: string | null) => {
    try {
      const url = tag ? `/api/community/posts?tag=${encodeURIComponent(tag.replace(/^#/, ""))}` : "/api/community/posts";
      const r = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('posts failed');
      setPosts(await r.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "feed") fetchPosts(activeTag);
  }, [activeTab, token, activeTag, fetchPosts]);
  useAutoRefresh(() => { if (activeTab === "feed") fetchPosts(activeTag); });

  useEffect(() => {
    apiFetch("/api/coach/ads/public/community", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        const sAds = d.ads || [];
        setSponsoredAds(sAds);
        if (sAds.length > 0) {
          apiFetch("/api/coach/ads/impressions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ids: sAds.map((a: any) => a.id) }) }).catch(() => {});
        }
      }).catch(() => {});
    apiFetch("/api/community/posts/trending-tags", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setTrendingTags(Array.isArray(d) ? d : [])).catch(() => {});
    if (isAdmin) {
      apiFetch("/api/community/stats", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setCommunityStats(d)).catch(() => {});
    }
  }, [token, isAdmin]);

  /* ───── Actions ───── */
  const createPost = async () => {
    if (!newPostContent.trim() && !selectedFile) return;
    setIsPosting(true);
    setPostErr("");
    try {
      let r: Response;
      if (selectedFile) {
        const fd = new FormData();
        fd.append("media", selectedFile);
        fd.append("content", newPostContent);
        fd.append("hashtags", newPostHashtags);
        r = await apiFetch("/api/community/posts", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      } else {
        r = await apiFetch("/api/community/posts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: newPostContent, hashtags: newPostHashtags }) });
      }
      if (r.ok) {
        setNewPostContent(""); setNewPostHashtags(""); setSelectedFile(null); setFilePreview(null); setShowComposer(false);
        fetchPosts(activeTag);
      } else {
        const d = await r.json().catch(() => ({}));
        setPostErr(d.message || "Couldn't post.");
      }
    } catch { setPostErr("Couldn't post."); }
    setIsPosting(false);
  };

  const deletePost = async (postId: number) => {
    if (!confirm(isAdmin ? "Hide this post from the community?" : "Delete this post permanently?")) return;
    try {
      await apiFetch(`/api/community/posts/${postId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      fetchPosts(activeTag);
    } catch {}
  };

  const toggleLike = async (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    setLikeAnimating(prev => new Set([...prev, postId]));
    setTimeout(() => setLikeAnimating(prev => { const s = new Set(prev); s.delete(postId); return s; }), 400);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.isLiked ? p.likes - 1 : p.likes + 1, isLiked: !p.isLiked } : p));
    try {
      if (post.isLiked) {
        await apiFetch(`/api/community/posts/${postId}/like`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      } else {
        await apiFetch(`/api/community/posts/${postId}/like`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      }
    } catch {}
  };

  const addComment = async (postId: number) => {
    const content = commentInputs[postId];
    if (!content?.trim()) return;
    try {
      const r = await apiFetch(`/api/community/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ content }) });
      if (r.ok) {
        setCommentInputs(prev => ({ ...prev, [postId]: "" }));
        fetchPosts(activeTag);
      } else {
        const d = await r.json().catch(() => ({}));
        alert(d.message || "Couldn't post comment.");
      }
    } catch {}
  };

  const toggleFollowCoach = async (coachId: number) => {
    const isFollowing = followedCoaches.has(coachId);
    try {
      if (isFollowing) {
        await apiFetch(`/api/coach/follow/${coachId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        setFollowedCoaches(prev => { const s = new Set(prev); s.delete(coachId); return s; });
      } else {
        await apiFetch(`/api/coach/follow/${coachId}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        setFollowedCoaches(prev => new Set([...prev, coachId]));
      }
    } catch {}
  };

  const viewCoachProfile = async (userId: number, userName: string, userAvatar: string) => {
    setViewingCoachId(userId);
    setCoachProfile({ name: userName, avatar: userAvatar });
      setProfileTab("posts");
      setCoachPosts([]);
      setCoachVideos([]);
      setCoachShorties([]);
      setCoachPhotos([]);
    try {
      const fsRes = await apiFetch(`/api/coach/follow/${userId}/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (fsRes.ok) { const fd = await fsRes.json(); if (fd.following) setFollowedCoaches(prev => new Set([...prev, userId])); }
      const pRes = await apiFetch(`/api/coach/profile/${userId}/posts`, { headers: { Authorization: `Bearer ${token}` } });
      if (pRes.ok) { const pd = await pRes.json(); setCoachPosts(pd.posts || []); }
        const vRes = await apiFetch(`/api/coach/profile/${userId}/videos`, { headers: { Authorization: `Bearer ${token}` } });
        if (vRes.ok) { const vd = await vRes.json(); setCoachVideos(vd.videos || []); }
        const shRes = await apiFetch(`/api/coach/profile/${userId}/shorties`, { headers: { Authorization: `Bearer ${token}` } });
        if (shRes.ok) { const sd = await shRes.json(); setCoachShorties(sd.videos || []); }
        const phRes = await apiFetch(`/api/coach/profile/${userId}/photos`, { headers: { Authorization: `Bearer ${token}` } });
        if (phRes.ok) { const phd = await phRes.json(); setCoachPhotos(phd.photos || []); }
      const sRes = await apiFetch(`/api/coach/profile/${userId}/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (sRes.ok) { const sd = await sRes.json(); setCoachProfile((p: any) => ({ ...p, ...sd, name: userName, avatar: userAvatar })); }
    } catch {}
  };

  const closeCoachProfile = () => {
    setViewingCoachId(null); setCoachProfile(null); setCoachPosts([]); setCoachVideos([]); setCoachShorties([]); setCoachPhotos([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setFilePreview(ev.target?.result as string); reader.readAsDataURL(file); }
    else setFilePreview(null);
  };

  const handleTagClick = (tag: string) => {
    const clean = tag.replace(/^#/, "");
    if (activeTag === clean) { setActiveTag(null); }
    else { setActiveTag(clean); setActiveTab("feed"); }
  };

  /* ───── Feed building ─────
     Only ONE sponsored ad is shown, at the top of the feed. The server returns
     a single random pick per request, so a refresh rotates the ad. */
  const feedItems: { type: "post" | "ad"; data: any }[] = [];
  if (sponsoredAds.length > 0) feedItems.push({ type: "ad", data: sponsoredAds[0] });
  posts.forEach((p) => {
    feedItems.push({ type: "post", data: p });
  });

  const firstName = user?.name?.split(" ")[0] || "Athlete";

  /* ──────────────────────────── RENDER ──────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-[680px] px-4 pb-20">

      {/* ── Header ── */}
      <header className="fade-up mb-6 pt-1">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight">Community</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Share your fitness journey</p>
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "feed" | "challenges")} className="shrink-0">
            <TabsList>
              <TabsTrigger value="feed" className="px-4">Feed</TabsTrigger>
              <TabsTrigger value="challenges" className="px-4">Challenges</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Admin stats bar */}
        {isAdmin && communityStats && (
          <Card className="flex flex-row flex-wrap items-center gap-3 bg-gradient-to-br from-primary/10 to-[var(--secondary-dim)] p-3 shadow-soft-sm">
            <span className="me-1 inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-primary uppercase">
              <Eye size={11} strokeWidth={2} /> Admin
            </span>
            {[
              { v: communityStats.total_posts, l: "Posts" },
              { v: communityStats.total_likes, l: "Likes" },
              { v: communityStats.total_comments, l: "Comments" },
              { v: communityStats.total_challenges, l: "Challenges" },
              { v: communityStats.active_users, l: "Active" },
            ].map(s => (
              <span key={s.l} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <strong className="font-bold tabular-nums text-foreground">{s.v || 0}</strong> {s.l}
              </span>
            ))}
          </Card>
        )}
      </header>

      {/* ── Trending Tags ── */}
      {trendingTags.length > 0 && activeTab === "feed" && (
        <div className="fade-up-1 mb-4 flex flex-wrap items-center gap-2">
          <TrendingUp size={14} strokeWidth={2} className="shrink-0 text-primary" />
          {activeTag && (
            <button
              onClick={() => { setActiveTag(null); }}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition active:scale-[0.97]"
            >
              All <X size={10} strokeWidth={2.5} className="ms-0.5" />
            </button>
          )}
          {trendingTags.slice(0, 8).map(t => {
            const isActive = activeTag === t.tag.replace(/^#/, "");
            return (
              <button
                key={t.tag}
                onClick={() => handleTagClick(t.tag)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold transition active:scale-[0.97]",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {t.tag}
              </button>
            );
          })}
        </div>
      )}

      {/* ════════════════════ FEED TAB ════════════════════ */}
      {activeTab === "feed" && (
        <div className="flex flex-col gap-4">

          {/* ── Compose area ── */}
          <Card className={cn("fade-up-2 gap-0 shadow-soft-sm", showComposer ? "p-[18px]" : "px-[18px] py-3")}>
            {!showComposer ? (
              <button
                type="button"
                onClick={() => { setShowComposer(true); setTimeout(() => textareaRef.current?.focus(), 100); }}
                className="flex w-full items-center gap-3 text-start"
              >
                <Avatar className="size-10 shrink-0 ring-2 ring-border">
                  <AvatarImage src={user?.avatar} alt={user?.name || "Me"} />
                  <AvatarFallback>{firstName.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 rounded-full bg-muted px-4 py-2.5 text-[13px] text-muted-foreground">
                  What's on your mind, {firstName}?
                </span>
                <ImageIcon size={18} strokeWidth={2} className="text-primary" />
              </button>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <Avatar className="size-10 shrink-0 ring-2 ring-border">
                    <AvatarImage src={user?.avatar} alt={user?.name || "Me"} />
                    <AvatarFallback>{firstName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{user?.name}</p>
                    <p className="text-[11px] text-muted-foreground">Posting to Community</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close composer"
                    onClick={() => { setShowComposer(false); setSelectedFile(null); setFilePreview(null); }}
                    className="rounded-full bg-muted text-muted-foreground"
                  >
                    <X size={15} strokeWidth={2} />
                  </Button>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Share a workout win, milestone, or tip…"
                  rows={3}
                  className="mb-2.5 min-h-20 resize-none text-[14px] leading-relaxed"
                />
                {filePreview && (
                  <div className="relative mb-2.5 overflow-hidden rounded-md">
                    <img src={filePreview} alt="Selected media preview" className="block max-h-[200px] w-full object-cover" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove media"
                      onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                      className="absolute top-2 end-2 rounded-full bg-black/60 text-white hover:bg-black/70 hover:text-white"
                    >
                      <X size={14} strokeWidth={2} />
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <Hash size={14} strokeWidth={2} className="shrink-0 text-muted-foreground" />
                    <Input
                      value={newPostHashtags}
                      onChange={e => setNewPostHashtags(e.target.value)}
                      placeholder="#fitness #progress"
                      className="h-9 rounded-full px-3 text-[12px]"
                    />
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Image: JPG/PNG max 5 MB — Video: MP4 max 50 MB</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Add photo or video"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn("rounded-full bg-muted", selectedFile ? "text-primary" : "text-muted-foreground")}
                  >
                    <ImageIcon size={16} strokeWidth={2} />
                  </Button>
                  <Button
                    onClick={createPost}
                    disabled={isPosting || (!newPostContent.trim() && !selectedFile)}
                    size="sm"
                    className="rounded-full"
                  >
                    {isPosting ? "Posting…" : <><Send size={13} strokeWidth={2} /> Post</>}
                  </Button>
                </div>
                {postErr && <p className="mt-2 text-[12px] text-[var(--red)]">{postErr}</p>}
              </>
            )}
          </Card>

          {/* ── Load failure (distinct from a genuinely empty feed) ── */}
          {feedItems.length === 0 && loadError && (
            <ErrorState message="We couldn't load the feed. Check your connection and try again." onRetry={() => fetchPosts(activeTag)} />
          )}

          {/* ── Empty state ── */}
          {feedItems.length === 0 && !loadError && (
            <div className="px-5 py-12 text-center text-muted-foreground">
              <Sparkles size={32} strokeWidth={2} className="mx-auto mb-3 opacity-40" />
              <p className="mb-1 text-[15px] font-semibold text-foreground">
                {activeTag ? `No posts found for #${activeTag}` : "No posts yet"}
              </p>
              <p className="text-[13px]">Be the first to share something!</p>
            </div>
          )}

          {/* ── Feed items ── */}
          {feedItems.map((item, idx) =>
            item.type === "ad"
              ? <div key={`ad-${item.data.id}-${idx}`}><SponsoredAdCard ad={item.data} token={token} /></div>
              : <div key={`post-${item.data.id}`}><PostCard
                  post={item.data}
                  user={user}
                  isAdmin={isAdmin}
                  token={token}
                  isLikeAnimating={likeAnimating.has(item.data.id)}
                  showComments={!!showComments[item.data.id]}
                  commentInput={commentInputs[item.data.id] || ""}
                  followedCoaches={followedCoaches}
                  onLike={() => toggleLike(item.data.id)}
                  onDelete={() => deletePost(item.data.id)}
                  onToggleComments={() => setShowComments(p => ({ ...p, [item.data.id]: !p[item.data.id] }))}
                  onCommentChange={(v) => setCommentInputs(p => ({ ...p, [item.data.id]: v }))}
                  onAddComment={() => addComment(item.data.id)}
                  onFollowCoach={(id) => toggleFollowCoach(id)}
                  onViewCoach={(id, name, avatar) => viewCoachProfile(id, name, avatar)}
                  onTagClick={handleTagClick}
                  idx={idx}
                /></div>
          )}
        </div>
      )}

      {/* ════════════════════ CHALLENGES TAB (new system) ════════════════════ */}
      {activeTab === "challenges" && (
        <div className="-mx-1">
          <ChallengesPage />
        </div>
      )}

      {/* ════════════════ COACH PROFILE SHEET ════════════════ */}
      <Sheet open={viewingCoachId !== null && !!coachProfile} onOpenChange={(o) => { if (!o) closeCoachProfile(); }}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto p-6 sm:max-w-[600px] sm:mx-auto">
          {viewingCoachId !== null && coachProfile && (
            <>
              <SheetHeader className="p-0">
                <SheetTitle>Coach Profile</SheetTitle>
              </SheetHeader>
              <div className="mt-5 mb-5 flex items-center gap-3.5">
                <Avatar className="size-16 shrink-0 ring-2 ring-[var(--secondary)]">
                  <AvatarImage src={coachProfile.avatar || getAvatar(viewingCoachId, null, null, coachProfile.name)} alt={coachProfile.name} />
                  <AvatarFallback>{(coachProfile.name || "C").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h4 className="mb-1.5 text-[17px] font-bold">{coachProfile.name}</h4>
                  <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
                    {coachProfile.followers !== undefined && <span className="inline-flex items-center gap-1"><Users size={12} strokeWidth={2} /> {coachProfile.followers}</span>}
                    {coachProfile.posts !== undefined && <span className="inline-flex items-center gap-1"><MessageCircle size={12} strokeWidth={2} /> {coachProfile.posts}</span>}
                    {coachProfile.athletes !== undefined && <span className="inline-flex items-center gap-1"><Trophy size={12} strokeWidth={2} /> {coachProfile.athletes}</span>}
                    {coachProfile.avgRating !== undefined && <span className="inline-flex items-center gap-1"><Star size={12} strokeWidth={2} className="text-[var(--amber)]" /> {coachProfile.avgRating}</span>}
                  </div>
                </div>
                <Button
                  onClick={() => toggleFollowCoach(viewingCoachId)}
                  size="sm"
                  variant={followedCoaches.has(viewingCoachId) ? "secondary" : "default"}
                  className="rounded-full"
                >
                  {followedCoaches.has(viewingCoachId) ? <><UserCheck size={14} strokeWidth={2} /> Following</> : <><UserPlus size={14} strokeWidth={2} /> Follow</>}
                </Button>
              </div>

              <Tabs value={profileTab} onValueChange={(v) => setProfileTab(v as typeof profileTab)} className="mb-3.5">
                <TabsList className="w-full">
                  <TabsTrigger value="posts">Posts</TabsTrigger>
                  <TabsTrigger value="videos">Videos</TabsTrigger>
                  <TabsTrigger value="shorties">Shorties</TabsTrigger>
                  <TabsTrigger value="photos">Photos</TabsTrigger>
                </TabsList>
              </Tabs>

              {profileTab === "posts" && (
                coachPosts.length === 0 ? (
                  <p className="p-8 text-center text-[13px] text-muted-foreground">No posts yet</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {coachPosts.map(post => (
                      <Card key={post.id} className="gap-0 overflow-hidden p-0 shadow-soft-sm">
                        {post.media_url && <img src={post.media_url} alt="Coach post media" className="max-h-[200px] w-full object-cover" />}
                        <div className="p-3.5">
                          <p className="mb-1.5 text-[13px] leading-relaxed text-foreground">{post.content}</p>
                          {post.hashtags && <p className="text-[11px] text-primary">{post.hashtags}</p>}
                          <div className="mt-2 flex gap-3 text-[12px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><Heart size={12} strokeWidth={2} /> {post.likes}</span>
                            <span>{timeAgo(post.created_at)}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}

              {profileTab === "videos" && (
                coachVideos.length === 0 ? (
                  <p className="p-8 text-center text-[13px] text-muted-foreground">No videos yet</p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                    {coachVideos.map(v => (
                      <Card key={v.id} className="gap-0 overflow-hidden p-0 shadow-soft-sm">
                        <video src={v.url} controls poster={v.thumbnail || undefined} className="h-[140px] w-full bg-black object-cover" />
                        <div className="p-3">
                          <p className="text-[13px] font-bold">{v.title}</p>
                          {v.description && <p className="mt-1 text-[11px] text-muted-foreground">{v.description}</p>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}

              {profileTab === "shorties" && (
                coachShorties.length === 0 ? (
                  <p className="p-8 text-center text-[13px] text-muted-foreground">No shorties yet</p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                    {coachShorties.map(v => (
                      <Card key={v.id} className="gap-0 overflow-hidden p-0 shadow-soft-sm">
                        <video src={v.url} controls poster={v.thumbnail || undefined} className="h-[220px] w-full bg-black object-cover" />
                        <div className="p-2.5">
                          <p className="text-[12px] font-bold">{v.title}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}

              {profileTab === "photos" && (
                coachPhotos.length === 0 ? (
                  <p className="p-8 text-center text-[13px] text-muted-foreground">No photos yet</p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                    {coachPhotos.map((p: any) => (
                      <div key={p.id} className="overflow-hidden rounded-md bg-muted shadow-soft-sm">
                        <img src={p.media_url} alt={p.content || "Coach photo"} className="block h-[120px] w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════ */

function SponsoredAdCard({ ad, token }: { ad: SponsoredAd; token: string | null }) {
  const isCall = ad.objective === "direct_call" && !!ad.contact_phone;
  const target = isCall
    ? `tel:${(ad.contact_phone || "").replace(/\s/g, "")}`
    : ad.coach_id
    ? `/app/coaching?coach=${ad.coach_id}`
    : null;

  const trackClick = () => {
    if (!ad.id) return;
    apiFetch(`/api/coach/ads/${ad.id}/click`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  // Capped media height so big creatives don't dominate the feed.
  const mediaMaxH = 180;

  const inner = (
    <>
      <span className="absolute top-2.5 end-2.5 z-[2] rounded-full bg-[var(--secondary)] px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">
        SPONSORED
      </span>
      {(ad.media_type === "video" || ad.media_type === "youtube") && ad.video_url ? (
        <VideoPlayer
          url={ad.video_url}
          mediaType={ad.media_type}
          height={mediaMaxH}
          style={{ marginBottom: 0, borderRadius: 0 }}
        />
      ) : ad.image_url ? (
        <img
          src={ad.image_url}
          alt={ad.title}
          className="block w-full object-cover"
          style={{ maxHeight: mediaMaxH }}
        />
      ) : null}
      <div className="p-4">
        <div className="mb-2.5 flex items-center gap-2.5">
          <Avatar className="size-10 shrink-0 ring-2 ring-[color-mix(in_srgb,var(--secondary)_25%,transparent)]">
            <AvatarImage src={ad.coach_avatar || getAvatar(ad.coach_name, null, null, ad.coach_name)} alt={ad.coach_name} />
            <AvatarFallback>{(ad.coach_name || "C").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">{ad.title}</p>
            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--secondary)]">
              <span>{ad.coach_name}</span>
              <span className="text-muted-foreground">·</span>
              <span>{ad.specialty}</span>
              {typeof ad.coach_rating === "number" && ad.coach_rating > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-0.5 text-[var(--amber)]">
                    <Star size={11} strokeWidth={2} className="fill-current" /> {ad.coach_rating.toFixed(1)}
                    {typeof ad.coach_review_count === "number" && ad.coach_review_count > 0 && (
                      <span className="font-medium text-muted-foreground">({ad.coach_review_count})</span>
                    )}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        {ad.description && (
          <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
            {ad.description}
          </p>
        )}
        {isCall && ad.coach_id && (
          <Link to={`/app/coaching?coach=${ad.coach_id}`}
            onClick={(e) => e.stopPropagation()}
            className="mb-2.5 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--secondary)]">
            View Profile →
          </Link>
        )}
        {target && (
          <span
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-bold text-white",
              isCall ? "bg-[var(--green)]" : "bg-[var(--secondary)]",
            )}
          >
            {isCall ? <Phone size={14} strokeWidth={2} /> : null}
            {isCall ? "Call Now" : ad.cta || "Subscribe"}
            {!isCall && <ExternalLink size={13} strokeWidth={2} />}
          </span>
        )}
      </div>
    </>
  );

  const cardCls = "relative block overflow-hidden rounded-lg bg-card text-card-foreground shadow-soft-sm ring-1 ring-[color-mix(in_srgb,var(--secondary)_25%,transparent)]";

  if (!target) {
    return <div className={cardCls}>{inner}</div>;
  }
  return isCall ? (
    <a href={target} onClick={trackClick} className={cn(cardCls, "transition active:scale-[0.99]")}>{inner}</a>
  ) : (
    <Link to={target} onClick={trackClick} className={cn(cardCls, "transition active:scale-[0.99]")}>{inner}</Link>
  );
}

interface PostCardProps {
  post: Post; user: any; isAdmin: boolean; token: string | null;
  isLikeAnimating: boolean; showComments: boolean; commentInput: string;
  followedCoaches: Set<number>;
  onLike: () => void; onDelete: () => void; onToggleComments: () => void;
  onCommentChange: (v: string) => void; onAddComment: () => void;
  onFollowCoach: (id: number) => void;
  onViewCoach: (id: number, name: string, avatar: string) => void;
  onTagClick: (tag: string) => void;
  idx: number;
}

function PostCard({
  post, user, isAdmin, token, isLikeAnimating, showComments, commentInput,
  followedCoaches, onLike, onDelete, onToggleComments, onCommentChange, onAddComment,
  onFollowCoach, onViewCoach, onTagClick, idx,
}: PostCardProps) {
  const canDelete = post.user_id === user?.id || isAdmin;
  const isCoach = post.user_role === "coach";
  const isHidden = post.is_hidden === 1;

  const renderHashtags = (tags: string) => {
    const parts = tags.match(/#[\w؀-ۿ]+/g) || [];
    return parts.map((t, i) => (
      <button key={i} onClick={() => onTagClick(t)} className="me-1.5 text-[12px] font-semibold text-primary">
        {t}
      </button>
    ));
  };

  const openProfile = () => {
    // Coach → full coach profile sheet (uses subscribed-coach context).
    // Athlete → limited public profile page (name + posts only).
    if (isCoach) onViewCoach(post.user_id, post.user_name, post.user_avatar);
    else window.location.href = `/app/u/${post.user_id}`;
  };

  return (
    <Card className={cn(
      `fade-up-${Math.min((idx % 5) + 1, 4)} gap-0 overflow-hidden p-0 shadow-soft-sm transition-opacity`,
      post.is_announcement && "ring-1 ring-[color-mix(in_srgb,var(--secondary)_30%,transparent)]",
      isHidden && "opacity-50",
    )}>
      <div className="px-[18px] pt-4 pb-2.5">
        {/* Pinned / Announcement banner */}
        {(post.is_pinned || post.is_announcement) ? (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {post.is_pinned ? <Badge variant="default" className="gap-1"><Pin size={10} strokeWidth={2} /> Pinned</Badge> : null}
            {post.is_announcement ? <Badge variant="accent" className="gap-1"><Megaphone size={10} strokeWidth={2} /> Announcement</Badge> : null}
          </div>
        ) : null}
        <div className="mb-3 flex items-center gap-2.5">
          <button type="button" onClick={openProfile} aria-label={`View ${post.user_name}'s profile`} className="shrink-0">
            <Avatar className={cn("size-10", isCoach ? "ring-2 ring-[var(--secondary)]" : "ring-2 ring-border")}>
              <AvatarImage src={post.user_avatar || getAvatar(post.user_id, null, null, post.user_name)} alt={post.user_name} />
              <AvatarFallback>{(post.user_name || "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={openProfile}
                className={cn("text-[14px] font-bold", isCoach ? "text-[var(--secondary)]" : "text-foreground")}
              >
                {post.user_name}
              </button>
              {isCoach && (
                <Badge variant="accent" className="px-2 py-0.5 text-[9px] tracking-wide">COACH</Badge>
              )}
              {isHidden && (
                <Badge variant="destructive" className="px-2 py-0.5 text-[9px]">HIDDEN</Badge>
              )}
            </div>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock size={10} strokeWidth={2} /> {timeAgo(post.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isCoach && post.user_id !== user?.id && (
              <Button
                onClick={() => onFollowCoach(post.user_id)}
                size="sm"
                variant={followedCoaches.has(post.user_id) ? "secondary" : "outline"}
                aria-label={followedCoaches.has(post.user_id) ? "Following coach" : "Follow coach"}
                className="h-8 rounded-full px-3 text-[11px]"
              >
                {followedCoaches.has(post.user_id) ? <UserCheck size={11} strokeWidth={2} className="text-primary" /> : <><UserPlus size={11} strokeWidth={2} /> Follow</>}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                aria-label={isAdmin && post.user_id !== user?.id ? "Hide post" : "Delete post"}
                className="rounded-full text-muted-foreground"
              >
                {isAdmin && post.user_id !== user?.id ? <EyeOff size={14} strokeWidth={2} /> : <Trash2 size={14} strokeWidth={2} />}
              </Button>
            )}
          </div>
        </div>

        <p className="mb-1.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap text-foreground">
          {post.content}
        </p>
        {post.hashtags && (
          <div className="mb-1 flex flex-wrap">
            {renderHashtags(post.hashtags)}
          </div>
        )}
      </div>

      {post.media_url && (
        <div className="overflow-hidden">
          <img src={post.media_url} alt="Post media" className="block max-h-[400px] w-full object-cover" />
        </div>
      )}

      <div className="flex gap-1 px-[18px] pt-2 pb-2.5">
        <button
          onClick={onLike}
          aria-label={post.isLiked ? "Unlike post" : "Like post"}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors",
            post.isLiked ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <Heart
            size={18}
            strokeWidth={2}
            className={cn("transition-transform duration-300", post.isLiked && "fill-current", isLikeAnimating ? "scale-[1.3]" : "scale-100")}
          />
          {post.likes > 0 && post.likes}
        </button>
        <button
          onClick={onToggleComments}
          aria-label="Toggle comments"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors",
            showComments ? "text-[var(--secondary)]" : "text-muted-foreground",
          )}
        >
          <MessageCircle size={18} strokeWidth={2} className={cn(showComments && "fill-[var(--secondary-dim)]")} />
          {(post.comments?.length || post.comment_count || 0) > 0 && (post.comments?.length || post.comment_count || 0)}
        </button>
      </div>

      {showComments && (
        <div className="px-[18px] pb-3.5">
          <Separator className="mb-1" />
          {(post.comments || []).map(c => (
            <div key={c.id} className="flex gap-2.5 py-2">
              <Avatar className="size-7 shrink-0">
                <AvatarImage src={c.user_avatar || getAvatar(c.user_id, null, null, c.user_name)} alt={c.user_name} />
                <AvatarFallback className="text-[10px]">{(c.user_name || "U").slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-baseline gap-1.5">
                  <span className="text-[12px] font-bold text-primary">{c.user_name}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-[13px] leading-snug break-words text-muted-foreground">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-2">
            <Avatar className="size-7 shrink-0">
              <AvatarImage src={user?.avatar} alt={user?.name || "Me"} />
              <AvatarFallback className="text-[10px]">{(user?.name || "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <Input
              value={commentInput}
              onChange={e => onCommentChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") onAddComment(); }}
              placeholder="Write a comment…"
              className="h-9 flex-1 rounded-full px-3.5 text-[13px]"
            />
            <Button
              onClick={onAddComment}
              disabled={!commentInput.trim()}
              size="icon-sm"
              aria-label="Send comment"
              className="rounded-full"
            >
              <Send size={14} strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
