import type { CSSProperties, ReactNode } from "react";

/**
 * Layout-shaped loading chrome. Route changes and tenant resolve used to
 * flash a full-page "LOADING…" on a black screen for several seconds.
 * These keep the sidebar + topbar silhouette visible and fill the content
 * pane with shimmering blocks that match the page that's arriving.
 */

const Block = ({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) => <div className={`skeleton-block ${className ?? ""}`} style={style} />;

/** Fake sidebar + topbar so the app shell never collapses to a black page. */
export function AppShellSkeleton({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div
      className="flex h-screen spark-mesh"
      style={{ background: "var(--spark-bg)", color: "var(--spark-text)" }}
      aria-busy="true"
      aria-label="Loading"
    >
      <aside
        className="w-64 shrink-0 hidden md:flex flex-col h-screen"
        style={{
          background: "rgba(var(--spark-bg-rgb),0.85)",
          borderRight: "1px solid var(--spark-border)",
        }}
      >
        <div
          className="px-5 py-5"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <Block style={{ height: 28, width: 120 }} />
        </div>
        <div className="flex-1 px-4 py-4 space-y-3">
          <Block style={{ height: 10, width: 72 }} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Block key={i} style={{ height: 32, width: "100%" }} />
          ))}
          <Block style={{ height: 10, width: 88, marginTop: 16 }} />
          {[0, 1, 2].map((i) => (
            <Block key={`b${i}`} style={{ height: 32, width: "100%" }} />
          ))}
        </div>
      </aside>
      <div className="flex flex-col flex-1 min-w-0">
        <header
          className="h-14 shrink-0 flex items-center justify-between px-6"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <Block style={{ height: 12, width: 140 }} />
          <div className="flex items-center gap-3">
            <Block style={{ height: 32, width: 160, borderRadius: 999 }} />
            <Block style={{ height: 32, width: 32, borderRadius: 999 }} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-10 min-h-full">
            {children ?? <DashboardSkeleton />}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Content-pane fallback for a lazy route inside the signed-in shell. The
 * real sidebar + topbar are already on screen, so this draws only a
 * neutral page silhouette (no fake chrome, which used to nest a second
 * sidebar inside the page). It stays invisible for the first ~150ms so a
 * cached chunk swaps in without a skeleton flash.
 */
export function RouteContentSkeleton() {
  return (
    <div
      className="spark-delayed-fallback space-y-6 max-w-7xl"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div>
        <Block style={{ height: 32, width: "36%" }} />
        <Block style={{ height: 14, width: "24%", marginTop: 12 }} />
      </div>
      <Block style={{ height: 56 }} />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} style={{ height: 64 }} />
        ))}
      </div>
    </div>
  );
}

/** Compact card shimmer for a dashboard panel, map, or KPI slot. */
export function PanelSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="spark-card p-5 space-y-3"
      aria-busy="true"
      aria-label={label}
    >
      <div className="skeleton-block" style={{ height: 12, width: 160 }} />
      <div className="skeleton-block" style={{ height: 96 }} />
      <div className="skeleton-block" style={{ height: 14, width: "55%" }} />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8 max-w-7xl" aria-hidden="true">
      <div>
        <Block style={{ height: 10, width: 180, marginBottom: 12 }} />
        <Block style={{ height: 36, width: "42%" }} />
        <Block style={{ height: 16, width: "28%", marginTop: 12 }} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Block key={i} style={{ height: 96 }} />
        ))}
      </div>
      <Block style={{ height: 220 }} />
      <div className="grid md:grid-cols-2 gap-4">
        <Block style={{ height: 180 }} />
        <Block style={{ height: 180 }} />
      </div>
    </div>
  );
}

export function RecapsListSkeleton() {
  return (
    <div className="space-y-4 max-w-7xl" aria-hidden="true">
      <div className="spark-card p-3 flex flex-wrap gap-2 items-center">
        <Block style={{ height: 40, width: 100 }} />
        <Block style={{ height: 40, flex: 1, minWidth: 180 }} />
        <Block style={{ height: 40, width: 140 }} />
        <Block style={{ height: 40, width: 160 }} />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="spark-card p-4 flex items-center gap-4"
        >
          <Block style={{ height: 56, width: 56, borderRadius: 10 }} />
          <div className="flex-1 space-y-2">
            <Block style={{ height: 16, width: "40%" }} />
            <Block style={{ height: 12, width: "24%" }} />
          </div>
          <Block style={{ height: 24, width: 72, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

export function RecapDetailSkeleton() {
  return (
    <div className="max-w-7xl space-y-5" aria-hidden="true">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2 flex-1">
          <Block style={{ height: 10, width: 120 }} />
          <Block style={{ height: 32, width: "50%" }} />
          <Block style={{ height: 14, width: "30%" }} />
        </div>
        <Block style={{ height: 40, width: 140, borderRadius: 12 }} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Block style={{ height: 220 }} />
          <div className="grid grid-cols-3 gap-3">
            <Block style={{ height: 120 }} />
            <Block style={{ height: 120 }} />
            <Block style={{ height: 120 }} />
          </div>
        </div>
        <Block style={{ height: 360 }} />
      </div>
    </div>
  );
}
