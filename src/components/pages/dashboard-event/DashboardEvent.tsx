import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { useNavigate } from "react-router";

/**
 * Phase 2.1 — Spark v2 Dashboard.
 *
 * Renders the layout from spark-demo/index.html lines 794-858 using the
 * lifted .kpi / .pill-group / .spark-card / .nav-* classes. Data comes from
 * useEventDashboardData. Date-range pill is visual-only for v1.
 */

type RangeKey = "today" | "7d" | "30d" | "qtd" | "ytd";

// Apple-style: three meaningful ranges only. Today and YTD removed —
// workflow rarely lands there.
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "qtd", label: "90d" },
];

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "0";

const fmtPct = (v: number | null | undefined) =>
  typeof v === "number" ? `${v.toFixed(1)}%` : "—";

type Delta = { text: string; positive: boolean } | null;
const computeDelta = (
  current?: number | null,
  previous?: number | null,
): Delta => {
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    previous === 0
  )
    return null;
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? "+" : "";
  return { text: `${sign}${diff.toFixed(0)}%`, positive: diff >= 0 };
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const monthLabel = () =>
  new Date()
    .toLocaleString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();

const slugToName = (slug: string | null | undefined): string => {
  if (!slug) return "—";
  const parts = slug.split("-").filter(Boolean);
  const drop = new Set(["ighn", "ig", "ign"]);
  const brand =
    parts.length > 1 && drop.has(parts[0].toLowerCase())
      ? parts.slice(1)
      : parts;
  return brand
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
};

/* ───────────────────────────── KPI TILE ───────────────────────────── */
/* eslint-disable @typescript-eslint/no-unused-vars */
// These primitives are kept around for the Reports page and future
// dashboard variants. Not used in the current hero layout.

const KpiTile: React.FC<{
  icon: string;
  label: string;
  value: string;
  delta?: Delta;
  hint?: string;
  glow?: boolean;
}> = ({ icon, label, value, delta, hint, glow }) => (
  <div className={`kpi kpi-hover ${glow ? "kpi-glow" : ""}`}>
    <div className="flex items-start justify-between">
      <span className="kpi-icon" aria-hidden>
        {icon}
      </span>
      {delta && (
        <span className={`kpi-delta ${delta.positive ? "" : "neg"}`}>
          {delta.text}
        </span>
      )}
      {!delta && hint && (
        <span className="kpi-delta muted">{hint}</span>
      )}
    </div>
    <p className="kpi-value">{value}</p>
    <p className="kpi-label">{label}</p>
  </div>
);

/* ───────────────────────────── ATTENTION CARD ──────────────────────── */

const AttentionCard: React.FC<{
  tone: "orange" | "gold";
  badge: string;
  headline: string;
  body: string;
  cta: string;
  onClick?: () => void;
}> = ({ tone, badge, headline, body, cta, onClick }) => {
  const color = tone === "orange" ? "var(--spark-orange)" : "var(--spark-gold)";
  return (
    <div
      className="spark-card p-5"
      style={{ borderColor: `${color}55` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="spark-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color }}
        >
          {badge}
        </span>
      </div>
      <h4 className="font-bold text-sm leading-snug mb-1.5">{headline}</h4>
      <p className="text-xs text-base-content/65 leading-relaxed">{body}</p>
      <button
        onClick={onClick}
        className="mt-4 w-full text-xs py-2 rounded-xl transition"
        style={{
          background: "transparent",
          color,
          border: `1px solid ${color}55`,
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: 600,
        }}
      >
        {cta} →
      </button>
    </div>
  );
};

/* ───────────────────────────── ROWS ───────────────────────────── */

const UpcomingRow: React.FC<{
  date: string;
  venue: string;
  info: string;
  status: string;
  tone?: "lime" | "sky" | "gold";
}> = ({ date, venue, info, status, tone = "lime" }) => {
  const c =
    tone === "sky"
      ? "var(--spark-sky)"
      : tone === "gold"
        ? "var(--spark-gold)"
        : "var(--spark-lime)";
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: "1px solid var(--spark-border)" }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: c, boxShadow: `0 0 6px ${c}` }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{venue}</p>
        <p
          className="mono text-[10px] uppercase truncate"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {info}
        </p>
      </div>
      <div className="text-right">
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {date}
        </p>
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.14em", color: c }}
        >
          {status.toUpperCase()}
        </p>
      </div>
    </div>
  );
};

const RecapRow: React.FC<{
  venue: string;
  market: string;
  date: string;
  samples: string;
  conv: string;
  emoji?: string;
}> = ({ venue, market, date, samples, conv, emoji = "◈" }) => (
  <div
    className="flex items-center gap-3 py-3 cursor-pointer hov rounded-lg -mx-2 px-2"
    style={{ borderBottom: "1px solid var(--spark-border)" }}
  >
    <div className="w-10 h-12 grid place-items-center flex-shrink-0">
      <span className="text-2xl">{emoji}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-sm truncate">{venue}</p>
      <p
        className="mono text-[10px] uppercase truncate"
        style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
      >
        {market} · {date}
      </p>
    </div>
    <div className="text-right">
      <p
        className="tab-num text-sm font-bold"
        style={{ color: "var(--spark-lime)" }}
      >
        {samples}
      </p>
      <p
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {conv}
      </p>
    </div>
  </div>
);

// Keep dead-but-useful primitives around for future variants. Tell TS
// they're intentional so the build doesn't fail on TS6133.
void KpiTile;
void AttentionCard;
void UpcomingRow;
void RecapRow;

/* ─────────────── ACTIVATION-TYPE BREAKDOWN ─────────────── */

const TYPE_CONFIG: Array<{
  match: RegExp;
  label: string;
  color: string;
}> = [
  // Order matters — first match wins.
  { match: /retail/i, label: "Retail samplings", color: "var(--spark-lime)" },
  { match: /on[-\s]?prem|bar|venue/i, label: "On-premise", color: "var(--spark-purple)" },
  { match: /event|activation|festival|pop[-\s]?up/i, label: "Events", color: "var(--spark-sky)" },
];

const classifyType = (name: string | null | undefined): string => {
  if (!name) return "Other";
  for (const t of TYPE_CONFIG) {
    if (t.match.test(name)) return t.label;
  }
  return "Other";
};

const ActivationBreakdown: React.FC = () => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const counts = useMemo(() => {
    const buckets: Record<string, number> = {};
    const edges = data?.requests?.edges ?? [];
    for (const e of edges) {
      const n = e?.node;
      if (!n) continue;
      // Only count events that have a confirmed/scheduled/done status — they
      // happened or are happening. Pending/Queue are speculative.
      const slug = (n.status?.slug ?? n.status?.name ?? "")
        .toString()
        .toLowerCase();
      const counted =
        slug.includes("done") ||
        slug.includes("complete") ||
        slug.includes("scheduled") ||
        slug.includes("approved");
      if (!counted) continue;
      const label = classifyType(n.requestType?.name);
      buckets[label] = (buckets[label] ?? 0) + 1;
    }
    return buckets;
  }, [data]);

  const display = TYPE_CONFIG.map((t) => ({
    label: t.label,
    color: t.color,
    value: counts[t.label] ?? 0,
  }));

  return (
    <div
      className="spark-card p-6 lg:p-8"
      style={{ borderRadius: 22 }}
    >
      <div className="flex items-center justify-between mb-5">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          By activation type
        </h2>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          CONFIRMED + COMPLETED
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {display.map((s) => (
          <div key={s.label}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="spark-dot"
                style={{
                  background: s.color,
                  boxShadow: `0 0 8px ${s.color}`,
                }}
              />
              <p className="label-mini">{s.label.toUpperCase()}</p>
            </div>
            <p
              className="display tab-num font-bold"
              style={{
                fontSize: "2.5rem",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: s.color,
              }}
            >
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────────── PAGE ───────────────────────────── */

export default function DashboardIndex() {
  const { tenantId, user, tenantMeta } = useAuthStore();
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
  const cmp = (m.comparisonValues ?? {}) as {
    totalEvents?: number | null;
    consumersSampled?: number | null;
    brandAwareness?: number | null;
    purchaseIntent?: number | null;
  };

  const tenantDisplay = slugToName(tenantMeta?.requestUrlName);
  const consumerDelta = computeDelta(m.consumersSampled, cmp.consumersSampled);

  const recent = dashboard.recentEvents ?? [];

  return (
    <Layout>
      <div className="space-y-10 lg:space-y-12 max-w-7xl">
        {/* Greeting + period pills */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {tenantDisplay.toUpperCase()} · {monthLabel()}
            </p>
            <h1
              className="display text-4xl lg:text-5xl font-bold mt-2 leading-[1.05]"
              style={{ letterSpacing: "-0.04em" }}
            >
              {greeting()}, {user?.firstName ?? "there"}.
            </h1>
            <p
              className="mt-3 text-base"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {fmtNum(m.consumersSampled)} consumers sampled.{" "}
              {consumerDelta && (
                <span style={{ color: "var(--spark-lime)" }}>
                  {consumerDelta.positive ? "Up " : "Down "}
                  {consumerDelta.text.replace(/^[+-]/, "")}.
                </span>
              )}
            </p>
          </div>
          <div className="pill-group">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`pill-btn ${r.key === range ? "on" : ""}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Single hero metric + thin ribbon underneath (Apple Health pattern) */}
        <div
          className="spark-card-glow rounded-3xl px-8 lg:px-12 py-10 lg:py-14"
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.22em",
              color: "var(--spark-lime)",
            }}
          >
            CONSUMERS SAMPLED
          </p>
          <p
            className="display tab-num font-bold mt-2"
            style={{
              fontSize: "clamp(4rem, 11vw, 7.5rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.05em",
              color: "var(--spark-text)",
            }}
          >
            {fmtNum(m.consumersSampled)}
          </p>
          {consumerDelta && (
            <p
              className="mt-3 mono text-sm"
              style={{
                letterSpacing: "0.08em",
                color: consumerDelta.positive
                  ? "var(--spark-lime)"
                  : "var(--spark-orange)",
              }}
            >
              {consumerDelta.positive ? "▲" : "▼"} {consumerDelta.text} vs
              previous period
            </p>
          )}

          {/* Thin secondary ribbon */}
          <div
            className="mt-8 pt-6 grid grid-cols-3 gap-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            {[
              {
                label: "Events",
                value: fmtNum(m.totalEvents),
                delta: computeDelta(m.totalEvents, cmp.totalEvents),
              },
              {
                label: "Brand awareness",
                value: fmtPct(m.brandAwareness),
                delta: computeDelta(m.brandAwareness, cmp.brandAwareness),
              },
              {
                label: "Purchase intent",
                value: fmtPct(m.purchaseIntent),
                delta: computeDelta(m.purchaseIntent, cmp.purchaseIntent),
              },
            ].map((s) => (
              <div key={s.label}>
                <p className="label-mini">{s.label.toUpperCase()}</p>
                <p
                  className="display tab-num font-bold mt-1"
                  style={{
                    fontSize: "1.75rem",
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </p>
                {s.delta && (
                  <p
                    className="mono text-[11px] mt-1"
                    style={{
                      letterSpacing: "0.06em",
                      color: s.delta.positive
                        ? "var(--spark-lime)"
                        : "var(--spark-orange)",
                    }}
                  >
                    {s.delta.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Activation-type breakdown (Retail · Event · On-Premise) */}
        <Suspense
          fallback={
            <div
              className="spark-card p-6 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading activation breakdown…
            </div>
          }
        >
          <ActivationBreakdown />
        </Suspense>

        {/*
         * "What needs you" — data-driven attention engine TBD. For now we
         * hide the section entirely when there's nothing real to surface
         * (no static placeholder cards eroding trust).
         */}

        {/* Unified timeline: upcoming + recent in one vertical flow */}
        <div className="spark-card p-6 lg:p-8">
          <div className="flex items-center justify-between mb-5">
            <h2
              className="display text-lg lg:text-xl font-bold"
              style={{ letterSpacing: "-0.02em" }}
            >
              Timeline
            </h2>
            <button
              onClick={() => navigate("/requests/list")}
              className="mono text-[10px] transition"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              ALL EVENTS →
            </button>
          </div>

          {recent.length === 0 ? (
            <p
              className="text-sm py-10 text-center"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              No data yet. New events show up here as they're scheduled.
            </p>
          ) : (
            <div>
              {recent.slice(0, 10).map((e, i) => {
                const dateStr = e.date ?? "";
                const isToday =
                  dateStr &&
                  new Date(dateStr).toDateString() ===
                    new Date().toDateString();
                const isPast = dateStr && new Date(dateStr) < new Date();
                const dot = isToday
                  ? "var(--spark-lime)"
                  : isPast
                    ? "rgba(255,255,255,0.3)"
                    : "var(--spark-sky)";
                return (
                  <div
                    key={i}
                    onClick={() =>
                      isPast
                        ? navigate("/recap/list")
                        : navigate("/requests/list")
                    }
                    className="flex items-center gap-4 py-3 cursor-pointer"
                    style={{
                      borderBottom:
                        i < Math.min(recent.length, 10) - 1
                          ? "1px solid var(--spark-border)"
                          : "none",
                      opacity: isPast ? 0.72 : 1,
                    }}
                  >
                    <span
                      className="spark-dot shrink-0"
                      style={{
                        background: dot,
                        boxShadow: `0 0 8px ${dot}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {e.name ?? "Untitled"}
                      </p>
                      <p
                        className="mono text-[10px] mt-0.5 truncate"
                        style={{
                          letterSpacing: "0.14em",
                          color: "rgba(255,255,255,0.45)",
                          textTransform: "uppercase",
                        }}
                      >
                        {e.location ?? ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-sm"
                        style={{ color: "rgba(255,255,255,0.85)" }}
                      >
                        {dateStr || "—"}
                      </p>
                      <p
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: isToday
                            ? "var(--spark-lime)"
                            : isPast
                              ? "rgba(255,255,255,0.45)"
                              : "var(--spark-sky)",
                        }}
                      >
                        {isToday
                          ? "TODAY"
                          : isPast
                            ? (e.status ?? "DONE").toUpperCase()
                            : (e.status ?? "SCHEDULED").toUpperCase()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
