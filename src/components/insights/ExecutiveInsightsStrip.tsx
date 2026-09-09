import { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantConversionKpisQuery } from "@/api/queries/TenantConversionKpisQuery";
import type { TenantConversionKpisQuery as TenantConversionKpisQueryType } from "@api/queries/__generated__/TenantConversionKpisQuery.graphql";
import { TenantFieldCadenceQuery } from "@/api/queries/TenantFieldCadenceQuery";
import type { TenantFieldCadenceQuery as TenantFieldCadenceQueryType } from "@api/queries/__generated__/TenantFieldCadenceQuery.graphql";
import { TenantKpiComparisonQuery } from "@/api/queries/TenantKpiComparisonQuery";
import type { TenantKpiComparisonQuery as TenantKpiComparisonQueryType } from "@api/queries/__generated__/TenantKpiComparisonQuery.graphql";
import { collapseSamplingKpis } from "@/lib/collapseSamplingKpis";
import {
  computePeriodDelta,
  periodDeltaNote,
  type PeriodDelta,
} from "@/lib/periodDelta";

/**
 * Executive Insights strip: conversion (Retail+On-Prem), trial quality,
 * and this-week field cadence. Pace-to-goal stays in PaceToGoalHero above.
 */

const fmt = (n: number) => n.toLocaleString();

const deltaChip = (d: PeriodDelta): { label: string; color: string } | null => {
  switch (d.kind) {
    case "up":
      return { label: `↑ ${d.pct}%`, color: "var(--spark-lime)" };
    case "down":
      return { label: `↓ ${Math.abs(d.pct)}%`, color: "var(--spark-orange)" };
    case "flat":
      return { label: "→ 0%", color: "rgba(255,255,255,0.55)" };
    case "new":
      return { label: "New", color: "var(--spark-lime)" };
    case "sparse":
      return { label: d.label, color: "rgba(255,255,255,0.55)" };
    case "large":
      return {
        label: `${d.direction === "up" ? "↑" : "↓"} >${d.cappedPct}%`,
        color:
          d.direction === "up" ? "var(--spark-lime)" : "var(--spark-orange)",
      };
    case "none":
      return null;
    default: {
      const _exhaustive: never = d;
      return _exhaustive;
    }
  }
};

const Tile: React.FC<{
  eyebrow: string;
  label: string;
  value: string;
  hint?: string;
  chip?: { label: string; color: string } | null;
  accent?: "lime" | "orange" | "neutral";
}> = ({ eyebrow, label, value, hint, chip, accent = "neutral" }) => (
  <div
    className="rounded-xl p-4"
    style={{
      background:
        accent === "lime"
          ? "rgba(197,245,70,0.08)"
          : accent === "orange"
            ? "rgba(239,90,42,0.10)"
            : "rgba(255,255,255,0.03)",
      border: `1px solid ${
        accent === "lime"
          ? "rgba(197,245,70,0.30)"
          : accent === "orange"
            ? "rgba(239,90,42,0.35)"
            : "var(--spark-border)"
      }`,
    }}
  >
    <p
      className="mono text-[9px]"
      style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
    >
      {eyebrow}
    </p>
    <p
      className="mono text-[10px] mt-1"
      style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.55)" }}
    >
      {label.toUpperCase()}
    </p>
    <div className="flex items-baseline gap-2 mt-1 flex-wrap">
      <p
        className="tab-num font-bold text-2xl"
        style={{
          color:
            accent === "lime"
              ? "var(--spark-lime)"
              : accent === "orange"
                ? "var(--spark-orange)"
                : "var(--spark-text)",
        }}
      >
        {value}
      </p>
      {chip && (
        <span
          className="mono text-[10px] px-2 py-0.5 rounded-md"
          style={{
            color: chip.color,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {chip.label}
        </span>
      )}
    </div>
    {hint && (
      <p
        className="text-[11px] mt-1"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {hint}
      </p>
    )}
  </div>
);

const Inner: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  comparisonPeriod: "month" | "quarter" | "year";
}> = ({ tenantId, startDate, endDate, rangeLabel, comparisonPeriod }) => {
  const convData = useLazyLoadQuery<TenantConversionKpisQueryType>(
    TenantConversionKpisQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const cadenceData = useLazyLoadQuery<TenantFieldCadenceQueryType>(
    TenantFieldCadenceQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const compareData = useLazyLoadQuery<TenantKpiComparisonQueryType>(
    TenantKpiComparisonQuery,
    { tenantId, period: comparisonPeriod },
    { fetchPolicy: "store-or-network" },
  );

  const conv = convData.tenantConversionKpis;
  const cadence = cadenceData.tenantFieldCadence;
  const compare = compareData.tenantKpiComparison;

  const convDelta = useMemo(() => {
    if (conv?.pct == null || conv.previousPct == null) return null;
    return computePeriodDelta(conv.pct, conv.previousPct);
  }, [conv?.pct, conv?.previousPct]);

  const trial = useMemo(() => {
    if (!compare) return null;
    const curTiles = collapseSamplingKpis({
      consumersReached: compare.current.consumersReached,
      samplesDistributed: compare.current.samplesDistributed,
      totalEngagements: compare.current.totalEngagements,
    });
    const prevTiles = collapseSamplingKpis({
      consumersReached: compare.previous.consumersReached,
      samplesDistributed: compare.previous.samplesDistributed,
      totalEngagements: compare.previous.totalEngagements,
    });
    const consumers = curTiles[0]?.value ?? 0;
    const firstTime = compare.current.firstTimeConsumers;
    const prevConsumers = prevTiles[0]?.value ?? 0;
    const prevFirst = compare.previous.firstTimeConsumers;
    if (consumers <= 0 || firstTime <= 0) return null;
    const pct = Math.round((firstTime / consumers) * 1000) / 10;
    const prevPct =
      prevConsumers > 0 && prevFirst > 0
        ? Math.round((prevFirst / prevConsumers) * 1000) / 10
        : null;
    return {
      pct,
      firstTime,
      consumers,
      delta: prevPct == null ? null : computePeriodDelta(pct, prevPct),
      label: compare.currentLabel,
      previousLabel: compare.previousLabel,
    };
  }, [compare]);

  const convPct =
    conv?.pct != null && conv.engagements > 0 && conv.sold > 0
      ? `${Math.round(conv.pct)}%`
      : "—";
  const convAccent =
    conv?.pct != null && conv.pct > 0 ? ("lime" as const) : ("neutral" as const);

  return (
    <div className="spark-card p-5 lg:p-6" style={{ borderRadius: 22 }}>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            EXECUTIVE · {rangeLabel.toUpperCase()}
          </p>
          <h2
            className="display text-lg font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Program pulse
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          eyebrow="RETAIL + ON-PREM"
          label="Conversion"
          value={convPct}
          hint={
            conv?.pct != null
              ? `${fmt(conv.sold)} sold ÷ ${fmt(conv.engagements)} sampled${
                  conv.previousLabel ? ` · vs ${conv.previousLabel}` : ""
                }${
                  convDelta ? ` · ${periodDeltaNote(convDelta) ?? ""}` : ""
                }`.trim()
              : "No Retail / On-Prem sold ÷ sampled in this range"
          }
          chip={convDelta ? deltaChip(convDelta) : null}
          accent={convAccent}
        />
        <Tile
          eyebrow={
            trial
              ? trial.label.toUpperCase()
              : comparisonPeriod.toUpperCase()
          }
          label="Trial quality"
          value={trial ? `${trial.pct}%` : "—"}
          hint={
            trial
              ? `${fmt(trial.firstTime)} first-time ÷ ${fmt(trial.consumers)} consumers`
              : "Hidden until first-time and consumers both exist"
          }
          chip={trial?.delta ? deltaChip(trial.delta) : null}
          accent={trial ? "lime" : "neutral"}
        />
        <Tile
          eyebrow="THIS WEEK IN FIELD"
          label="Scheduled → approved"
          value={`${fmt(cadence?.scheduledNext7 ?? 0)} · ${fmt(cadence?.approvedRecapsLast7 ?? 0)}`}
          hint={`Next 7d scheduled · last 7d approved recaps`}
          accent={
            (cadence?.scheduledNext7 ?? 0) > 0 ||
            (cadence?.approvedRecapsLast7 ?? 0) > 0
              ? "lime"
              : "neutral"
          }
        />
      </div>
    </div>
  );
};

export default function ExecutiveInsightsStrip(props: {
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  comparisonPeriod: "month" | "quarter" | "year";
}) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
