import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

type Props = {
  /** Lucide icon component (defaults to an inbox). */
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Optional primary action (e.g. a "Create" button). */
  action?: ReactNode;
  compact?: boolean;
};

/**
 * Consistent empty-state placeholder for lists, tables and dashboards. Keeps
 * "no data" presentation uniform instead of each page rolling its own markup.
 */
export default function EmptyState({ icon: Icon = Inbox, title, description, action, compact }: Props) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 10,
        padding: compact ? "28px 20px" : "48px 24px",
        color: "var(--text-secondary)",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: "var(--radius-full, 999px)",
          display: "grid",
          placeItems: "center",
          background: "var(--bg-surface, var(--bg-card))",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <Icon size={26} />
      </div>
      <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 16 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13.5, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
