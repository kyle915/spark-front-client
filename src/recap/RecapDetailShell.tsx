import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export type RecapDetailTab = "overview" | "details" | "photos";

const TAB_LABELS: Record<RecapDetailTab, string> = {
  overview: "Overview",
  details: "Details",
  photos: "Photos",
};

/**
 * Origin-style detail chrome shared by legacy Recap + CustomRecap views.
 * Layout only — no GraphQL, no approve/share logic.
 */

export function RecapDetailBackLink({
  to,
  onClick,
  children,
}: {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className =
    "mono text-[11px] transition hover:opacity-90";
  const style = {
    letterSpacing: "0.14em" as const,
    color: "rgba(255,255,255,0.45)",
  };
  if (to) {
    return (
      <Link to={to} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}

export function RecapDetailTabs({
  value,
  onChange,
  photoCount,
  className,
}: {
  value: RecapDetailTab;
  onChange: (tab: RecapDetailTab) => void;
  photoCount?: number;
  className?: string;
}) {
  const tabs: RecapDetailTab[] = ["overview", "details", "photos"];
  return (
    <div
      className={cn("recap-detail-tabs", className)}
      role="tablist"
      aria-label="Recap sections"
    >
      {tabs.map((tab) => {
        const on = value === tab;
        const label =
          tab === "photos" && typeof photoCount === "number"
            ? `${TAB_LABELS[tab]} · ${photoCount}`
            : TAB_LABELS[tab];
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab)}
            className={cn("recap-detail-tab", on && "is-active")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export type RecapKpiItem = {
  label: string;
  value: string;
  glow?: boolean;
  icon?: ReactNode;
};

/** Connected KPI strip — Origin stats-grid pattern, Spark tokens. */
export function RecapKpiStrip({
  items,
  className,
}: {
  items: RecapKpiItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("recap-kpi-strip", className)}>
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className={cn("recap-kpi-cell", item.glow && "is-glow")}
        >
          {item.icon ? (
            <div className="recap-kpi-icon" aria-hidden>
              {item.icon}
            </div>
          ) : null}
          <p className="recap-kpi-label">{item.label}</p>
          <p className="recap-kpi-value">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function RecapDetailPanel({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
