import { useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { useNavigate } from "react-router";

/**
 * Phase 2.1 — Spark v2 Dashboard.
 *
 * Wireframe: spark-demo/index.html lines 794–858.
 *
 * Greeting + period pills → 4 hero KPI tiles → What-needs-you attention
 * cards → Coming-up + Latest-recaps two-column.
 *
 * Data: useEventDashboardData(tenantId, filters, fetchKey) returns the same
 * shape the legacy dashboard used (metrics, comparisonValues, recentEvents).
 * The "Avg $/Sample" and "First-time triers" wireframe tiles don't exist in
 * the backend yet — substituting Brand Awareness and Total Events. The
 * date-range pills are visual-only for v1; real filtering ships in v2.
 */

type RangeKey = "today" | "7d" | "30d" | "qtd" | "ytd";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
];

const formatNumber = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "0";

const formatPct = (v: number | null | undefined) =>
  typeof v === "number" ? `${v.toFixed(1)}%` : "—";

const formatDelta = (
  current?: number | null,
  previous?: number | null,
  asPct = true,
): { text: string; positive: boolean } | null => {
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    previous === 0
  )
    return null;
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? "+" : "";
  return {
    text: asPct ? `${sign}${diff.toFixed(0)}%` : `${sign}${diff.toFixed(0)}`,
    positive: diff >= 0,
  };
};

const greetingByHour = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const monthLabel = () =>
  new Date()
    .toLocaleString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();

/* ─────────────────────────────────────────────────────────────── */

const KpiTile: React.FC<{
  icon: string;
  label: string;
  value: string;
  delta?: { text: string; positive: boolean } | null;
  hint?: string;
  highlight?: boolean;
}> = ({ icon, label, value, delta, hint, highlight }) => (
  <div
    className={[
      "card relative px-5 py-4 rounded-xl border bg-base-100",
      highlight
        ? "border-primary/60 shadow-[0_0_0_1px_rgba(197,245,70,0.15)]"
        : "border-base-300/80",
    ].join(" ")}
  >
    <div className="flex items-start justify-between">
      <span
        className={[
          "mono text-[16px] w-10 h-10 rounded-lg flex items-center justify-center",
          highlight
            ? "bg-primary/15 text-primary border border-primary/30"
            : "bg-base-300/40 text-primary/80 border border-base-300",
        ].join(" ")}
        aria-hidden
      >
        {icon}
      </span>
      <div className="text-right">
        {delta && (
          <span
            className={[
              "mono text-[11px] tracking-wide",
              delta.positive ? "text-primary" : "text-warning",
            ].join(" ")}
          >
            {delta.text}
          </span>
        )}
        {!delta && hint && (
          <span className="mono text-[11px] tracking-wide text-base-content/55">
            {hint}
          </span>
        )}
      </div>
    </div>
    <div className="mt-6">
      <p className="display text-4xl lg:text-5xl font-bold leading-none tab-num">
        {value}
      </p>
      <p className="mt-2 text-sm text-base-content/55">{label}</p>
    </div>
  </div>
);

const AttentionCard: React.FC<{
  tone: "orange" | "gold";
  badge: string;
  title: string;
  detail: string;
  ctaLabel: string;
  onClick?: () => void;
}> = ({ tone, badge, title, detail, ctaLabel, onClick }) => {
  const ring =
    tone === "orange" ? "border-warning/50" : "border-amber-400/50";
  const dot = tone === "orange" ? "bg-warning" : "bg-amber-400";
  const text = tone === "orange" ? "text-warning" : "text-amber-400";
  return (
    <div className={`card rounded-xl border ${ring} bg-base-100 p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span
          className={`mono text-[10px] tracking-[0.18em] ${text}`}
        >
          {badge}
        </span>
      </div>
      <p className="display text-lg font-semibold leading-tight">{title}</p>
      <p className="mt-2 text-sm text-base-content/65">{detail}</p>
      <button
        onClick={onClick}
        className={`mt-4 w-full rounded-md border ${ring} ${text} text-sm py-2 hover:bg-base-300/40 transition`}
      >
        {ctaLabel} →
      </button>
    </div>
  );
};

const UpcomingRow: React.FC<{
  date: string;
  venue: string;
  who: string;
  status: string;
  tone: "lime" | "sky";
}> = ({ date, venue, who, status, tone }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-base-300 last:border-0">
    <div className="min-w-0">
      <p className="mono text-[10px] tracking-[0.18em] text-base-content/45">
        {date}
      </p>
      <p className="text-sm font-medium truncate">{venue}</p>
      <p className="text-xs text-base-content/55 truncate">{who}</p>
    </div>
    <span
      className={[
        "mono text-[10px] tracking-[0.14em] px-2 py-0.5 rounded border",
        tone === "lime"
          ? "text-primary border-primary/40 bg-primary/10"
          : "text-info border-info/40 bg-info/10",
      ].join(" ")}
    >
      {status.toUpperCase()}
    </span>
  </div>
);

const RecapRow: React.FC<{
  venue: string;
  city: string;
  date: string;
  consumers: number | string;
  conversion: string;
}> = ({ venue, city, date, consumers, conversion }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-base-300 last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-medium truncate">{venue}</p>
      <p className="text-xs text-base-content/55 truncate">
        {city} · {date}
      </p>
    </div>
    <div className="text-right shrink-0 ml-3">
      <p className="text-sm font-semibold tab-num">{consumers}</p>
      <p className="mono text-[10px] tracking-[0.14em] text-primary">
        {conversion}
      </p>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────── */

export default function DashboardIndex() {
  const { tenantId, user } = useAuthStore();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30d");

  const filters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: null,
      endDate: null,
    }),
    [],
  );

  const { dashboard } = useEventDashboardData(tenantId || "", filters, 0);
  const m = dashboard.metrics;
  const cmp = m.comparisonValues ?? {};

  const tenantDisplay =
    useAuthStore.getState().tenantMeta?.requestUrlName ?? "—";

  // Sample greeting line — mirror wireframe "14,228 consumers sampled. Up 18%."
  const consumerDelta = formatDelta(
    m.consumersSampled,
    (cmp as { consumersSampled?: number | null }).consumersSampled,
  );

  const recent = dashboard.recentEvents ?? [];
  const upcoming = recent.slice(0, 5);
  // Use the same list for "Latest recaps" until we wire a real RecapsQuery.
  const latestRecaps = recent.slice(0, 5);

  return (
    <Layout>
      <div className="space-y-10 max-w-7xl">
        {/* Greeting + period pills */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="mono text-[10px] tracking-[0.18em] text-base-content/45">
              {tenantDisplay.toUpperCase()} · {monthLabel()}
            </p>
            <h1 className="display text-4xl lg:text-5xl font-bold mt-2 leading-[1.05]">
              {greetingByHour()}, {user?.firstName ?? "there"}.
            </h1>
            <p className="text-base-content/55 mt-3 text-base">
              {formatNumber(m.consumersSampled)} consumers sampled.{" "}
              {consumerDelta && (
                <span className="text-primary">
                  {consumerDelta.positive ? "Up " : "Down "}
                  {consumerDelta.text.replace("+", "").replace("-", "")}.
                </span>
              )}
            </p>
          </div>
          <div className="inline-flex items-center bg-base-100 border border-base-300 rounded-full p-0.5">
            {RANGE_OPTIONS.map((opt) => {
              const on = opt.key === range;
              return (
                <button
                  key={opt.key}
                  onClick={() => setRange(opt.key)}
                  className={[
                    "px-3.5 py-1.5 rounded-full text-xs transition",
                    on
                      ? "bg-primary text-primary-content font-semibold"
                      : "text-base-content/65 hover:text-base-content",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 hero KPI tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            icon="▦"
            label="Consumers sampled"
            value={formatNumber(m.consumersSampled)}
            delta={consumerDelta}
            highlight
          />
          <KpiTile
            icon="★"
            label="Total events"
            value={formatNumber(m.totalEvents)}
            delta={formatDelta(
              m.totalEvents,
              (cmp as { totalEvents?: number | null }).totalEvents,
            )}
          />
          <KpiTile
            icon="◐"
            label="Brand awareness"
            value={formatPct(m.brandAwareness)}
            delta={formatDelta(
              m.brandAwareness,
              (cmp as { brandAwareness?: number | null }).brandAwareness,
            )}
          />
          <KpiTile
            icon="◉"
            label="Purchase intent"
            value={formatPct(m.purchaseIntent)}
            delta={formatDelta(
              m.purchaseIntent,
              (cmp as { purchaseIntent?: number | null }).purchaseIntent,
            )}
          />
        </div>

        {/* What needs you — currently stylized placeholders until we wire a
            real attention engine. Tracked in REBUILD-PLAN.md Phase 4. */}
        <div>
          <h2 className="display text-xl font-bold tracking-tight mb-3">
            What needs you
          </h2>
          <div className="grid lg:grid-cols-2 gap-4">
            <AttentionCard
              tone="orange"
              badge="MIAMI EFFICIENCY"
              title="$/sample at $2.86 (32% above market avg)"
              detail="Cooler temp issue at Bayside venue. 3 BAs logged wastage."
              ctaLabel="Run audit"
            />
            <AttentionCard
              tone="gold"
              badge="5 REQUESTS PENDING"
              title="Atlanta · Austin · Denver · Phoenix · Miami"
              detail="Avg age 18 min. Approval triggers job posting auto."
              ctaLabel="Review"
              onClick={() => navigate("/requests/list")}
            />
          </div>
        </div>

        {/* Coming up + Latest recaps */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card rounded-xl border border-base-300 bg-base-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="display text-lg font-bold tracking-tight">
                Coming up this week
              </h2>
              <button
                onClick={() => navigate("/events/list")}
                className="mono text-[10px] tracking-[0.18em] text-base-content/55 hover:text-primary transition"
              >
                ALL →
              </button>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-base-content/55 py-6 text-center">
                No upcoming events.
              </p>
            ) : (
              upcoming.map((e, i) => (
                <UpcomingRow
                  key={i}
                  date={e.date ?? ""}
                  venue={e.name ?? "—"}
                  who={e.location ?? ""}
                  status={e.status ?? "Scheduled"}
                  tone="lime"
                />
              ))
            )}
          </div>

          <div className="card rounded-xl border border-base-300 bg-base-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="display text-lg font-bold tracking-tight">
                Latest recaps
              </h2>
              <button
                onClick={() => navigate("/recaps/list")}
                className="mono text-[10px] tracking-[0.18em] text-base-content/55 hover:text-primary transition"
              >
                ALL →
              </button>
            </div>
            {latestRecaps.length === 0 ? (
              <p className="text-sm text-base-content/55 py-6 text-center">
                No recaps yet.
              </p>
            ) : (
              latestRecaps.map((e, i) => (
                <RecapRow
                  key={i}
                  venue={e.name ?? "—"}
                  city={e.location ?? "—"}
                  date={e.date ?? ""}
                  consumers={formatNumber(e.consumers)}
                  conversion={
                    typeof e.intentRate === "number"
                      ? `${e.intentRate.toFixed(0)}%`
                      : "—"
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
