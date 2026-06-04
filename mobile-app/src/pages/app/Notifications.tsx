import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { resolveNotificationLink } from "@/lib/notificationLinks";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: number;
  created_at: string;
}

export default function Notifications() {
  const { token } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const openNotification = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    const dest = resolveNotificationLink(n);
    if (dest) navigate(dest);
  };

  const fetchNotifications = async () => {
    try {
      const r = await fetch(`${getApiBase()}/api/notifications/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setNotifications(d.notifications || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);
  useAutoRefresh(fetchNotifications);

  const markRead = async (id: number) => {
    await fetch(`${getApiBase()}/api/notifications/read/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    await fetch(`${getApiBase()}/api/notifications/read-all`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    setNotifications(ns => ns.map(n => ({ ...n, is_read: 1 })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const promoNotifications = [
    { id: "promo-1", title: "Your next streak starts today", body: "Open Steps now and hit your daily goal to unlock stronger weekly consistency insights and momentum badges." },
    { id: "promo-2", title: "Coach chat is faster now", body: "Need guidance? Jump into chat and get direct support from your coach or support team in a few taps." },
    { id: "promo-3", title: "New smarter analytics", body: "Track your progress trends with clearer snapshots for steps, calories, and daily performance." },
    { id: "promo-4", title: "Featured workout waiting", body: "Today's featured workout is tailored to keep your momentum high. Start now and build consistency." },
    { id: "promo-5", title: "Community boost", body: "Share your latest progress photo or video in Community and inspire others while staying accountable." },
    { id: "promo-6", title: "Premium coaching edge", body: "Unlock personalized coaching plans and get more precise guidance built around your exact goals." },
  ];

  const typeColors: Record<string, string> = {
    info: "var(--blue)",
    success: "var(--accent)",
    warning: "var(--amber)",
    error: "var(--red)",
    gift: "#FBBF24",
    coaching: "var(--cyan)",
    community: "var(--blue)",
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-4">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[26px] font-bold leading-none tracking-tight">{t("notifications") || "Notifications"}</h1>
          {unreadCount > 0 && <Badge variant="destructive" className="px-2">{unreadCount}</Badge>}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
            <CheckCheck size={14} /> Mark all read
          </Button>
        )}
      </header>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[84px] w-full rounded-lg" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-muted">
            <Bell size={26} className="text-muted-foreground" />
          </div>
          <p className="text-[15px] font-semibold text-foreground">No notifications yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">You'll see updates about your activity here</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Feature highlights */}
          <section>
            <p className="mb-2.5 text-[12px] font-bold tracking-wider text-muted-foreground uppercase">Feature Highlights</p>
            <div className="space-y-2.5">
              {promoNotifications.map(p => (
                <Card key={p.id} className="gap-1 bg-gradient-to-br from-primary/10 to-[var(--secondary-dim)] p-4 shadow-soft-sm">
                  <p className="text-[13px] font-bold">{p.title}</p>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">{p.body}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* Notifications */}
          <section className="space-y-2.5">
            {notifications.map(n => {
              const color = typeColors[n.type] || "var(--blue)";
              return (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg p-4 text-start shadow-soft-sm transition active:scale-[0.99]",
                    n.is_read ? "bg-card" : "bg-[var(--secondary-dim)] ring-1 ring-[color-mix(in_srgb,var(--secondary)_25%,transparent)]",
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
                    <Bell size={16} style={{ color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className={cn("text-[14px] leading-snug", n.is_read ? "font-medium" : "font-bold")}>{n.title}</p>
                      {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-[var(--secondary)]" />}
                    </div>
                    <p className="mb-1.5 text-[13px] leading-relaxed text-muted-foreground">{n.body}</p>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {resolveNotificationLink(n) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--secondary)]">
                          View <ExternalLink size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
