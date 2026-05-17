import { useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
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

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
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
  const upcoming = recent.slice(0, 5);
  const latest = recent.slice(0, 5);

  return (
    <Layout>
      <div className="space-y-8 max-w-7xl">
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

        {/* 4 hero KPI tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            icon="▦"
            label="Consumers sampled"
            value={fmtNum(m.consumersSampled)}
            delta={consumerDelta}
            glow
          />
          <KpiTile
            icon="★"
            label="Total events"
            value={fmtNum(m.totalEvents)}
            delta={computeDelta(m.totalEvents, cmp.totalEvents)}
          />
          <KpiTile
            icon="◐"
            label="Brand awareness"
            value={fmtPct(m.brandAwareness)}
            delta={computeDelta(m.brandAwareness, cmp.brandAwareness)}
          />
          <KpiTile
            icon="◉"
            label="Purchase intent"
            value={fmtPct(m.purchaseIntent)}
            delta={computeDelta(m.purchaseIntent, cmp.purchaseIntent)}
          />
        </div>

        {/* What needs you */}
        <div>
          <h2
            className="display text-xl font-bold mb-3"
            style={{ letterSpacing: "-0.02em" }}
          >
            What needs you
          </h2>
          <div className="grid lg:grid-cols-2 gap-4">
            <AttentionCard
              tone="orange"
              badge="MIAMI EFFICIENCY"
              headline="$/sample at $2.86 (32% above market avg)"
              body="Cooler temp issue at Bayside venue. 3 BAs logged wastage."
              cta="Run audit"
            />
            <AttentionCard
              tone="gold"
              badge="5 REQUESTS PENDING"
              headline="Atlanta · Austin · Denver · Phoenix · Miami"
              body="Avg age 18 min. Approval triggers job posting auto."
              cta="Review"
              onClick={() => navigate("/requests/list")}
            />
          </div>
        </div>

        {/* Coming up + Latest recaps */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="spark-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="display text-lg font-bold"
                style={{ letterSpacing: "-0.02em" }}
              >
                Coming up this week
              </h2>
              <button
                onClick={() => navigate("/events/list")}
                className="mono text-[10px] transition"
                style={{
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                ALL →
              </button>
            </div>
            {upcoming.length === 0 ? (
              <p
                className="text-sm py-6 text-center"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No upcoming events.
              </p>
            ) : (
              upcoming.map((e, i) => (
                <UpcomingRow
                  key={i}
                  date={e.date ?? ""}
                  venue={e.name ?? "—"}
                  info={e.location ?? ""}
                  status={e.status ?? "Scheduled"}
                />
              ))
            )}
          </div>

          <div className="spark-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="display text-lg font-bold"
                style={{ letterSpacing: "-0.02em" }}
              >
                Latest recaps
              </h2>
              <button
                onClick={() => navigate("/recaps/list")}
                className="mono text-[10px] transition"
                style={{
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                ALL →
              </button>
            </div>
            {latest.length === 0 ? (
              <p
                className="text-sm py-6 text-center"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No recaps yet.
              </p>
            ) : (
              latest.map((e, i) => (
                <RecapRow
                  key={i}
                  venue={e.name ?? "—"}
                  market={e.location ?? "—"}
                  date={e.date ?? ""}
                  samples={fmtNum(e.consumers)}
                  conv={
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
