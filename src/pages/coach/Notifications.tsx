import { getApiBase } from "@/lib/api";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

const TYPE_COLORS: Record<string, string> = {
  info: "var(--blue)", success: "var(--green)", warning: "var(--amber)",
  error: "var(--red)", gift: "#FBBF24", coaching: "var(--cyan)",
  community: "var(--blue)", ad: "var(--main)", payment: "#10B981",
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
      const r = await fetch(`${getApiBase()}/api/notifications/list`, {
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
    await fetch(`${getApiBase()}/api/notifications/read/${id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    await fetch(`${getApiBase()}/api/notifications/read-all`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    setNotifications(ns => ns.map(n => ({ ...n, is_read: 1 })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bell size={22} />
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-heading)" }}>
            {t("notifications") || "Notifications"}
          </h1>
          {unreadCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--red)", color: "#fff" }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--border)", borderRadius: 99, padding: "6px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 }}>
            <CheckCheck size={13} /> {t("mark_all_read") || "Mark all read"}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center" }}>
          <Bell size={40} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            {t("no_notifications") || "No notifications yet"}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>You'll see updates about your coaching activity here</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map(n => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => openNotification(n)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNotification(n); } }}
              style={{
                padding: "14px 16px", borderRadius: 14,
                background: n.is_read ? "var(--bg-card)" : "rgba(59,139,255,0.06)",
                border: `1px solid ${n.is_read ? "var(--border)" : "rgba(59,139,255,0.2)"}`,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: `${TYPE_COLORS[n.type] || "var(--blue)"}15`,
                  border: `1px solid ${TYPE_COLORS[n.type] || "var(--blue)"}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Bell size={16} color={TYPE_COLORS[n.type] || "var(--blue)"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <p style={{ fontSize: 14, fontWeight: n.is_read ? 500 : 700, lineHeight: 1.3 }}>{n.title}</p>
                    {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--blue)", flexShrink: 0 }} />}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 4 }}>{n.body}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {resolveNotificationLink(n) && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--blue)", fontWeight: 600 }}>
                        View <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
