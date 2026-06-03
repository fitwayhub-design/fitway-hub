/**
 * Limited public profile
 * ─────────────────────────────────────────────────────────
 * Anyone authenticated can hit /app/u/:id and see the bare-minimum
 * profile per the May meeting: id + name + their community posts.
 * Avatar, email, fitness stats, and onboarding data are deliberately
 * hidden — that's what /api/user/public-profile returns. Coaches who
 * need full data for THEIR subscribed athletes still get it via the
 * existing /api/coach/users/:id/profile endpoint inside the coach
 * console.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getApiBase } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeft, Heart, Clock, User } from "lucide-react";

interface Post {
  id: number; content?: string; media_url?: string;
  hashtags?: string; likes?: number; created_at: string;
}
interface PublicUser { id: number; name: string }

export default function PublicProfile() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id || !token) return;
    fetch(`${getApiBase()}/api/user/public-profile/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => { setUser(d.user); setPosts(d.posts || []); })
      .catch(() => setError("Couldn't load this profile."))
      .finally(() => setLoading(false));
  }, [id, token]);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={() => navigate(-1)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: 14, fontSize: 13 }}>
        <ChevronLeft size={16} /> Back
      </button>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--red)" }}>{error}</p>
      ) : !user ? (
        <p style={{ color: "var(--text-muted)" }}>Profile not found.</p>
      ) : (
        <>
          {/* Bare identity — no avatar by design (the May meeting
              specifically excluded profile photos from public view). */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent-dim)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={24} color="var(--accent)" />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", fontFamily: "var(--font-en)" }}>{user.name}</h1>
                <p style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)", marginTop: 2 }}>Community member</p>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8, fontFamily: "var(--font-mono, monospace)" }}>
            Community posts
          </p>
          {posts.length === 0 ? (
            <p style={{ color: "var(--text-muted)", padding: 16, textAlign: "center", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
              Hasn't posted yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} /> {new Date(p.created_at).toLocaleString()}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                      <Heart size={11} /> {p.likes || 0}
                    </p>
                  </div>
                  {p.content && <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.55, marginBottom: p.media_url || p.hashtags ? 8 : 0, whiteSpace: "pre-wrap" }}>{p.content}</p>}
                  {p.media_url && (
                    <img src={p.media_url} alt="" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)", marginBottom: p.hashtags ? 8 : 0 }} />
                  )}
                  {p.hashtags && <p style={{ fontSize: 12, color: "var(--blue)", wordBreak: "break-word" }}>{p.hashtags}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
