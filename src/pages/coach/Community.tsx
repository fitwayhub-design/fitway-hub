import type React from "react";
import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect, useRef } from "react";
import { Heart, MessageSquare, Plus, X, TrendingUp, Users, Image as ImageIcon, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Comment {
  id: number; user_id: number; content: string; created_at: string;
  user_name: string; user_avatar: string;
}

interface Post {
  id: number; user_id: number; content: string; media_url: string | null;
  hashtags: string | null; likes: number; created_at: string;
  user_name: string; user_avatar: string; user_role: string; isLiked?: boolean;
  comments?: Comment[];
}

export default function CoachCommunity() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

  const api = (path: string, opts?: RequestInit) =>
    apiFetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

  const apiRaw = (path: string, opts?: RequestInit) =>
    apiFetch(path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

  const fetchPosts = async () => {
    try {
      const r = await api("/api/community/posts");
      if (r.ok) {
        const d = await r.json();
        const postList: Post[] = Array.isArray(d) ? d : [];
        // Fetch comments for each post
        const withComments = await Promise.all(postList.map(async (p) => {
          try {
            const cr = await api(`/api/community/posts/${p.id}/comments`);
            if (cr.ok) { const cd = await cr.json(); return { ...p, comments: Array.isArray(cd) ? cd : cd.comments || [] }; }
          } catch {}
          return { ...p, comments: [] };
        }));
        setPosts(withComments);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPosts(); }, []);
  useAutoRefresh(fetchPosts);

  const toggleLike = async (post: Post) => {
    const method = post.isLiked ? "DELETE" : "POST";
    await api(`/api/community/posts/${post.id}/like`, { method });
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 } : p));
  };

  const publishPost = async () => {
    if (!newContent.trim() && !selectedFile) return;
    try {
      const fd = new FormData();
      fd.append("content", newContent.trim());
      if (newTags.trim()) fd.append("hashtags", newTags.trim());
      if (selectedFile) fd.append("media", selectedFile);
      const r = await apiRaw("/api/community/posts", { method: "POST", body: fd });
      if (r.ok) {
        fetchPosts();
        setNewContent(""); setNewTags(""); setSelectedFile(null); setFilePreview(null); setShowCompose(false);
      }
    } catch {}
  };

  const deletePost = async (postId: number) => {
    if (!confirm("Delete this post?")) return;
    try {
      const r = await api(`/api/community/posts/${postId}`, { method: "DELETE" });
      if (r.ok) setPosts(ps => ps.filter(p => p.id !== postId));
    } catch {}
  };

  const submitComment = async (postId: number) => {
    const text = (commentInputs[postId] || "").trim();
    if (!text) return;
    try {
      const r = await api(`/api/community/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ content: text }) });
      if (r.ok) {
        setCommentInputs(ci => ({ ...ci, [postId]: "" }));
        // Refresh comments for this post
        const cr = await api(`/api/community/posts/${postId}/comments`);
        if (cr.ok) {
          const cd = await cr.json();
          setPosts(ps => ps.map(p => p.id === postId ? { ...p, comments: Array.isArray(cd) ? cd : cd.comments || [] } : p));
        }
      }
    } catch {}
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setFilePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleComments = (postId: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  };

  const coachPosts = posts.filter(p => p.user_role === "coach");
  const topTags = Array.from(new Set(posts.flatMap(p => (p.hashtags || "").split(" ").filter(t => t.startsWith("#"))))).slice(0, 6);
  const isAdmin = user?.role === "admin";
  const canDelete = (post: Post) => String(post.user_id) === String(user?.id) || isAdmin;

  const closeCompose = () => { setShowCompose(false); setSelectedFile(null); setFilePreview(null); };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-5 px-4 pb-4 lg:flex-row">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">{t("coach_community_title")}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("coach_community_subtitle")}</p>
          </div>
          <Button onClick={() => setShowCompose(true)} className="shrink-0">
            <Plus size={16} strokeWidth={2} /> {t("coach_community_post")}
          </Button>
        </div>

        {/* Compose prompt */}
        <Card className="flex flex-row items-center gap-3 p-3.5 shadow-soft-sm">
          <Avatar className="size-9 shrink-0">
            <AvatarImage src={user?.avatar} alt={user?.name || "Me"} />
            <AvatarFallback>{(user?.name || "C").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => setShowCompose(true)}
            className="flex-1 rounded-full bg-muted px-4 py-2.5 text-start text-[13px] text-muted-foreground transition active:scale-[0.99]"
          >
            {t("coach_community_share_placeholder")}
          </button>
        </Card>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
          </div>
        ) : posts.length === 0 ? (
          <Card className="py-10 text-center text-[14px] text-muted-foreground shadow-soft-sm">
            {t("coach_community_no_posts")}
          </Card>
        ) : (
          posts.map(post => (
            <Card key={post.id} className="gap-0 p-5 shadow-soft-sm">
              <div className="mb-3 flex gap-3">
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={post.user_avatar} alt={post.user_name} />
                  <AvatarFallback>{(post.user_name || "U").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold">{post.user_name}</p>
                    {post.user_role === "coach"
                      ? <Badge variant="accent">{t("role_coach")}</Badge>
                      : <Badge variant="muted">{t("athlete")}</Badge>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</p>
                </div>
                {canDelete(post) && (
                  <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground" onClick={() => deletePost(post.id)} aria-label="Delete post">
                    <Trash2 size={15} strokeWidth={2} />
                  </Button>
                )}
              </div>
              <p className="mb-3 text-[14px] leading-relaxed break-words whitespace-pre-wrap text-foreground">{post.content}</p>
              {post.media_url && <img src={post.media_url} alt="" className="mb-3 max-h-[300px] w-full rounded-md object-cover" />}
              {post.hashtags && (
                <div className="mb-3.5 flex flex-wrap gap-1.5">
                  {post.hashtags.split(" ").filter(t => t).map((tg, i) => (
                    <span key={i} className="text-[12px] font-semibold text-[var(--secondary)]">{tg.startsWith("#") ? tg : `#${tg}`}</span>
                  ))}
                </div>
              )}
              <Separator className="mb-1" />
              <div className="flex gap-1 pt-1.5">
                <button
                  onClick={() => toggleLike(post)}
                  aria-label={post.isLiked ? "Unlike post" : "Like post"}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${post.isLiked ? "text-destructive" : "text-muted-foreground"}`}
                >
                  <Heart size={16} strokeWidth={2} className={post.isLiked ? "fill-current" : ""} /> {post.likes}
                </button>
                <button
                  onClick={() => toggleComments(post.id)}
                  aria-label="Toggle comments"
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${expandedComments.has(post.id) ? "text-[var(--secondary)]" : "text-muted-foreground"}`}
                >
                  <MessageSquare size={16} strokeWidth={2} /> {(post.comments || []).length}
                </button>
              </div>

              {/* Comments section */}
              {expandedComments.has(post.id) && (
                <div className="mt-2">
                  <Separator className="mb-2" />
                  {(post.comments || []).map(c => (
                    <div key={c.id} className="mb-2.5 flex gap-2.5">
                      <Avatar className="size-7 shrink-0">
                        <AvatarImage src={c.user_avatar} alt={c.user_name} />
                        <AvatarFallback className="text-[10px]">{(c.user_name || "U").slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2">
                        <p className="mb-0.5 text-[12px] font-semibold">{c.user_name}</p>
                        <p className="text-[13px] leading-snug break-words text-muted-foreground">{c.content}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={commentInputs[post.id] || ""}
                      onChange={e => setCommentInputs(ci => ({ ...ci, [post.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") submitComment(post.id); }}
                      placeholder="Write a comment..."
                      className="h-9 flex-1 rounded-full px-3.5 text-[13px]"
                    />
                    <Button onClick={() => submitComment(post.id)} size="icon-sm" className="rounded-full" aria-label="Send comment">
                      <Send size={14} strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Compose Modal */}
      <Dialog open={showCompose} onOpenChange={(o) => { if (!o) closeCompose(); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("coach_community_post")}</DialogTitle>
          </DialogHeader>
          <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder={t("coach_community_share_placeholder")} rows={4} className="resize-none" />
          <Input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="#hashtags" className="text-[13px]" />

          {/* File preview */}
          {filePreview && (
            <div className="relative overflow-hidden rounded-md">
              <img src={filePreview} alt="Selected media preview" className="max-h-[200px] w-full object-cover" />
              <Button variant="ghost" size="icon-sm" className="absolute top-2 end-2 rounded-full bg-black/60 text-white hover:bg-black/70 hover:text-white" onClick={() => { setSelectedFile(null); setFilePreview(null); }} aria-label="Remove media">
                <X size={14} strokeWidth={2} />
              </Button>
            </div>
          )}

          <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
          <p className="text-[10px] text-muted-foreground">Image: JPG/PNG max 5 MB — Video: MP4 max 50 MB</p>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon size={14} strokeWidth={2} /> Add Photo/Video
            </Button>
            <Button onClick={publishPost} disabled={!newContent.trim() && !selectedFile}>
              {t("coach_community_post")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <aside className="hidden w-[260px] shrink-0 flex-col gap-4 lg:flex">
        {isAdmin && (
          <Card className="gap-0 p-5 shadow-soft-sm">
            <p className="mb-3.5 text-[13px] font-semibold">{t("coach_community_stats")}</p>
            {[
              { label: t("coach_community_total_posts"), value: posts.length, icon: MessageSquare },
              { label: t("coach_community_coach_posts"), value: coachPosts.length, icon: Users },
              { label: t("coach_community_total_likes"), value: posts.reduce((s, p) => s + p.likes, 0), icon: TrendingUp },
            ].map((s, i, arr) => {
              const Icon = s.icon;
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Icon size={14} strokeWidth={2} className="text-[var(--secondary)]" />
                      <span className="text-[13px] text-muted-foreground">{s.label}</span>
                    </div>
                    <span className="text-[14px] font-bold text-[var(--secondary)] tabular-nums">{s.value}</span>
                  </div>
                  {i < arr.length - 1 && <Separator />}
                </div>
              );
            })}
          </Card>
        )}
        {topTags.length > 0 && (
          <Card className="gap-0 p-5 shadow-soft-sm">
            <p className="mb-3 text-[13px] font-semibold">{t("coach_community_trending_topics")}</p>
            <div className="flex flex-col gap-2">
              {topTags.map((tag, i) => (
                <div key={tag} className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[var(--secondary)]">{tag}</span>
                  <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </aside>

      {/* Secondary compose modal (preserves original dual-render behavior) */}
      <Dialog open={showCompose} onOpenChange={(o) => { if (!o) setShowCompose(false); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("coach_community_create_post")}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-3">
            <Avatar className="size-10 shrink-0">
              <AvatarImage src={user?.avatar} alt={user?.name || "Me"} />
              <AvatarFallback>{(user?.name || "C").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">{user?.name || t("role_coach")}</p>
              <p className="text-[11px] text-[var(--secondary)]">{t("coach_community_fitness_coach")}</p>
            </div>
          </div>
          <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder={t("coach_community_compose_placeholder")} rows={5} className="resize-none" autoFocus />
          <div className="grid gap-2">
            <Label htmlFor="coach-community-tags">{t("coach_community_tags_label")}</Label>
            <Input id="coach-community-tags" value={newTags} onChange={e => setNewTags(e.target.value)} placeholder={t("coach_community_tags_placeholder")} />
          </div>
          <DialogFooter className="gap-2 sm:justify-stretch">
            <Button variant="outline" onClick={() => setShowCompose(false)} className="flex-1">{t("cancel")}</Button>
            <Button onClick={publishPost} disabled={!newContent.trim()} className="flex-[2]">{t("coach_community_publish_post")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
