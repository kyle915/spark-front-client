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
 * Origin-style detail chrome shared by legacy Recap + CustomRecap.
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
    "recap-detail-back mono text-xs transition hover:opacity-90";
  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

/** Tight cluster for segmented tabs + KPI strip on the paper. */
export function RecapDetailChrome({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("recap-detail-chrome", className)}>{children}</div>
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
  // Overview = full recap read (body + quality). Photos = gallery only.
  // "details" remains in the type for callers that still set it in edit
  // mode, but it is not shown as its own tab.
  const tabs: RecapDetailTab[] = ["overview", "photos"];
  const selected: RecapDetailTab = value === "photos" ? "photos" : "overview";
  return (
    <div
      className={cn("recap-detail-tabs", className)}
      role="tablist"
      aria-label="Recap sections"
    >
      {tabs.map((tab) => {
        const on = selected === tab;
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

/** True when the full recap body should render (everything except Photos). */
export function isRecapBodyTab(tab: RecapDetailTab): boolean {
  return tab !== "photos";
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
  return (
    <div className={cn("recap-detail-panel space-y-5", className)}>
      {children}
    </div>
  );
}
