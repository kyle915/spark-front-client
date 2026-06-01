import { useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantKpiComparisonQuery } from "@/api/queries/TenantKpiComparisonQuery";
import type { TenantKpiComparisonQuery as TenantKpiComparisonQueryType } from "@api/queries/__generated__/TenantKpiComparisonQuery.graphql";

/**
 * "Period comparison" card for the dashboards — each headline KPI this-period
 * vs last-period with an up/down delta chip.
 *
 * Loads `tenantKpiComparison(tenantId, period)` for ONE client (tenant) and
 * renders, dark-theme styled to match <TenantKpiCharts> / <TenantSentimentCard>
 * so it reads as one dashboard: a header ("Period comparison") with a muted
 * sub showing the two periods being compared ("May 2026 vs Apr 2026"), then the
 * HEADLINE KPIs (consumers reached, samples distributed, products sold, total
 * engagements) as prominent comparison tiles, and the secondary KPIs (events,
 * recaps, first-time, brand-aware, willing to purchase) in a compact grid below.
 *
 * Each tile shows the KPI label, the CURRENT value (prominent, thousands-
 * formatted), the PREVIOUS value (muted/smaller), and a delta chip computed as
 * `prev > 0 ? Math.round((cur - prev) / prev * 100) : null`:
 *   • up move   → "↑ 12%"  (brand lime)
 *   • down move → "↓ 8%"   (calm spark-orange — NOT an alarm red; a KPI dipping
 *                            isn't a crisis)
 *   • flat      → "→ 0%"   (muted neutral)
 *   • prev == 0 && cur > 0 → "New" (muted neutral)
 *   • both 0    → "—"      (muted neutral)
 *
 * A compact period toggle (a <select>, styled like the year dropdown in
 * <TenantKpiCharts>) switches between Month / Quarter / Year. It drives the
 * `period` query variable (default "month"), so changing it refetches via
 * useLazyLoadQuery.
 *
 * Mounted near <TenantKpiCharts> on both dashboards (the admin home dashboard
 * and the client dashboard) and the admin client-detail page, scoped to the
 * active tenant from `useAuthStore().tenantId` (the route `:tenantId` on the
 * detail page). The caller renders nothing when no tenant is in scope; this
 * component is wrapped in a <Suspense> by the site (same as the other lazy-
 * loaded dashboard cards) so it loads the data the app's usual way.
 *
 * `tenantKpiComparison` resolves to null when there's no data for the period —
 * in that case we `return null` (NO card, no empty frame).
 */

const fmt = (n: number) => n.toLocaleString();

/* ───────────────────────── delta ───────────────────────── */

type Delta =
  | { kind: "up" | "down" | "flat"; pct: number }
  | { kind: "new" }
  | { kind: "none" };

/**
 * Period-over-period delta. Only a percentage when there's a non-zero baseline:
 *   prev > 0  → Math.round((cur - prev) / prev * 100), bucketed up/down/flat
 *   prev == 0 && cur > 0 → "New" (can't express a % off a zero base)
 *   both 0    → nothing to compare ("—")
 */
const computeDelta = (cur: number, prev: number): Delta => {
  if (prev > 0) {
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (pct > 0) return { kind: "up", pct };
    if (pct < 0) return { kind: "down", pct };
    return { kind: "flat", pct: 0 };
  }
  if (cur > 0) return { kind: "new" };
  return { kind: "none" };
};

// Calm palette: up leans on the brand lime; down on the restrained spark-orange
// (the same hue the sentiment card reserves for a negative move) — deliberately
// NOT an alarm red, since a KPI dipping isn't a crisis. Flat / New / none sit
// quietly in a muted neutral. Solid `text` color + matching rgba bg / border
// tints, the same way <TenantKpiCharts> and <TenantSentimentCard> tint pills.
type ChipStyle = { label: string; text: string; bg: string; border: string };

const MUTED: Pick<ChipStyle, "text" | "bg" | "border"> = {
  text: "rgba(255,255,255,0.55)",
  bg: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.14)",
};

const chipForDelta = (d: Delta): ChipStyle => {
  switch (d.kind) {
    case "up":
      // lime #c5f546 → 197,245,70
      return {
        label: `↑ ${d.pct}%`,
        text: "var(--spark-lime)",
        bg: "rgba(197,245,70,0.10)",
        border: "rgba(197,245,70,0.30)",
      };
    case "down":
      // orange #ef5a2a → 239,90,42 (restrained, not an alarm red).
      // Math.abs so we show "↓ 8%", not "↓ -8%".
      return {
        label: `↓ ${Math.abs(d.pct)}%`,
        text: "var(--spark-orange)",
        bg: "rgba(239,90,42,0.10)",
        border: "rgba(239,90,42,0.32)",
      };
    case "flat":
      return { label: "→ 0%", ...MUTED };
    case "new":
      return { label: "New", ...MUTED };
    case "none":
      return { label: "—", ...MUTED };
  }
};

/* ───────────────────────── delta chip ───────────────────────── */

const DeltaChip: React.FC<{ delta: Delta }> = ({ delta }) => {
  const chip = chipForDelta(delta);
  return (
    <span
      className="mono text-[11px] px-2 py-0.5 rounded-full inline-flex items-center shrink-0"
      style={{
        color: chip.text,
        background: chip.bg,
        border: `1px solid ${chip.border}`,
        letterSpacing: "0.04em",
        fontWeight: 600,
      }}
    >
      {chip.label}
    </span>
  );
};

/* ───────────────────────── comparison tile ───────────────────────── */

type Tone = "lime" | "sky" | "gold" | "purple";

const TONE_COLOR: Record<Tone, string> = {
  lime: "var(--spark-lime)",
  sky: "var(--spark-sky)",
  gold: "var(--spark-gold)",
  purple: "var(--spark-purple)",
};

// Prominent headline tile — same `spark-card` chrome + accent top border as the
// StatTile in <TenantKpiCharts>: the CURRENT value large up top, the delta chip
// beside it, and the PREVIOUS value muted/smaller below ("was 1,234").
const ComparisonTile: React.FC<{
  label: string;
  current: number;
  previous: number;
  tone: Tone;
}> = ({ label, current, previous, tone }) => {
  const delta = computeDelta(current, previous);
  return (
    <div
      className="spark-card rounded-2xl px-4 py-4"
      style={{ borderTop: `2px solid ${TONE_COLOR[tone]}` }}
    >
      <p
        className="mono text-[9px]"
        style={{
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <div className="flex items-baseline justify-between gap-2 mt-1.5 flex-wrap">
        <p
          className="display tab-num font-bold"
          style={{
            fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: "var(--spark-text)",
          }}
        >
          {fmt(current)}
        </p>
        <DeltaChip delta={delta} />
      </div>
      <p
        className="tab-num text-[12px] mt-1"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        was {fmt(previous)}
      </p>
    </div>
  );
};

/* ───────────────────────── secondary row ───────────────────────── */

// Compact secondary KPI — the same numbers, smaller chrome: label, current
// value, delta chip, and a muted "was N" so the row stays scannable.
const SecondaryRow: React.FC<{
  label: string;
  current: number;
  previous: number;
}> = ({ label, current, previous }) => {
  const delta = computeDelta(current, previous);
  return (
    <div
      className="rounded-xl px-3.5 py-3"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--spark-border)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className="mono text-[9px]"
          style={{
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </p>
        <DeltaChip delta={delta} />
      </div>
      <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
        <p
          className="display tab-num font-bold"
          style={{
            fontSize: "1.15rem",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: "var(--spark-text)",
          }}
        >
          {fmt(current)}
        </p>
        <span
          className="tab-num text-[11px]"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          was {fmt(previous)}
        </span>
      </div>
    </div>
  );
};

/* ───────────────────────── period toggle ───────────────────────── */

// "month" | "quarter" | "year" — drives the $period query variable below, so
// selecting an option refetches the comparison. Default = This month.
const PERIOD_OPTIONS = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
] as const;

/* ───────────────────────── card ───────────────────────── */

const TenantKpiComparison: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  // Default = "month". The selected value drives the $period query variable
  // below, so changing it refetches via useLazyLoadQuery.
  const [period, setPeriod] = useState<string>("month");

  const data = useLazyLoadQuery<TenantKpiComparisonQueryType>(
    TenantKpiComparisonQuery,
    { tenantId, period },
    { fetchPolicy: "store-or-network" },
  );

  const comparison = data?.tenantKpiComparison;

  // Headline KPIs — prominent comparison tiles, in the same order/accents the
  // KPI panel uses for these four.
  const headline = useMemo(() => {
    if (!comparison) return [];
    const { current: c, previous: p } = comparison;
    return [
      { label: "Consumers reached", current: c.consumersReached, previous: p.consumersReached, tone: "lime" as const },
      { label: "Samples distributed", current: c.samplesDistributed, previous: p.samplesDistributed, tone: "lime" as const },
      { label: "Products sold", current: c.productsSold, previous: p.productsSold, tone: "gold" as const },
      { label: "Total engagements", current: c.totalEngagements, previous: p.totalEngagements, tone: "sky" as const },
    ];
  }, [comparison]);

  // Secondary KPIs — compact grid below.
  const secondary = useMemo(() => {
    if (!comparison) return [];
    const { current: c, previous: p } = comparison;
    return [
      { label: "Events", current: c.events, previous: p.events },
      { label: "Recaps", current: c.recaps, previous: p.recaps },
      { label: "First-time", current: c.firstTimeConsumers, previous: p.firstTimeConsumers },
      { label: "Brand-aware", current: c.brandAwareConsumers, previous: p.brandAwareConsumers },
      { label: "Willing to purchase", current: c.willingToPurchase, previous: p.willingToPurchase },
    ];
  }, [comparison]);

  // No data for this period → render NOTHING (no empty frame).
  if (!comparison) return null;

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="min-w-0">
          <h2
            className="display text-lg lg:text-xl font-bold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Period comparison
          </h2>
          <p
            className="text-[13px] mt-1"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {comparison.currentLabel} vs {comparison.previousLabel}
          </p>
        </div>
        {/* Compact period toggle — drives the $period query variable above, so
            switching refetches the comparison. Default = Month. Styled like the
            year dropdown in <TenantKpiCharts>. */}
        <select
          aria-label="Comparison period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="mono text-[11px] rounded-lg px-2.5 py-1.5 cursor-pointer"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            letterSpacing: "0.06em",
          }}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Headline KPIs — prominent comparison tiles. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {headline.map((t) => (
          <ComparisonTile
            key={t.label}
            label={t.label}
            current={t.current}
            previous={t.previous}
            tone={t.tone}
          />
        ))}
      </div>

      {/* Secondary KPIs — compact grid below. */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {secondary.map((s) => (
          <SecondaryRow
            key={s.label}
            label={s.label}
            current={s.current}
            previous={s.previous}
          />
        ))}
      </div>
    </div>
  );
};

export default TenantKpiComparison;
