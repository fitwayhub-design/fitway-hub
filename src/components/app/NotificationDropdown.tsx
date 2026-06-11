import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { resolveNotificationLink } from "@/lib/notificationLinks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: number;
  created_at: string;
}

interface Props {
  token: string | null;
  size?: number;
  buttonStyle?: React.CSSProperties;
  align?: "left" | "right";
  viewAllPath?: string;
}

const TYPE_COLORS: Record<string, string> = {
  info: "var(--blue)",
  success: "var(--accent)",
  warning: "var(--amber)",
  error: "var(--red)",
  gift: "#FBBF24",
  coaching: "var(--cyan)",
  community: "var(--blue)",
};

function formatRelative(iso: string, lang: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const isAr = lang === "ar";
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `${mins} د` : `${mins}m`;
  if (hours < 24) return isAr ? `${hours} س` : `${hours}h`;
  if (days < 7) return isAr ? `${days} ي` : `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationDropdown({
  token,
  size = 18,
  buttonStyle,
  align = "right",
  viewAllPath = "/app/notifications",
}: Props) {
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiFetch(`/api/notifications/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        const arr = Array.isArray(d) ? d : d.notifications || [];
        setNotifications(arr);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(iv);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (id: number) => {
    if (!token) return;
    try {
      await apiFetch(`/api/notifications/read/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } catch { /* ignore */ }
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    if (!token) return;
    try {
      await apiFetch(`/api/notifications/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } catch { /* ignore */ }
    setNotifications(ns => ns.map(n => ({ ...n, is_read: 1 })));
  };

  const handleClickItem = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    setOpen(false);
    const dest = resolveNotificationLink(n);
    if (dest) navigate(dest);
  };

  const recent = notifications.slice(0, 8);
  const label = t("notifications") || "Notifications";

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="relative rounded-full bg-card text-foreground shadow-soft-xs hover:bg-accent"
        style={buttonStyle}
      >
        <Bell size={size} strokeWidth={2} className="!size-auto" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 grid size-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--secondary)] px-1 text-[9px] font-bold leading-none text-white shadow-soft-xs ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-[calc(100%+8px)] z-[1000] flex max-h-[70vh] w-[min(360px,92vw)] flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-soft-lg",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-1",
            align === "left" ? "start-0" : "end-0",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell size={15} strokeWidth={2} className="text-foreground" />
              <span className="text-sm font-semibold tracking-tight">{label}</span>
              {unreadCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="h-8 gap-1.5 rounded-full px-3 text-[11px] text-muted-foreground"
              >
                <CheckCheck size={12} strokeWidth={2} /> {t("mark_all_read") || "Mark all"}
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                {t("loading") || "Loading…"}
              </div>
            ) : recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                {t("no_notifications") || "No notifications yet"}
              </div>
            ) : (
              recent.map((n) => {
                const color = TYPE_COLORS[n.type] || "var(--blue)";
                const unread = !n.is_read;
                const dest = resolveNotificationLink(n);
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClickItem(n)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClickItem(n); } }}
                    className={cn(
                      "flex cursor-pointer gap-2.5 px-4 py-3 outline-none transition-colors hover:bg-accent focus-visible:bg-accent",
                      unread && "bg-[var(--secondary-dim)]",
                    )}
                  >
                    <div
                      className="w-1 shrink-0 self-stretch rounded-full"
                      style={{ background: unread ? color : "transparent" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelative(n.created_at, lang)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {n.body}
                      </p>
                      {dest && (
                        <span
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold"
                          style={{ color }}
                        >
                          <ExternalLink size={10} strokeWidth={2} /> {t("open") || "Open"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link
            to={viewAllPath}
            onClick={() => setOpen(false)}
            className="block bg-muted px-4 py-3 text-center text-xs font-semibold text-[var(--secondary)] transition-colors hover:bg-accent"
          >
            {t("view_all_notifications") || "View all notifications"}
          </Link>
        </div>
      )}
    </div>
  );
}
