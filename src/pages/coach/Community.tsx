import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect, useRef } from "react";
import { Heart, MessageSquare, Plus, X, TrendingUp, Users, Image as ImageIcon, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getAvatar } from "@/lib/avatar";

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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
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
    fetch(getApiBase() + path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

  const apiRaw = (path: string, opts?: RequestInit) =>
    fetch(getApiBase() + path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts?.headers || {}) } });

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

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 20, alignItems: "flex-start" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-en)", fontSize: "clamp(18px,4vw,26px)", fontWeight: 700 }}>{t("coach_community_title")}</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>{t("coach_community_subtitle")}</p>
          </div>
          <button onClick={() => setShowCompose(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: "var(--radius-full)", background: "var(--blue)", border: "none", color: "#fff", fontFamily: "var(--font-en)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Plus size={15} /> {t("coach_community_post")}
          </button>
        </div>

        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
          <img src={user?.avatar || getAvatar(user?.email, null, null, user?.name)} alt="" style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: "var(--bg-surface)" }} />
          <button onClick={() => setShowCompose(true)} style={{ flex: 1, textAlign: "start", padding: "10px 14px", borderRadius: "var(--radius-full)", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>
            {t("coach_community_share_placeholder")}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>{t("coach_community_loading_posts")}</div>
        ) : posts.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", color: "var(--text-muted)", fontSize: 14 }}>
            {t("coach_community_no_posts")}
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "18px 20px" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <img src={post.user_avatar || getAvatar(post.user_name)} alt={post.user_name} style={{ width: 42, height: 42, borderRadius: "50%", backgroundColor: "var(--bg-surface)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-en)", fontSize: 14, fontWeight: 700 }}>{post.user_name}</p>
                    <span style={{ fontSize: 11, color: post.user_role === "coach" ? "var(--blue)" : "var(--text-muted)", backgroundColor: post.user_role === "coach" ? "rgba(59,139,255,0.1)" : "var(--bg-surface)", padding: "2px 8px", borderRadius: "var(--radius-full)", border: `1px solid ${post.user_role === "coach" ? "rgba(59,139,255,0.2)" : "var(--border)"}` }}>
                      {post.user_role === "coach" ? t("role_coach") : t("athlete")}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{new Date(post.created_at).toLocaleDateString()}</p>
                </div>
                {canDelete(post) && (
                  <button onClick={() => deletePost(post.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Delete post">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7, marginBottom: 12 }}>{post.content}</p>
              {post.media_url && <img src={post.media_url} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: "var(--radius-full)", marginBottom: 12 }} />}
              {post.hashtags && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>{post.hashtags.split(" ").filter(t => t).map((tg, i) => <span key={i} style={{ fontSize: 12, color: "var(--blue)", cursor: "pointer" }}>{tg.startsWith("#") ? tg : `#${tg}`}</span>)}</div>}
              <div style={{ display: "flex", gap: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <button onClick={() => toggleLike(post)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: post.isLiked ? "var(--red)" : "var(--text-muted)", fontWeight: post.isLiked ? 600 : 400 }}>
                  <Heart size={15} style={{ fill: post.isLiked ? "var(--red)" : "none", stroke: post.isLiked ? "var(--red)" : "currentColor" }} /> {post.likes}
                </button>
                <button onClick={() => toggleComments(post.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: expandedComments.has(post.id) ? "var(--blue)" : "var(--text-muted)" }}>
                  <MessageSquare size={15} /> {(post.comments || []).length}
                </button>
              </div>

              {/* Comments section */}
              {expandedComments.has(post.id) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  {(post.comments || []).map(c => (
                    <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <img src={c.user_avatar || getAvatar(c.user_name)} alt="" style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "var(--bg-surface)", flexShrink: 0 }} />
                      <div style={{ flex: 1, backgroundColor: "var(--bg-surface)", borderRadius: 12, padding: "8px 12px" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{c.user_name}</p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{c.content}</p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      value={commentInputs[post.id] || ""}
                      onChange={e => setCommentInputs(ci => ({ ...ci, [post.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") submitComment(post.id); }}
                      placeholder="Write a comment..."
                      className="input-base"
                      style={{ flex: 1, fontSize: 13, padding: "8px 12px" }}
                    />
                    <button onClick={() => submitComment(post.id)} style={{ background: "var(--blue)", border: "none", borderRadius: "var(--radius-full)", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Send size={14} color="#fff" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: 24, width: "100%", maxWidth: 520 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontFamily: "var(--font-en)", fontSize: 16, fontWeight: 700 }}>{t("coach_community_post")}</p>
              <button onClick={() => { setShowCompose(false); setSelectedFile(null); setFilePreview(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder={t("coach_community_share_placeholder")} rows={4} className="input-base" style={{ resize: "none", marginBottom: 10, fontSize: 14 }} />
            <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="#hashtags" className="input-base" style={{ marginBottom: 10, fontSize: 13 }} />

            {/* File preview */}
            {filePreview && (
              <div style={{ position: "relative", marginBottom: 10 }}>
                <img src={filePreview} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12 }} />
                <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={14} />
                </button>
              </div>
            )}

            <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleFileSelect} style={{ display: "none" }} />
            <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Image: JPG/PNG max 5 MB — Video: MP4 max 50 MB</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => fileInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--radius-full)", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>
                <ImageIcon size={14} /> Add Photo/Video
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={publishPost} disabled={!newContent.trim() && !selectedFile} style={{ padding: "10px 22px", borderRadius: "var(--radius-full)", background: "var(--blue)", border: "none", color: "#fff", fontFamily: "var(--font-en)", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: (!newContent.trim() && !selectedFile) ? 0.5 : 1 }}>
                {t("coach_community_post")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:flex" style={{ width: 260, flexDirection: "column", gap: 14, flexShrink: 0, position: "sticky", top: 20 }}>
        {isAdmin && (
        <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "18px 18px" }}>
          <p style={{ fontFamily: "var(--font-en)", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{t("coach_community_stats")}</p>
          {[{ label: t("coach_community_total_posts"), value: posts.length, icon: MessageSquare }, { label: t("coach_community_coach_posts"), value: coachPosts.length, icon: Users }, { label: t("coach_community_total_likes"), value: posts.reduce((s, p) => s + p.likes, 0), icon: TrendingUp }].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <s.icon size={14} color="var(--blue)" />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.label}</span>
              </div>
              <span style={{ fontFamily: "var(--font-en)", fontSize: 14, fontWeight: 700, color: "var(--blue)" }}>{s.value}</span>
            </div>
          ))}
        </div>
        )}
        {topTags.length > 0 && (
          <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "18px" }}>
            <p style={{ fontFamily: "var(--font-en)", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t("coach_community_trending_topics")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topTags.map((tag, i) => (
                <div key={tag} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--blue)", cursor: "pointer" }}>{tag}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>#{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCompose && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: 28, width: "100%", maxWidth: 520, maxHeight: "90dvh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ fontFamily: "var(--font-en)", fontSize: 16, fontWeight: 700 }}>{t("coach_community_create_post")}</p>
              <button onClick={() => setShowCompose(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <img src={user?.avatar || getAvatar(user?.email, null, null, user?.name)} alt="" style={{ width: 42, height: 42, borderRadius: "50%", backgroundColor: "var(--bg-surface)" }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--font-en)", fontSize: 13, fontWeight: 700 }}>{user?.name || t("role_coach")}</p>
                <p style={{ fontSize: 11, color: "var(--blue)" }}>{t("coach_community_fitness_coach")}</p>
              </div>
            </div>
            <textarea className="input-base" value={newContent} onChange={e => setNewContent(e.target.value)} placeholder={t("coach_community_compose_placeholder")} rows={5} style={{ resize: "none", marginBottom: 12, fontSize: 14 }} autoFocus />
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("coach_community_tags_label")}</label>
              <input className="input-base" value={newTags} onChange={e => setNewTags(e.target.value)} placeholder={t("coach_community_tags_placeholder")} style={{ marginBottom: 16 }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCompose(false)} style={{ flex: 1, padding: "11px", borderRadius: "var(--radius-full)", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>{t("cancel")}</button>
              <button onClick={publishPost} disabled={!newContent.trim()} style={{ flex: 2, padding: "11px", borderRadius: "var(--radius-full)", background: newContent.trim() ? "var(--blue)" : "var(--bg-surface)", border: `1px solid ${newContent.trim() ? "var(--blue)" : "var(--border)"}`, color: newContent.trim() ? "#fff" : "var(--text-muted)", fontFamily: "var(--font-en)", fontWeight: 700, fontSize: 14, cursor: newContent.trim() ? "pointer" : "default" }}>{t("coach_community_publish_post")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
