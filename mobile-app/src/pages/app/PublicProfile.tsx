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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="mx-auto w-full max-w-[680px] px-4 pb-16">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="mb-4 -ms-2 text-muted-foreground"
      >
        <ChevronLeft size={16} strokeWidth={2} /> Back
      </Button>

      {loading ? (
        <div className="space-y-5">
          <Card className="flex-row items-center gap-4 p-5">
            <Skeleton className="size-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </Card>
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : error ? (
        <Card className="p-6 text-center text-[15px] text-destructive">{error}</Card>
      ) : !user ? (
        <Card className="p-6 text-center text-[15px] text-muted-foreground">Profile not found.</Card>
      ) : (
        <>
          {/* Bare identity — no avatar by design (the May meeting
              specifically excluded profile photos from public view). */}
          <Card className="mb-6 p-5">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 ring-1 ring-primary/25">
                <AvatarFallback className="bg-primary/15 text-primary">
                  <User size={24} strokeWidth={2} />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate text-[22px] font-bold tracking-tight text-primary">{user.name}</h1>
                <p className="mt-1 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">Community member</p>
              </div>
            </div>
          </Card>

          <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Community posts
          </p>
          {posts.length === 0 ? (
            <Card className="p-6 text-center text-[15px] text-muted-foreground">
              Hasn't posted yet.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map(p => (
                <Card key={p.id} className="gap-0 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock size={11} strokeWidth={2} /> {new Date(p.created_at).toLocaleString()}
                    </p>
                    <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Heart size={11} strokeWidth={2} /> {p.likes || 0}
                    </p>
                  </div>
                  {p.content && <p className={`text-[15px] leading-relaxed whitespace-pre-wrap text-foreground ${p.media_url || p.hashtags ? "mb-2" : ""}`}>{p.content}</p>}
                  {p.media_url && (
                    <img src={p.media_url} alt="" className={`max-h-[280px] w-full rounded-md object-cover ${p.hashtags ? "mb-2" : ""}`} />
                  )}
                  {p.hashtags && <p className="text-[13px] break-words text-[var(--secondary)]">{p.hashtags}</p>}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
