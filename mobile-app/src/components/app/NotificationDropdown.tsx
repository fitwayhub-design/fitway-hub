import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { getApiBase } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { resolveNotificationLink } from "@/lib/notificationLinks";

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
  const isRtl = lang === "ar";

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${getApiBase()}/api/notifications/list`, {
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
      await fetch(`${getApiBase()}/api/notifications/read/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } catch { /* ignore */ }
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    if (!token) return;
    try {
      await fetch(`${getApiBase()}/api/notifications/read-all`, {
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
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: 10,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          color: "var(--text-primary)", cursor: "pointer",
          ...buttonStyle,
        }}
      >
        <Bell size={size} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute", top: -4, [isRtl ? "left" : "right"]: -5,
              width: 16, height: 16, borderRadius: "50%",
              background: "var(--secondary, var(--main))", color: "#fff",
              fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid var(--bg-main, var(--bg-primary))",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            [align === "left" ? "left" : "right"]: 0,
            width: "min(360px, 92vw)",
            maxHeight: "70vh",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.02)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "notif-pop 0.15s ease-out",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px", borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={15} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px",
                  borderRadius: 99, background: "var(--red, #EF4444)", color: "#fff",
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "none", border: "1px solid var(--border)",
                  borderRadius: 99, padding: "4px 9px",
                  fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600,
                }}
              >
                <CheckCheck size={12} /> {t("mark_all_read") || "Mark all"}
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && recent.length === 0 ? (
              <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                {t("loading") || "Loading…"}
              </div>
            ) : recent.length === 0 ? (
              <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
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
                    style={{
                      display: "flex", gap: 10,
                      padding: "11px 14px",
                      borderBottom: "1px solid var(--border)",
                      background: unread ? "color-mix(in srgb, var(--main) 6%, transparent)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 8, flexShrink: 0, borderRadius: 99,
                      background: unread ? color : "transparent",
                      alignSelf: "stretch",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.title}
                        </p>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                          {formatRelative(n.created_at, lang)}
                        </span>
                      </div>
                      <p style={{
                        fontSize: 12, color: "var(--text-secondary)", margin: "3px 0 0",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        overflow: "hidden", lineHeight: 1.4,
                      }}>
                        {n.body}
                      </p>
                      {dest && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          fontSize: 10, color: color, marginTop: 4, fontWeight: 600,
                        }}>
                          <ExternalLink size={10} /> {t("open") || "Open"}
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
            style={{
              display: "block", textAlign: "center",
              padding: "11px 14px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-surface, var(--bg-card))",
              fontSize: 12, fontWeight: 700, color: "var(--main)",
              textDecoration: "none",
            }}
          >
            {t("view_all_notifications") || "View all notifications"}
          </Link>
        </div>
      )}

      <style>{`
        @keyframes notif-pop {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}
