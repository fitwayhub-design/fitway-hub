import { apiFetch } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { resolveNotificationLink } from "@/lib/notificationLinks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: number;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  info: "var(--secondary)", success: "var(--green)", warning: "var(--amber)",
  error: "var(--red)", gift: "var(--amber)", coaching: "var(--secondary)",
  community: "var(--secondary)", ad: "var(--primary)", payment: "var(--green)",
};

export default function CoachNotifications() {
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
      const r = await apiFetch(`/api/notifications/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setNotifications(d.notifications || []);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);
  useAutoRefresh(fetchNotifications);

  const markRead = async (id: number) => {
    await apiFetch(`/api/notifications/read/${id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    await apiFetch(`/api/notifications/read-all`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    setNotifications(ns => ns.map(n => ({ ...n, is_read: 1 })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="mx-auto w-full max-w-[700px]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Bell size={22} strokeWidth={2} />
          <h1 className="text-[22px] font-bold tracking-tight">
            {t("notifications") || "Notifications"}
          </h1>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllRead} variant="outline" size="sm">
            <CheckCheck size={14} strokeWidth={2} /> {t("mark_all_read") || "Mark all read"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-[14px] text-muted-foreground">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <Bell size={40} strokeWidth={2} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="mb-1.5 text-[15px] font-semibold text-foreground">
            {t("no_notifications") || "No notifications yet"}
          </p>
          <p className="text-[13px] text-muted-foreground">You'll see updates about your coaching activity here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map(n => {
            const color = TYPE_COLORS[n.type] || "var(--secondary)";
            return (
              <Card
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => openNotification(n)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNotification(n); } }}
                className={cn(
                  "cursor-pointer gap-0 p-4 shadow-soft-sm transition active:scale-[0.99]",
                  !n.is_read && "ring-1 ring-[color-mix(in_srgb,var(--secondary)_30%,transparent)]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full"
                    style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}
                  >
                    <Bell size={16} strokeWidth={2} style={{ color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <p className={cn("text-[14px] leading-snug", n.is_read ? "font-medium" : "font-bold")}>{n.title}</p>
                      {!n.is_read && <span className="size-[7px] shrink-0 rounded-full bg-[var(--secondary)]" />}
                    </div>
                    <p className="mb-1 text-[13px] leading-relaxed text-muted-foreground">{n.body}</p>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {resolveNotificationLink(n) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--secondary)]">
                          View <ExternalLink size={10} strokeWidth={2} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
