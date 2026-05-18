import { Badge } from "@/components/ui/badge";
import { cn, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/lib/utils";

/* ── StatusBadge ──────────────────────────────────────────────────── */
/**
 * Maps a project status string to a coloured badge.
 * Uses border variants from Badge so it's consistent with the rest of the UI.
 */
export function StatusBadge({ status }: { status: string }) {
  const colorClass =
    PROJECT_STATUS_COLORS[status] ??
    "bg-slate-100 text-slate-600 border-slate-200";
  const label = PROJECT_STATUS_LABELS[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5",
        "text-[11px] font-medium whitespace-nowrap",
        colorClass,
      )}
    >
      {label}
    </span>
  );
}

/* ── StatCard ─────────────────────────────────────────────────────── */
/**
 * Compact KPI card for dashboard metrics.
 * Deliberately minimal — number, label, optional sub.
 */
export function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground leading-none">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] text-muted-foreground truncate">{sub}</p>
      )}
    </div>
  );
}

/* ── EmptyState ───────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-8 py-14 text-center">
      {icon && <div className="mb-3 text-muted-foreground/40">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── InlineAlert ──────────────────────────────────────────────────── */
type AlertTone = "info" | "success" | "warning" | "error";

const ALERT_STYLES: Record<AlertTone, { wrapper: string; icon: string }> = {
  info: {
    wrapper: "bg-blue-50 border-blue-200 text-blue-800",
    icon: "text-blue-500",
  },
  success: {
    wrapper: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icon: "text-emerald-500",
  },
  warning: {
    wrapper: "bg-amber-50 border-amber-200 text-amber-800",
    icon: "text-amber-500",
  },
  error: {
    wrapper: "bg-red-50 border-red-200 text-red-800",
    icon: "text-red-500",
  },
};

export function InlineAlert({
  tone = "info",
  icon,
  children,
  className,
}: {
  tone?: AlertTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = ALERT_STYLES[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs",
        styles.wrapper,
        className,
      )}
    >
      {icon && (
        <span className={cn("mt-0.5 shrink-0 [&_svg]:size-3.5", styles.icon)}>
          {icon}
        </span>
      )}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
