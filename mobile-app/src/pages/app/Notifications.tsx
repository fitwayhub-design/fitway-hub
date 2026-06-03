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
    <div style={{ padding: "16px 16px 24px", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bell size={22} />
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-heading)" }}>Notifications</h1>
          {unreadCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--red)", color: "#fff" }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--border)", borderRadius: 99, padding: "6px 12px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 }}>
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center" }}>
          <Bell size={40} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>No notifications yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>You'll see updates about your activity here</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Feature Highlights</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {promoNotifications.map(p => (
                <div key={p.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,214,0,0.25)", background: "linear-gradient(135deg, rgba(255,214,0,0.08), rgba(59,139,255,0.06))" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{p.title}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
          {notifications.map(n => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => openNotification(n)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNotification(n); } }}
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: n.is_read ? "var(--bg-card)" : "rgba(59,139,255,0.06)",
                border: `1px solid ${n.is_read ? "var(--border)" : "rgba(59,139,255,0.2)"}`,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: `${typeColors[n.type] || "var(--blue)"}15`,
                  border: `1px solid ${typeColors[n.type] || "var(--blue)"}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Bell size={16} color={typeColors[n.type] || "var(--blue)"} />
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
