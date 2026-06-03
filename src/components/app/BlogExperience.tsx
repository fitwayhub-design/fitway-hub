import { useEffect, useMemo, useRef, useState } from "react";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import DOMPurify from "dompurify";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  PenSquare,
  PlayCircle,
  Quote,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Eye,
  Check,
  X,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";
import {
  type BlogPost,
  type BlogStatus,
  fetchBlogs,
  fetchPublicBlogs,
  removeBlog,
  resolveMediaUrl,
  saveBlog,
} from "@/lib/blogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BlogExperienceProps {
  mode: "website" | "app" | "coach" | "admin";
  heading: string;
  subheading: string;
  allowWriting?: boolean;
}

interface DraftState {
  title: string;
  excerpt: string;
  content: string;
  status: BlogStatus;
}

const defaultDraft: DraftState = {
  title: "",
  excerpt: "",
  content: "",
  status: "draft",
};

function markdownToHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^-\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

function toDate(value: string | null, lang: "en" | "ar"): string {
  if (!value) return lang === "ar" ? "غير منشور" : "Unpublished";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? (lang === "ar" ? "غير منشور" : "Unpublished") : date.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US");
}

function estimateReadMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export default function BlogExperience({ mode, heading, subheading, allowWriting = false }: BlogExperienceProps) {
  const { token, user } = useAuth();
  const { t, lang } = useI18n();
  const canWrite = allowWriting && !!token && (user?.role === "coach" || user?.role === "admin");
  const blogText = {
    loadFailed: lang === "ar" ? "فشل تحميل المقالات" : "Failed to load blog posts",
    signinNeeded: lang === "ar" ? "لازم تكون مسجل دخول." : "You need to be signed in.",
    titleContentRequired: lang === "ar" ? "العنوان والمحتوى مطلوبين." : "Title and content are required.",
    saveFailed: lang === "ar" ? "فشل حفظ المقال" : "Failed to save post",
    deleteConfirm: lang === "ar" ? "تحذف المقال ده؟" : "Delete this post?",
    deleteFailed: lang === "ar" ? "فشل حذف المقال" : "Failed to delete post",
    readerView: lang === "ar" ? "وضع القراءة" : "Reader View",
    writerStudio: lang === "ar" ? "استوديو الكتابة" : "Writer Studio",
    newPost: lang === "ar" ? "مقال جديد" : "New Post",
    loadingPosts: lang === "ar" ? "جارٍ تحميل المقالات..." : "Loading posts...",
    noPosts: lang === "ar" ? "مفيش مقالات." : "No posts found.",
    noExcerpt: lang === "ar" ? "مفيش ملخص" : "No excerpt",
    unknown: lang === "ar" ? "غير معروف" : "Unknown",
    by: lang === "ar" ? "بواسطة" : "By",
    minRead: lang === "ar" ? "دقايق قراءة" : "min read",
    selectPost: lang === "ar" ? "اختار مقال عشان تبدأ تقرأ." : "Select a post to start reading.",
    editPost: lang === "ar" ? "تعديل المقال" : "Edit Blog Post",
    writePost: lang === "ar" ? "اكتب مقال جديد" : "Write New Blog Post",
    editor: lang === "ar" ? "المحرر" : "Editor",
    close: lang === "ar" ? "قفل" : "Close",
    postTitle: lang === "ar" ? "عنوان المقال" : "Post title",
    postExcerpt: lang === "ar" ? "ملخص قصير للكروت ومعاينات السوشيال" : "Short excerpt for cards and social previews",
    writeArticle: lang === "ar" ? "اكتب مقالك..." : "Write your article...",
    words: lang === "ar" ? "كلمة" : "words",
    autosave: lang === "ar" ? "حفظ تلقائي شغال" : "Autosave enabled",
    tipSave: lang === "ar" ? "نصيحة: اضغط Ctrl/Cmd + S لحفظ المسودة" : "Tip: press Ctrl/Cmd + S to save draft",
    headerImage: lang === "ar" ? "صورة الغلاف" : "Header Image",
    uploadHeader: lang === "ar" ? "ارفع صورة الغلاف" : "Upload header image",
    headerHint: lang === "ar" ? "مقاس 16:9 يطلع أنضف في الواجهة." : "Use 16:9 for clean hero visuals.",
    videoUpload: lang === "ar" ? "رفع فيديو" : "Video Upload",
    uploadVideo: lang === "ar" ? "ارفع فيديو للمقال" : "Upload article video",
    videoHint: lang === "ar" ? "يفضل MP4 عشان يشتغل كويس على المتصفح." : "MP4 recommended for browser compatibility.",
    removeHeader: lang === "ar" ? "امسح صورة الغلاف الحالية" : "Remove current header image",
    removeVideo: lang === "ar" ? "امسح الفيديو الحالي" : "Remove current video",
    saveDraft: lang === "ar" ? "احفظ مسودة" : "Save Draft",
    saving: lang === "ar" ? "جارٍ الحفظ..." : "Saving...",
    publish: lang === "ar" ? "انشر" : "Publish",
  };

  const [activeTab, setActiveTab] = useState<"feed" | "manage">(canWrite ? "manage" : "feed");
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [draft, setDraft] = useState<DraftState>(defaultDraft);
  const [draftEn, setDraftEn] = useState<DraftState>(defaultDraft);
  const [draftAr, setDraftAr] = useState<DraftState>(defaultDraft);
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [relatedBlogId, setRelatedBlogId] = useState<number | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [removeHeaderImage, setRemoveHeaderImage] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // Detect video duration client-side when file is selected
  const handleVideoFileChange = (file: File | null) => {
    setVideoFile(file);
    setVideoDuration(null);

    if (!file) return;

    // Use HTML5 video API to detect duration
    const reader = new FileReader();
    reader.onload = (e) => {
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        setVideoDuration(Math.round(video.duration));
      };
      video.onerror = () => {
        // If duration detection fails, it will be null - backend will try to detect it
        console.warn("Failed to detect video duration client-side");
      };
      video.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const draftKeyEn = useMemo(
    () => `fitway_blog_draft_en_${mode}_${user?.id || "guest"}`,
    [mode, user?.id]
  );

  const draftKeyAr = useMemo(
    () => `fitway_blog_draft_ar_${mode}_${user?.id || "guest"}`,
    [mode, user?.id]
  );

  async function loadPosts() {
    setLoading(true);
    setError("");
    try {
      let nextPosts: BlogPost[] = [];
      const displayLang = lang as "en" | "ar";

      if (mode === "website") {
        nextPosts = await fetchPublicBlogs(query, displayLang);
      } else if (!token) {
        nextPosts = await fetchPublicBlogs(query, displayLang);
      } else if (canWrite && activeTab === "manage") {
        nextPosts = await fetchBlogs(token, "manage", query, displayLang);
      } else {
        nextPosts = await fetchBlogs(token, "feed", query, displayLang);
      }

      setPosts(nextPosts);
      setSelectedId((prev) => prev || nextPosts[0]?.id || null);
    } catch (err: any) {
      setError(err.message || blogText.loadFailed);
      setPosts([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadPosts(), 220);
    return () => window.clearTimeout(timer);
  }, [query, activeTab, token, mode, canWrite, lang]);
  useAutoRefresh(loadPosts);

  useEffect(() => {
    if (!showEditor || editingPost) return;
    try {
      const rawEn = localStorage.getItem(draftKeyEn);
      const rawAr = localStorage.getItem(draftKeyAr);

      if (rawEn) {
        const parsedEn = JSON.parse(rawEn);
        setDraftEn({ ...defaultDraft, ...parsedEn });
      }

      if (rawAr) {
        const parsedAr = JSON.parse(rawAr);
        setDraftAr({ ...defaultDraft, ...parsedAr });
      }

      // Load the draft for the current language
      if (language === "en" && rawEn) {
        const parsedEn = JSON.parse(rawEn);
        setDraft({ ...defaultDraft, ...parsedEn });
      } else if (language === "ar" && rawAr) {
        const parsedAr = JSON.parse(rawAr);
        setDraft({ ...defaultDraft, ...parsedAr });
      }
    } catch {
      // Ignore draft hydration errors.
    }
  }, [showEditor, editingPost, draftKeyEn, draftKeyAr, language]);

  useEffect(() => {
    if (!showEditor || editingPost) return;
    const timer = window.setTimeout(() => {
      try {
        // Save to the appropriate language draft
        if (language === "en") {
          localStorage.setItem(draftKeyEn, JSON.stringify(draft));
          setDraftEn(draft);
        } else {
          localStorage.setItem(draftKeyAr, JSON.stringify(draft));
          setDraftAr(draft);
        }
      } catch {
        // ignore storage errors
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, showEditor, editingPost, language, draftKeyEn, draftKeyAr]);

  useEffect(() => {
    if (!showEditor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saving && canWrite) {
          void onSave("draft");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showEditor, saving, canWrite, draft, headerFile, videoFile, removeHeaderImage, removeVideo, editingPost]);

  function openNewEditor() {
    setEditingPost(null);
    setLanguage("en");
    setRelatedBlogId(null);

    // Load saved drafts from localStorage
    try {
      const rawEn = localStorage.getItem(draftKeyEn);
      const rawAr = localStorage.getItem(draftKeyAr);

      if (rawEn) {
        const parsedEn = JSON.parse(rawEn);
        setDraftEn({ ...defaultDraft, ...parsedEn });
        setDraft({ ...defaultDraft, ...parsedEn }); // Start with English draft
      } else {
        setDraftEn(defaultDraft);
        setDraft(defaultDraft);
      }

      if (rawAr) {
        const parsedAr = JSON.parse(rawAr);
        setDraftAr({ ...defaultDraft, ...parsedAr });
      } else {
        setDraftAr(defaultDraft);
      }
    } catch {
      setDraftEn(defaultDraft);
      setDraftAr(defaultDraft);
      setDraft(defaultDraft);
    }

    setHeaderFile(null);
    setVideoFile(null);
    setVideoDuration(null);
    setUploadProgress(0);
    setRemoveHeaderImage(false);
    setRemoveVideo(false);
    setPreviewMode(false);
    setShowEditor(true);
  }

  function openEditEditor(post: BlogPost) {
    setEditingPost(post);
    setDraft({
      title: post.title,
      excerpt: post.excerpt || "",
      content: post.content || "",
      status: post.status,
    });
    setLanguage(post.language || "en");
    setRelatedBlogId(post.related_blog_id || null);
    setHeaderFile(null);
    setVideoFile(null);
    setVideoDuration(null);
    setUploadProgress(0);
    setRemoveHeaderImage(false);
    setRemoveVideo(false);
    setPreviewMode(false);
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingPost(null);
    setSaving(false);
    setUploadProgress(0);
    setLanguage("en");
    setRelatedBlogId(null);
    setDraftEn(defaultDraft);
    setDraftAr(defaultDraft);
    setDraft(defaultDraft);
  }

  function insertSyntax(before: string, after = "", placeholder = "text") {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.content.slice(start, end) || placeholder;
    const next = `${draft.content.slice(0, start)}${before}${selected}${after}${draft.content.slice(end)}`;

    setDraft((prev) => ({ ...prev, content: next }));

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function onSave(status: BlogStatus) {
    if (!token) {
      setError(blogText.signinNeeded);
      return;
    }

    if (!draft.title.trim() || !draft.content.trim()) {
      setError(blogText.titleContentRequired);
      return;
    }

    setSaving(true);
    setError("");
    setUploadProgress(0);

    try {
      const saved = await saveBlog(
        token,
        {
          ...draft,
          status,
          language,
          relatedBlogId,
          headerImage: headerFile,
          video: videoFile,
          videoDuration,
          removeHeaderImage,
          removeVideo,
        },
        editingPost?.id,
        (percentage) => setUploadProgress(percentage)
      );

      localStorage.removeItem(draftKeyEn);
      localStorage.removeItem(draftKeyAr);
      closeEditor();
      await loadPosts();
      setSelectedId(saved.id);
    } catch (err: any) {
      setError(err.message || blogText.saveFailed);
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  async function onDelete(postId: number) {
    if (!token) return;
    if (!window.confirm(blogText.deleteConfirm)) return;

    try {
      await removeBlog(token, postId);
      await loadPosts();
    } catch (err: any) {
      setError(err.message || blogText.deleteFailed);
    }
  }

  async function onReviewBlog(postId: number, action: "approve" | "reject") {
    if (!token || mode !== "admin") return;
    try {
      const r = await fetch(`${getApiBase()}/api/blogs/${postId}/review`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error("Failed");
      await loadPosts();
    } catch (err: any) {
      setError(err.message || "Failed to review blog");
    }
  }

  const words = draft.content.trim().split(/\s+/).filter(Boolean).length;
  const readMinutes = estimateReadMinutes(draft.content);

  /* ── Website mode keeps the public-site design language (untouched) ── */
  if (mode === "website") {
    return (
      <section style={{ padding: "140px 24px 56px", display: "grid", gap: 24, maxWidth: 1400, margin: "0 auto", borderBottom: "1px solid var(--border)" }}>
        <header style={{ display: "grid", gap: 18 }}>
          <div className="fwh-section-meta">
            <span>{lang === "ar" ? "المدونة · ٢٠٢٦" : "JOURNAL · V.2026"}</span>
            <span>{lang === "ar" ? "آخر المقالات" : "Latest writing"}</span>
          </div>
          <span className="fwh-kicker">{lang === "ar" ? "— المدونة" : "— The Journal"}</span>
          <h1 className="fwh-hero-h1" style={{ fontSize: "clamp(48px, 8vw, 120px)", margin: 0 }}>
            {heading}
          </h1>
          <p className="fwh-hero-sub" style={{ margin: 0, maxWidth: 720 }}>{subheading}</p>
        </header>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-full)",
            padding: "10px 12px",
            minWidth: 260,
            flex: 1,
          }}>
            <Search size={16} color="var(--text-secondary)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search_placeholder") || (lang === "ar" ? "ابحث في المقالات" : "Search blogs")}
              style={{ border: "none", background: "transparent", color: "var(--text-primary)", width: "100%", outline: "none" }}
            />
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.35)", color: "#ff8f8f", borderRadius: "var(--radius-full)", padding: "10px 12px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-full)",
            padding: 60,
            color: "var(--text-secondary)",
            textAlign: "center"
          }}>
            {blogText.loadingPosts}
          </div>
        ) : posts.length === 0 ? (
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-full)",
            padding: 60,
            color: "var(--text-secondary)",
            textAlign: "center"
          }}>
            {blogText.noPosts}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20
          }}>
            {posts.map((post) => {
              const blogUrl = `/blogs/${post.slug}`;
              return (
                <div
                  key={post.id}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-full)",
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onClick={() => {
                    window.location.href = blogUrl;
                  }}
                >
                  <div style={{
                    width: "100%",
                    height: 200,
                    background: post.header_image_url
                      ? `url(${resolveMediaUrl(post.header_image_url)})`
                      : "linear-gradient(135deg, var(--accent-dim) 0%, var(--bg-surface) 100%)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    position: "relative"
                  }}>
                    <div style={{
                      position: "absolute",
                      top: 10,
                      left: lang === "ar" ? "auto" : 10,
                      right: lang === "ar" ? 10 : "auto",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-full)",
                      background: "rgba(0, 0, 0, 0.6)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      {post.language === "ar" ? "🇸🇦 AR" : "🇬🇧 EN"}
                    </div>
                  </div>

                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      lineHeight: 1.3,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}>
                      {post.title}
                    </h3>

                    {post.excerpt && (
                      <p style={{
                        margin: 0,
                        fontSize: 14,
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}>
                        {post.excerpt}
                      </p>
                    )}

                    <div style={{
                      marginTop: "auto",
                      paddingTop: 10,
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      fontSize: 13,
                      color: "var(--text-muted)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                        {post.author_avatar ? (
                          <img
                            src={resolveMediaUrl(post.author_avatar)}
                            alt={post.author_name || ""}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              objectFit: "cover"
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "var(--accent-dim)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--accent)"
                          }}>
                            {(post.author_name || "U")[0].toUpperCase()}
                          </div>
                        )}
                        <span style={{
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          {post.author_name || blogText.unknown}
                        </span>
                      </div>

                      <span style={{ whiteSpace: "nowrap" }}>
                        {toDate(post.published_at || post.created_at, lang)}
                      </span>

                      <span style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <Eye size={13} /> {(post.views || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  /* ── App / Coach / Admin — Apple-HIG, dark-first design ── */
  const statusBadge = (status: BlogStatus) => {
    if (status === "published") {
      return (
        <Badge variant="success" className="gap-1">
          <Check size={12} strokeWidth={2} /> {lang === "ar" ? "منشور" : "Published"}
        </Badge>
      );
    }
    if (status === "pending_review") {
      return (
        <Badge variant="accent" className="gap-1">
          <Clock size={12} strokeWidth={2} /> {lang === "ar" ? "قيد المراجعة" : "Pending Review"}
        </Badge>
      );
    }
    return (
      <Badge variant="warning" className="gap-1">
        <PenSquare size={12} strokeWidth={2} /> {lang === "ar" ? "مسودة" : "Draft"}
      </Badge>
    );
  };

  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-5">
      <div className="space-y-6">
        {/* Header */}
        <header className="space-y-1.5 pt-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{heading}</h1>
          <p className="text-[15px] text-muted-foreground">{subheading}</p>
        </header>

        {/* Toolbar: search + writer controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[260px] flex-1">
            <Search
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search_placeholder") || (lang === "ar" ? "ابحث في المقالات" : "Search blogs")}
              className="ps-10"
              aria-label={t("search_placeholder") || "Search blogs"}
            />
          </div>

          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={activeTab === "feed" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("feed")}
                className="rounded-full"
              >
                {blogText.readerView}
              </Button>
              <Button
                variant={activeTab === "manage" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("manage")}
                className="rounded-full"
              >
                {blogText.writerStudio}
              </Button>
              <Button size="sm" onClick={openNewEditor} className="rounded-full">
                <PenSquare size={16} strokeWidth={2} /> {blogText.newPost}
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 px-4 py-3 text-[13px] font-medium text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="gap-0 overflow-hidden p-0">
                <Skeleton className="h-[200px] w-full rounded-none" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-5 w-4/5 rounded-md" />
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                </div>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="items-center gap-2 p-12 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-muted">
              <Eye size={24} strokeWidth={2} className="text-muted-foreground" />
            </div>
            <p className="text-[15px] font-semibold text-foreground">{blogText.noPosts}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
            {posts.map((post) => {
              const blogUrl = mode === "app"
                ? `/app/blogs/${post.slug}`
                : mode === "coach"
                ? `/coach/blogs/${post.slug}`
                : `/admin/blogs/${post.slug}`;
              const isManage = canWrite && activeTab === "manage";

              return (
                <Card
                  key={post.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isManage) {
                      setSelectedId(post.id);
                      openEditEditor(post);
                    } else {
                      window.location.href = blogUrl;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isManage) {
                        setSelectedId(post.id);
                        openEditEditor(post);
                      } else {
                        window.location.href = blogUrl;
                      }
                    }
                  }}
                  className={cn(
                    "group cursor-pointer gap-0 overflow-hidden p-0 outline-none transition active:scale-[0.99] hover:shadow-soft-md focus-visible:ring-2 focus-visible:ring-ring/60",
                    selectedId === post.id && isManage && "ring-2 ring-primary/40",
                  )}
                >
                  {/* Featured image */}
                  <div className="relative h-[200px] w-full overflow-hidden bg-muted">
                    {post.header_image_url ? (
                      <img
                        src={resolveMediaUrl(post.header_image_url)}
                        alt={post.title}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="size-full bg-gradient-to-br from-primary/20 to-[var(--secondary-dim)]" />
                    )}

                    {/* Status badge (manage) */}
                    {isManage && (
                      <div className="absolute top-2.5 end-2.5">{statusBadge(post.status)}</div>
                    )}

                    {/* Language badge */}
                    <span className="absolute top-2.5 start-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                      {post.language === "ar" ? "🇸🇦 AR" : "🇬🇧 EN"}
                    </span>
                  </div>

                  {/* Card content */}
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">
                      {post.title}
                    </h3>

                    {post.excerpt && (
                      <p className="line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="mt-auto flex items-center gap-3 pt-3 text-[13px] text-muted-foreground">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Avatar className="size-6">
                          {post.author_avatar && (
                            <AvatarImage src={resolveMediaUrl(post.author_avatar)} alt={post.author_name || ""} />
                          )}
                          <AvatarFallback className="bg-primary/15 text-[11px] font-bold text-primary">
                            {(post.author_name || "U")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">{post.author_name || blogText.unknown}</span>
                      </div>

                      <span className="whitespace-nowrap">{toDate(post.published_at || post.created_at, lang)}</span>

                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <Eye size={13} strokeWidth={2} /> {(post.views || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Manage actions */}
                    {isManage && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {mode === "admin" && post.status === "pending_review" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); onReviewBlog(post.id, "approve"); }}
                              className="flex-1 text-[var(--green)]"
                            >
                              <Check size={14} strokeWidth={2} /> {lang === "ar" ? "موافقة" : "Approve"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); onReviewBlog(post.id, "reject"); }}
                              className="flex-1 text-destructive"
                            >
                              <X size={14} strokeWidth={2} /> {lang === "ar" ? "رفض" : "Reject"}
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openEditEditor(post); }}
                          className="flex-1"
                        >
                          {t("edit")}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={t("delete") || "Delete"}
                          onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
                          className="text-destructive"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Writer Studio editor (modal) ── */}
      {showEditor && canWrite && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 p-4 backdrop-blur-[3px]">
          <Card className="mx-auto max-w-[1160px] gap-3 p-4 shadow-soft-lg sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h3 className="text-[22px] font-bold tracking-tight">{editingPost ? blogText.editPost : blogText.writePost}</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewMode((prev) => !prev)}>
                  <Sparkles size={14} strokeWidth={2} /> {previewMode ? blogText.editor : t("preview")}
                </Button>
                <Button variant="ghost" size="sm" onClick={closeEditor} aria-label={blogText.close}>
                  <X size={16} strokeWidth={2} /> {blogText.close}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              {/* Editor column */}
              <section className="grid content-start gap-2.5 rounded-lg bg-muted/40 p-4">
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={blogText.postTitle}
                  className="bg-card text-[18px] font-bold"
                  aria-label={blogText.postTitle}
                />
                <Textarea
                  value={draft.excerpt}
                  onChange={(e) => setDraft((prev) => ({ ...prev, excerpt: e.target.value }))}
                  placeholder={blogText.postExcerpt}
                  className="min-h-[84px] bg-card"
                  aria-label={blogText.postExcerpt}
                />

                {/* Markdown toolbar */}
                <div className="flex flex-wrap gap-2 py-1">
                  <Button variant="outline" size="icon-sm" onClick={() => insertSyntax("## ", "", "Section title")} aria-label="Heading 2"><Heading2 size={14} strokeWidth={2} /></Button>
                  <Button variant="outline" size="icon-sm" onClick={() => insertSyntax("### ", "", "Sub-section")} aria-label="Heading 3"><Heading3 size={14} strokeWidth={2} /></Button>
                  <Button variant="outline" size="icon-sm" onClick={() => insertSyntax("**", "**", "bold")} aria-label="Bold"><Bold size={14} strokeWidth={2} /></Button>
                  <Button variant="outline" size="icon-sm" onClick={() => insertSyntax("*", "*", "italic")} aria-label="Italic"><Italic size={14} strokeWidth={2} /></Button>
                  <Button variant="outline" size="icon-sm" onClick={() => insertSyntax("- ", "", "list item")} aria-label="Bulleted list"><List size={14} strokeWidth={2} /></Button>
                  <Button variant="outline" size="icon-sm" onClick={() => insertSyntax("1. ", "", "list item")} aria-label="Numbered list"><ListOrdered size={14} strokeWidth={2} /></Button>
                  <Button variant="outline" size="icon-sm" onClick={() => insertSyntax("> ", "", "quote")} aria-label="Quote"><Quote size={14} strokeWidth={2} /></Button>
                  <Button variant="outline" size="icon-sm" onClick={() => insertSyntax("[", "](https://)", "link text")} aria-label="Link"><LinkIcon size={14} strokeWidth={2} /></Button>
                </div>

                {!previewMode ? (
                  <Textarea
                    ref={editorRef}
                    value={draft.content}
                    onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder={blogText.writeArticle}
                    className="min-h-[340px] resize-y bg-card leading-relaxed"
                    aria-label={blogText.writeArticle}
                  />
                ) : (
                  <div className="min-h-[340px] rounded-md bg-card p-4">
                    <div
                      className="mx-auto max-w-[68ch] space-y-3 text-[15px] leading-relaxed text-foreground [&_a]:text-[var(--secondary)] [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h2]:text-[20px] [&_h2]:font-bold [&_h3]:text-[17px] [&_h3]:font-semibold [&_li]:ms-5 [&_li]:list-disc"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(markdownToHtml(draft.content)) }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-2.5 text-[12px] text-muted-foreground">
                  <span>{words} {blogText.words} • {readMinutes} {blogText.minRead} • {blogText.autosave}</span>
                  <span>{blogText.tipSave}</span>
                </div>
              </section>

              {/* Sidebar column */}
              <aside className="grid content-start gap-4 rounded-lg bg-muted/40 p-4">
                <div className="grid gap-2">
                  <span className="text-[13px] font-medium text-muted-foreground">Language</span>
                  <div className="flex gap-2">
                    <Button
                      variant={language === "en" ? "secondary" : "outline"}
                      size="sm"
                      disabled={!!editingPost}
                      onClick={() => {
                        if (!editingPost) {
                          // Save current draft before switching
                          if (language === "ar") {
                            setDraftAr(draft);
                            localStorage.setItem(draftKeyAr, JSON.stringify(draft));
                          }

                          // Switch to English and load English draft
                          setLanguage("en");
                          setDraft(draftEn);
                        }
                      }}
                      className="flex-1"
                    >
                      🇬🇧 English
                    </Button>
                    <Button
                      variant={language === "ar" ? "secondary" : "outline"}
                      size="sm"
                      disabled={!!editingPost}
                      onClick={() => {
                        if (!editingPost) {
                          // Save current draft before switching
                          if (language === "en") {
                            setDraftEn(draft);
                            localStorage.setItem(draftKeyEn, JSON.stringify(draft));
                          }

                          // Switch to Arabic and load Arabic draft
                          setLanguage("ar");
                          setDraft(draftAr);
                        }
                      }}
                      className="flex-1"
                    >
                      🇸🇦 العربية
                    </Button>
                  </div>
                  {!editingPost && (
                    <p className="text-[11px] text-muted-foreground">
                      {lang === "ar" ? "يمكنك التبديل بين اللغتين - سيتم حفظ كل نسخة تلقائيًا" : "You can switch between languages - each version is saved separately"}
                    </p>
                  )}
                  {editingPost && (
                    <p className="text-[11px] text-muted-foreground">
                      {lang === "ar" ? "لا يمكن تغيير لغة المقال بعد إنشائه" : "Cannot change language after creation"}
                    </p>
                  )}
                  {!editingPost && (
                    <Select
                      value={relatedBlogId ? String(relatedBlogId) : "none"}
                      onValueChange={(v) => setRelatedBlogId(v && v !== "none" ? Number(v) : null)}
                    >
                      <SelectTrigger size="sm" className="w-full bg-card">
                        <SelectValue placeholder={language === "ar" ? "لا توجد نسخة مرتبطة" : "No related version"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{language === "ar" ? "لا توجد نسخة مرتبطة" : "No related version"}</SelectItem>
                        {posts
                          .filter((p) => p.language !== language && !p.related_blog_id)
                          .map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {language === "ar" ? "ربط بـ" : "Link to"}: {p.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Header image upload */}
                <div className="grid gap-2">
                  <span className="text-[13px] font-medium text-muted-foreground">{blogText.headerImage}</span>
                  <label className="grid cursor-pointer gap-1.5 rounded-md bg-card p-3 ring-1 ring-inset ring-border transition-colors hover:bg-accent">
                    <input type="file" accept="image/*" onChange={(e) => setHeaderFile(e.target.files?.[0] || null)} className="hidden" />
                    <span className="flex items-center gap-2 text-[13px] text-foreground"><ImageIcon size={14} strokeWidth={2} /> {headerFile ? headerFile.name : blogText.uploadHeader}</span>
                    <span className="text-[12px] text-muted-foreground">{blogText.headerHint}</span>
                    <span className="text-[12px] text-muted-foreground">JPG or PNG — recommended 1200×630px, max 5 MB</span>
                  </label>
                </div>

                {/* Video upload */}
                <div className="grid gap-2">
                  <span className="text-[13px] font-medium text-muted-foreground">{blogText.videoUpload}</span>
                  <label className="grid cursor-pointer gap-1.5 rounded-md bg-card p-3 ring-1 ring-inset ring-border transition-colors hover:bg-accent">
                    <input type="file" accept="video/*" onChange={(e) => handleVideoFileChange(e.target.files?.[0] || null)} className="hidden" />
                    <span className="flex items-center gap-2 text-[13px] text-foreground"><PlayCircle size={14} strokeWidth={2} /> {videoFile ? videoFile.name : blogText.uploadVideo}</span>
                    {videoDuration !== null && (
                      <span className="text-[12px] font-semibold text-primary">Duration: {Math.floor(videoDuration / 60)}m {videoDuration % 60}s</span>
                    )}
                    <span className="text-[12px] text-muted-foreground">{blogText.videoHint}</span>
                  </label>
                </div>

                {editingPost?.header_image_url && (
                  <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <input type="checkbox" checked={removeHeaderImage} onChange={(e) => setRemoveHeaderImage(e.target.checked)} /> {blogText.removeHeader}
                  </label>
                )}
                {editingPost?.video_url && (
                  <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <input type="checkbox" checked={removeVideo} onChange={(e) => setRemoveVideo(e.target.checked)} /> {blogText.removeVideo}
                  </label>
                )}

                <div className="grid gap-2">
                  <Button variant="outline" onClick={() => onSave("draft")} disabled={saving} className="w-full">
                    <Save size={15} strokeWidth={2} /> {blogText.saveDraft}
                  </Button>
                  <Button onClick={() => onSave("published")} disabled={saving} className="w-full">
                    <Upload size={15} strokeWidth={2} /> {saving ? blogText.saving : blogText.publish}
                  </Button>
                  {saving && uploadProgress > 0 && (
                    <div className="grid gap-1.5">
                      <Progress value={uploadProgress} className="h-1.5" />
                      <span className="text-center text-[12px] text-muted-foreground">{uploadProgress}% uploaded</span>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
