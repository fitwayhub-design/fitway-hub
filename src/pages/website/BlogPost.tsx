import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { ArrowLeft, Calendar, User, Clock, Eye } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { fetchPublicBlogBySlug, resolveMediaUrl, trackBlogView, type BlogPost as BlogPostType } from "@/lib/blogs";
import PageLoader from "@/components/ui/PageLoader";
import VideoPlayer, { isYouTubeUrl } from "@/components/app/VideoPlayer";

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .split('\n\n')
    .map(p => p.trim() && !p.startsWith('<') ? `<p>${p}</p>` : p)
    .join('\n');
}

function toDate(dateStr: string | null | undefined, lang: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function estimateReadMinutes(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { lang, t } = useI18n();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPost() {
      if (!slug) {
        setError("Invalid article");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const data = await fetchPublicBlogBySlug(slug, lang as "en" | "ar");
        setPost(data);
        trackBlogView(data.id);
      } catch (err: any) {
        setError(err.message || "Failed to load article");
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [slug, lang]);

  if (loading) return <PageLoader />;

  if (error || !post) {
    return (
      <div style={{
        minHeight: "50vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "120px 40px 40px"
      }}>
        <h2 style={{ color: "var(--text-primary)" }}>
          {lang === "ar" ? "المقال غير موجود" : "Article Not Found"}
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>
          {error || (lang === "ar" ? "هذا المقال غير متاح حالياً." : "This article is not available right now.")}
        </p>
        <Link 
          to="/blogs" 
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            background: "var(--accent)",
            // Yellow accent + white text = ~1:1 contrast (invisible).
            // Use near-black so the label reads in both light and dark themes.
            color: "#0A0A0A",
            borderRadius: "var(--radius-full)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={18} />
          {lang === "ar" ? "العودة إلى المدونة" : "Back to Our Blog"}
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 920,
      margin: "0 auto",
      padding: "140px 24px 60px",
      direction: lang === "ar" ? "rtl" : "ltr"
    }}>
      {/* Back Button */}
      <button
        onClick={() => navigate("/blogs")}
        className="fwh-btn-outline"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 40,
        }}
      >
        <ArrowLeft size={16} />
        <span>{lang === "ar" ? "العودة إلى المدونة" : "Back to Journal"}</span>
      </button>

      {/* Section meta */}
      <div className="fwh-section-meta" style={{ marginBottom: 18 }}>
        <span>{lang === "ar" ? "مقال · ٢٠٢٦" : "ARTICLE · V.2026"}</span>
        <span>{lang === "ar" ? "للقراءة" : "For reading"}</span>
      </div>

      {/* Eyebrow */}
      <div style={{ marginBottom: 18 }}>
        <span className="fwh-kicker">{lang === "ar" ? "— مقال" : "— The Article"}</span>
      </div>

      {/* Title */}
      <h1
        className="fwh-hero-h1"
        style={{
          fontSize: "clamp(40px, 6vw, 88px)",
          lineHeight: 1.02,
          margin: "0 0 28px 0",
        }}
      >
        {post.title}
      </h1>

      {/* Meta Info */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        marginBottom: 32,
        color: "var(--text-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        paddingBottom: 24,
        borderBottom: "1px solid var(--border)"
      }}>
        {post.author_name && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <User size={14} />
            <span>{post.author_name}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={14} />
          <span>{toDate(post.published_at || post.created_at, lang)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={14} />
          <span>
            {estimateReadMinutes(post.content)} {lang === "ar" ? "دقائق قراءة" : "min read"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={14} />
          <span>{(post.views || 0).toLocaleString()} {lang === "ar" ? "مشاهدة" : "views"}</span>
        </div>
      </div>

      {/* Header Image */}
      {post.header_image_url && (
        <img
          src={resolveMediaUrl(post.header_image_url)}
          alt={post.title}
          style={{
            width: "100%",
            maxHeight: 520,
            objectFit: "cover",
            borderRadius: 14,
            marginBottom: 32,
            border: "1px solid var(--border)",
          }}
        />
      )}

      {/* Excerpt */}
      {post.excerpt && (
        <p style={{
          fontSize: 20,
          lineHeight: 1.55,
          color: "var(--text-primary)",
          fontWeight: 400,
          fontFamily: "var(--fwh-serif, 'Instrument Serif', serif)",
          fontStyle: "italic",
          marginBottom: 36,
          padding: "24px 28px",
          background: "transparent",
          borderRadius: 14,
          borderLeft: lang === "ar" ? "none" : "2px solid var(--accent, #FFD600)",
          borderRight: lang === "ar" ? "2px solid var(--accent, #FFD600)" : "none"
        }}>
          {post.excerpt}
        </p>
      )}

      {/* Video */}
      {post.video_url && (
        <VideoPlayer
          url={isYouTubeUrl(post.video_url) ? post.video_url : resolveMediaUrl(post.video_url)}
          mediaType={isYouTubeUrl(post.video_url) ? "youtube" : "video"}
          height={360}
          style={{
            borderRadius: 14,
            marginBottom: 32,
            border: "1px solid var(--border)",
          }}
        />
      )}

      {/* Content */}
      <div
        style={{
          fontSize: 17,
          lineHeight: 1.8,
          color: "var(--text-primary)",
        }}
        className="blog-content"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(markdownToHtml(post.content)) }}
      />

      {/* Back to Journal CTA */}
      <div style={{
        marginTop: 64,
        paddingTop: 32,
        borderTop: "1px solid var(--border)",
        textAlign: "center"
      }}>
        <Link
          to="/blogs"
          className="fwh-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none"
          }}
        >
          <ArrowLeft size={16} />
          {lang === "ar" ? "تصفح المزيد من المقالات" : "Browse More Articles"}
          <span className="fwh-btn-arr">↗</span>
        </Link>
      </div>
    </div>
  );
}
