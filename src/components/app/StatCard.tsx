import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  color: "accent" | "blue" | "amber" | "red" | "cyan";
  trend?: string;
  subtitle?: string;
}

const colorMap: Record<string, { icon: string; iconBg: string; trend: string }> = {
  accent: { icon: "var(--accent)",       iconBg: "var(--accent-dim)",          trend: "var(--accent)" },
  blue:   { icon: "var(--blue)",         iconBg: "rgba(59,139,255,0.12)",      trend: "var(--blue)" },
  amber:  { icon: "var(--amber)",        iconBg: "rgba(255,179,64,0.12)",      trend: "var(--amber)" },
  red:    { icon: "var(--red)",          iconBg: "rgba(255,68,68,0.12)",       trend: "var(--red)" },
  cyan:   { icon: "var(--cyan)",         iconBg: "rgba(0,212,255,0.12)",       trend: "var(--cyan)" },
};

// backward compat aliases
const colorAlias: Record<string, string> = {
  emerald: "accent",
  rose: "red",
};

export function StatCard({ title, value, unit, icon: Icon, color, trend, subtitle }: StatCardProps) {
  const resolvedColor = colorAlias[color] ?? color;
  const c = colorMap[resolvedColor] ?? colorMap.accent;

  return (
    <Card className="gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-md"
          style={{ backgroundColor: c.iconBg }}
        >
          <Icon size={16} color={c.icon} strokeWidth={2} />
        </span>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold leading-none tabular-nums tracking-tight text-foreground">
            {value}
          </span>
          {unit && <span className="text-[13px] text-muted-foreground">{unit}</span>}
        </div>
        {trend && (
          <p className="mt-1.5 text-[11px] font-semibold" style={{ color: c.trend }}>
            {trend}
          </p>
        )}
        {subtitle && <p className="mt-1.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </Card>
  );
}
