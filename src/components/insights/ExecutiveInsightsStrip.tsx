import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TenantActivationBreakdownQuery } from "@/api/queries/TenantActivationBreakdownQuery";
import type { TenantActivationBreakdownQuery as TenantActivationBreakdownQueryType } from "@api/queries/__generated__/TenantActivationBreakdownQuery.graphql";
import { TenantConversionKpisQuery } from "@/api/queries/TenantConversionKpisQuery";
import type { TenantConversionKpisQuery as TenantConversionKpisQueryType } from "@api/queries/__generated__/TenantConversionKpisQuery.graphql";
import { TenantFieldCadenceQuery } from "@/api/queries/TenantFieldCadenceQuery";
import type { TenantFieldCadenceQuery as TenantFieldCadenceQueryType } from "@api/queries/__generated__/TenantFieldCadenceQuery.graphql";
import { TenantKpiComparisonQuery } from "@/api/queries/TenantKpiComparisonQuery";
import type { TenantKpiComparisonQuery as TenantKpiComparisonQueryType } from "@api/queries/__generated__/TenantKpiComparisonQuery.graphql";
import { TenantSkuPulseQuery } from "@/api/queries/TenantSkuPulseQuery";
import type { TenantSkuPulseQuery as TenantSkuPulseQueryType } from "@api/queries/__generated__/TenantSkuPulseQuery.graphql";
import { collapseSamplingKpis } from "@/lib/collapseSamplingKpis";
import {
  computePeriodDelta,
  periodDeltaNote,
  type PeriodDelta,
} from "@/lib/periodDelta";
import { useAlertStore } from "@/store/alertStore";

/**
 * Executive Insights strip: conversion (Retail+On-Prem), trial quality,
 * this-week field cadence, activation-mix badges, top SKUs sampled, and a
 * one-liner + Slack copy built only from aggregates already on the page.
 */

const fmt = (n: number) => n.toLocaleString();

/** Compact Program-pulse badge labels (distinct from the big activation card). */
const ACTIVATION_BADGE_LABEL: Record<string, string> = {
  retail: "Retail demos",
  onprem: "On-prem samplings",
  event: "Events",
};

const ACTIVATION_BADGE_COLOR: Record<string, string> = {
  retail: "var(--spark-lime)",
  onprem: "var(--spark-orange)",
  event: "var(--spark-sky)",
};

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

type MixBucket = { key: string; label: string; count: number };
type SkuRow = { product: string; samples: number };

/** Slack / Ask-AI one-liner from real page aggregates only — no invented rates. */
export function buildProgramPulseOneLiner(opts: {
  rangeLabel: string;
  convPct: number | null;
  sold: number;
  sampled: number;
  mix: MixBucket[];
  topSkus: SkuRow[];
  totalSamples: number;
}): string {
  const parts: string[] = [];
  if (opts.convPct != null && opts.sold > 0 && opts.sampled > 0) {
    parts.push(
      `${Math.round(opts.convPct)}% conversion (${fmt(opts.sold)} sold ÷ ${fmt(opts.sampled)} sampled, Retail + On-Prem)`,
    );
  } else if (opts.sold > 0 || opts.sampled > 0) {
    parts.push(
      `${fmt(opts.sold)} sold and ${fmt(opts.sampled)} sampled on Retail + On-Prem`,
    );
  }

  const mixBits = opts.mix
    .filter((b) => b.count > 0)
    .map((b) => `${fmt(b.count)} ${b.label}`);
  if (mixBits.length > 0) {
    parts.push(`activation mix ${mixBits.join(", ")}`);
  }

  if (opts.topSkus.length > 0 && opts.totalSamples > 0) {
    const lead = opts.topSkus[0];
    parts.push(
      `top SKU ${lead.product} with ${fmt(lead.samples)} samples handed out (${fmt(opts.totalSamples)} structured total)`,
    );
  }

  if (parts.length === 0) {
    return `No conversion, activation, or SKU sample totals in ${opts.rangeLabel} yet.`;
  }
  return `In ${opts.rangeLabel}: ${parts.join("; ")}.`;
}

export function buildProgramPulseCopy(opts: {
  rangeLabel: string;
  startDate: string;
  endDate: string;
  convPct: number | null;
  sold: number;
  sampled: number;
  mix: MixBucket[];
  topSkus: SkuRow[];
  totalSamples: number;
  oneLiner: string;
}): string {
  const lines: string[] = [
    `*Program pulse — ${opts.rangeLabel.toUpperCase()} (${opts.startDate} → ${opts.endDate})*`,
    "",
    opts.oneLiner,
    "",
  ];

  if (opts.convPct != null && opts.sold > 0 && opts.sampled > 0) {
    lines.push(
      `• Conversion (Retail + On-Prem): ${Math.round(opts.convPct)}% · ${fmt(opts.sold)} sold ÷ ${fmt(opts.sampled)} sampled`,
    );
  } else {
    lines.push(
      `• Conversion (Retail + On-Prem): — · ${fmt(opts.sold)} sold ÷ ${fmt(opts.sampled)} sampled`,
    );
  }

  const mixLine = opts.mix
    .filter((b) => ACTIVATION_BADGE_LABEL[b.key])
    .map((b) => `${ACTIVATION_BADGE_LABEL[b.key]} ${fmt(b.count)}`)
    .join(" · ");
  if (mixLine) {
    lines.push(`• Activation mix: ${mixLine}`);
  }

  if (opts.topSkus.length > 0) {
    lines.push(
      `• Top SKUs sampled (structured): ${opts.topSkus
        .slice(0, 5)
        .map((s) => `${s.product} ${fmt(s.samples)}`)
        .join(" · ")}`,
    );
    if (opts.sold > 0) {
      lines.push(
        `• Products purchased (Retail + On-Prem aggregate, not per SKU): ${fmt(opts.sold)}`,
      );
    }
  }

  lines.push("", "From Spark Dashboard · Program pulse");
  return lines.join("\n");
}

/** Isolated so a missing/pre-deploy `tenantSkuPulse` field cannot blank the strip. */
const SkuPulseLoader: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  onData: (data: { topSkus: SkuRow[]; totalSamples: number }) => void;
}> = ({ tenantId, startDate, endDate, onData }) => {
  const skuData = useLazyLoadQuery<TenantSkuPulseQueryType>(
    TenantSkuPulseQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const sku = skuData.tenantSkuPulse;
  useEffect(() => {
    onData({
      topSkus: (sku?.items ?? []).map((i) => ({
        product: i.product,
        samples: i.samples,
      })),
      totalSamples: sku?.totalSamples ?? 0,
    });
  }, [sku?.items, sku?.totalSamples, onData]);
  return null;
};

const Inner: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  comparisonPeriod: "month" | "quarter" | "year";
}> = ({ tenantId, startDate, endDate, rangeLabel, comparisonPeriod }) => {
  const { showAlert } = useAlertStore();
  const [copying, setCopying] = useState(false);
  const [skuState, setSkuState] = useState<{
    topSkus: SkuRow[];
    totalSamples: number;
  }>({ topSkus: [], totalSamples: 0 });

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
  const mixData = useLazyLoadQuery<TenantActivationBreakdownQueryType>(
    TenantActivationBreakdownQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );

  const conv = convData.tenantConversionKpis;
  const cadence = cadenceData.tenantFieldCadence;
  const compare = compareData.tenantKpiComparison;
  const topSkus = skuState.topSkus;

  const mix = useMemo((): MixBucket[] => {
    const buckets = mixData.tenantActivationBreakdown?.buckets ?? [];
    return (["retail", "onprem", "event"] as const).map((key) => {
      const row = buckets.find((b) => b.key === key);
      return {
        key,
        label: ACTIVATION_BADGE_LABEL[key] ?? key,
        count: row?.count ?? 0,
      };
    });
  }, [mixData]);

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

  const sold = conv?.sold ?? 0;
  const sampled = conv?.engagements ?? 0;
  const convPctValue =
    conv?.pct != null && sampled > 0 && sold > 0 ? conv.pct : null;
  const convPct = convPctValue != null ? `${Math.round(convPctValue)}%` : "—";
  const convAccent =
    convPctValue != null && convPctValue > 0
      ? ("lime" as const)
      : ("neutral" as const);

  const oneLiner = useMemo(
    () =>
      buildProgramPulseOneLiner({
        rangeLabel,
        convPct: convPctValue,
        sold,
        sampled,
        mix,
        topSkus,
        totalSamples: skuState.totalSamples,
      }),
    [
      rangeLabel,
      convPctValue,
      sold,
      sampled,
      mix,
      topSkus,
      skuState.totalSamples,
    ],
  );

  const onCopyPulse = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const text = buildProgramPulseCopy({
        rangeLabel,
        startDate,
        endDate,
        convPct: convPctValue,
        sold,
        sampled,
        mix,
        topSkus,
        totalSamples: skuState.totalSamples,
        oneLiner,
      });
      await navigator.clipboard.writeText(text);
      showAlert("Program pulse copied.", "success");
    } catch (err) {
      showAlert(
        `Couldn't copy: ${(err as Error).message || "clipboard blocked"}`,
        "error",
      );
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="spark-card p-5 lg:p-6" style={{ borderRadius: 22 }}>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <SkuPulseLoader
            tenantId={tenantId}
            startDate={startDate}
            endDate={endDate}
            onData={setSkuState}
          />
        </Suspense>
      </ErrorBoundary>

      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div className="min-w-0">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            EXECUTIVE · {rangeLabel.toUpperCase()}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <h2
              className="display text-lg font-bold"
              style={{ letterSpacing: "-0.02em" }}
            >
              Program pulse
            </h2>
            {mix.map((b) => {
              const color =
                ACTIVATION_BADGE_COLOR[b.key] ?? "rgba(255,255,255,0.45)";
              return (
                <span
                  key={b.key}
                  className="mono text-[10px] px-2 py-0.5 rounded-md inline-flex items-center gap-1.5"
                  style={{
                    color,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${color}55`,
                  }}
                  title={`${b.label} in ${rangeLabel}`}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: color }}
                  />
                  {fmt(b.count)} {b.label}
                </span>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={onCopyPulse}
          disabled={copying}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
            opacity: copying ? 0.5 : 1,
          }}
          title="Copy a Slack-ready Program pulse summary"
        >
          {copying ? "Copying…" : "Copy pulse"}
        </button>
      </div>

      <p
        className="text-sm mb-4"
        style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.45 }}
      >
        {oneLiner}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          eyebrow="RETAIL + ON-PREM"
          label="Conversion"
          value={convPct}
          hint={
            convPctValue != null
              ? `${fmt(sold)} sold ÷ ${fmt(sampled)} sampled${
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
            trial ? trial.label.toUpperCase() : comparisonPeriod.toUpperCase()
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

      {topSkus.length > 0 && (
        <div
          className="mt-4 pt-4"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              TOP SKUS SAMPLED · APPROVED · STRUCTURED
            </p>
            {sold > 0 && (
              <p
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Products purchased (Retail + On-Prem aggregate): {fmt(sold)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {topSkus.slice(0, 6).map((row) => {
              const max = topSkus[0]?.samples || 1;
              const pct = Math.min(100, Math.round((row.samples / max) * 100));
              return (
                <div key={row.product} className="flex items-center gap-3">
                  <p
                    className="text-sm truncate flex-1 min-w-0"
                    style={{ color: "var(--spark-text)" }}
                    title={row.product}
                  >
                    {row.product}
                  </p>
                  <div
                    className="hidden sm:block h-1.5 rounded-full overflow-hidden"
                    style={{
                      width: 96,
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: "var(--spark-lime)",
                      }}
                    />
                  </div>
                  <p
                    className="tab-num mono text-sm font-semibold tabular-nums"
                    style={{
                      color: "var(--spark-lime)",
                      minWidth: 48,
                      textAlign: "right",
                    }}
                  >
                    {fmt(row.samples)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
