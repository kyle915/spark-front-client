import { useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantKpiComparisonQuery } from "@/api/queries/TenantKpiComparisonQuery";
import type { TenantKpiComparisonQuery as TenantKpiComparisonQueryType } from "@api/queries/__generated__/TenantKpiComparisonQuery.graphql";
import {
  collapseSamplingKpis,
  previousForSamplingTile,
} from "@/lib/collapseSamplingKpis";
import {
  computePeriodDelta,
  computeRateDelta,
  formatRateDeltaLabel,
  periodDeltaNote,
  type PeriodDelta,
} from "@/lib/periodDelta";

/**
 * "Period comparison" card for the dashboards — each headline KPI this-period
 * vs last-period with an up/down delta chip.
 *
 * Loads `tenantKpiComparison(tenantId, period)` for ONE client (tenant) and
 * renders, dark-theme styled to match <TenantKpiCharts> / <TenantSentimentCard>
 * so it reads as one dashboard: a header ("Period comparison") with a muted
 * sub showing the two periods being compared ("May 2026 vs Apr 2026"), then the
 * HEADLINE KPIs (consumers sampled, samples handed out when distinct, products
 * sold, total engagements) as prominent comparison tiles, and the secondary
 * KPIs (events, recaps, first-time, brand-aware, willing to purchase) in a
 * compact grid below.
 *
 * Deltas use {@link computePeriodDelta}: honest up/down/flat chips for normal
 * moves, "New" off a zero base, and suppress/cap when the prior period is
 * sparse or the swing is absurd (collection change / bulk import) so we never
 * print trust-destroying 2000%+ figures.
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

/** Every chip when the base period is too thin; the panel says why once. */
const HIDDEN_DELTA: PeriodDelta = { kind: "sparse", label: "n/a", note: "" };

/* ───────────────────────── delta ───────────────────────── */

// Calm palette: up leans on the brand lime; down on the restrained spark-orange
// (the same hue the sentiment card reserves for a negative move) — deliberately
// NOT an alarm red, since a KPI dipping isn't a crisis. Flat / New / none /
// sparse sit quietly in a muted neutral. Solid `text` color + matching rgba bg
// / border tints, the same way <TenantKpiCharts> and <TenantSentimentCard> tint
// pills.
type ChipStyle = { label: string; text: string; bg: string; border: string };

const MUTED: Pick<ChipStyle, "text" | "bg" | "border"> = {
  text: "rgba(255,255,255,0.55)",
  bg: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.14)",
};

const chipForDelta = (d: PeriodDelta): ChipStyle => {
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
    case "sparse":
      return { label: d.label, ...MUTED };
    case "large":
      // Cap at >500% — no fake precision on wild swings. Same hue family as
      // a normal up/down so the direction is still scannable.
      if (d.direction === "up") {
        return {
          label: `↑ >${d.cappedPct}%`,
          text: "var(--spark-lime)",
          bg: "rgba(197,245,70,0.10)",
          border: "rgba(197,245,70,0.30)",
        };
      }
      return {
        label: `↓ >${d.cappedPct}%`,
        text: "var(--spark-orange)",
        bg: "rgba(239,90,42,0.10)",
        border: "rgba(239,90,42,0.32)",
      };
    default: {
      const _exhaustive: never = d;
      return _exhaustive;
    }
  }
};

/* ───────────────────────── delta chip ───────────────────────── */

const DeltaChip: React.FC<{ delta: PeriodDelta }> = ({ delta }) => {
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

const DeltaNote: React.FC<{ delta: PeriodDelta }> = ({ delta }) => {
  const note = periodDeltaNote(delta);
  if (!note) return null;
  return (
    <p
      className="text-[11px] mt-1.5 leading-snug"
      style={{ color: "rgba(255,255,255,0.45)" }}
    >
      {note}
    </p>
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
  hidePct?: boolean;
}> = ({ label, current, previous, tone, hidePct }) => {
  const delta = hidePct ? HIDDEN_DELTA : computePeriodDelta(current, previous);
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
      <DeltaNote delta={delta} />
    </div>
  );
};

/* ───────────────────────── conversion tile ───────────────────────── */

// Conversion is a rate, so its change is in percentage points, not %.
const ConversionTile: React.FC<{
  current: number | null | undefined;
  previous: number | null | undefined;
  sparseNote?: string | null;
}> = ({ current, previous, sparseNote }) => {
  const delta = computeRateDelta(current, previous, sparseNote);
  const label = formatRateDeltaLabel(delta);
  let chip: ChipStyle;
  if (delta.kind !== "pts" || delta.pts === 0) chip = { label, ...MUTED };
  else if (delta.pts > 0)
    chip = {
      label,
      text: "var(--spark-lime)",
      bg: "rgba(197,245,70,0.10)",
      border: "rgba(197,245,70,0.30)",
    };
  else
    chip = {
      label,
      text: "var(--spark-orange)",
      bg: "rgba(239,90,42,0.10)",
      border: "rgba(239,90,42,0.32)",
    };
  return (
    <div
      className="spark-card rounded-2xl px-4 py-4"
      style={{ borderTop: `2px solid ${TONE_COLOR.sky}` }}
    >
      <p
        className="mono text-[9px]"
        style={{
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
        }}
      >
        Conversion
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
          {current == null ? "—" : `${current.toFixed(1)}%`}
        </p>
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
      </div>
      <p
        className="tab-num text-[12px] mt-1"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        was {previous == null ? "—" : `${previous.toFixed(1)}%`}
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
  hidePct?: boolean;
}> = ({ label, current, previous, hidePct }) => {
  const delta = hidePct ? HIDDEN_DELTA : computePeriodDelta(current, previous);
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
      <DeltaNote delta={delta} />
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

const TenantKpiComparison: React.FC<{
  tenantId: string;
  /** When set by Insights page range, locks the comparison period. */
  period?: "month" | "quarter" | "year";
  scopeNote?: string;
}> = ({ tenantId, period: periodProp, scopeNote }) => {
  // Default = "month". The selected value drives the $period query variable
  // below, so changing it refetches via useLazyLoadQuery.
  const [periodLocal, setPeriodLocal] = useState<string>("month");
  const period = periodProp ?? periodLocal;

  const data = useLazyLoadQuery<TenantKpiComparisonQueryType>(
    TenantKpiComparisonQuery,
    { tenantId, period },
    { fetchPolicy: "store-or-network" },
  );

  const comparison = data?.tenantKpiComparison;

  // Headline KPIs — prominent comparison tiles, in the same order/accents the
  // KPI panel uses for these four.
  const salesProgram =
    comparison?.current.program && comparison?.previous.program
      ? { c: comparison.current.program, p: comparison.previous.program }
      : null;
  const hidePct = !!comparison?.sparseNote;

  const headline = useMemo(() => {
    if (!comparison) return [];
    const { current: c, previous: p } = comparison;
    if (salesProgram) {
      return [
        {
          label: "Consumers sampled",
          current: salesProgram.c.consumersSampled,
          previous: salesProgram.p.consumersSampled,
          tone: "lime" as Tone,
        },
        {
          label: "Units sold",
          current: salesProgram.c.unitsSold,
          previous: salesProgram.p.unitsSold,
          tone: "gold" as Tone,
        },
      ];
    }
    const sampling = collapseSamplingKpis({
      consumersReached: c.consumersReached,
      samplesDistributed: c.samplesDistributed,
      totalEngagements: c.totalEngagements,
    }).map((t) => ({
      label: t.label,
      current: t.value,
      previous: previousForSamplingTile(t, {
        consumersReached: p.consumersReached,
        samplesDistributed: p.samplesDistributed,
        totalEngagements: p.totalEngagements,
      }),
      tone: (t.key === "totalEngagements" ? "sky" : "lime") as Tone,
    }));
    return [
      ...sampling,
      { label: "Products sold", current: c.productsSold, previous: p.productsSold, tone: "gold" as const },
    ];
  }, [comparison, salesProgram]);

  // Secondary KPIs — compact grid below.
  const secondary = useMemo(() => {
    if (!comparison) return [];
    const { current: c, previous: p } = comparison;
    if (salesProgram) {
      const { c: sc, p: sp } = salesProgram;
      return [
        { label: "Demos", current: sc.demos, previous: sp.demos },
        { label: "Recaps", current: sc.recaps, previous: sp.recaps },
        { label: "First-time", current: sc.firstTimeConsumers, previous: sp.firstTimeConsumers },
        { label: "Brand-aware", current: sc.brandAwareConsumers, previous: sp.brandAwareConsumers },
        { label: "Willing to purchase", current: sc.willingToPurchase, previous: sp.willingToPurchase },
      ];
    }
    return [
      { label: "Events", current: c.events, previous: p.events },
      { label: "Recaps", current: c.recaps, previous: p.recaps },
      { label: "First-time", current: c.firstTimeConsumers, previous: p.firstTimeConsumers },
      { label: "Brand-aware", current: c.brandAwareConsumers, previous: p.brandAwareConsumers },
      { label: "Willing to purchase", current: c.willingToPurchase, previous: p.willingToPurchase },
    ];
  }, [comparison, salesProgram]);

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
            {scopeNote ? ` · ${scopeNote}` : ""}
          </p>
          {comparison.sparseNote && (
            <p
              className="mono text-[10px] mt-1.5"
              style={{
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {comparison.sparseNote}
            </p>
          )}
        </div>
        {/* Compact period toggle — drives the $period query variable above, so
            switching refetches the comparison. Default = Month. Styled like the
            year dropdown in <TenantKpiCharts>. Hidden when Insights locks the
            period from the page range. */}
        {!periodProp && (
          <select
            aria-label="Comparison period"
            value={period}
            onChange={(e) => setPeriodLocal(e.target.value)}
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
        )}
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
            hidePct={hidePct}
          />
        ))}
        {salesProgram && (
          <ConversionTile
            current={salesProgram.c.conversionPct}
            previous={salesProgram.p.conversionPct}
            sparseNote={comparison.sparseNote}
          />
        )}
      </div>

      {/* Secondary KPIs — compact grid below. */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {secondary.map((s) => (
          <SecondaryRow
            key={s.label}
            label={s.label}
            current={s.current}
            previous={s.previous}
            hidePct={hidePct}
          />
        ))}
      </div>
    </div>
  );
};

export default TenantKpiComparison;
