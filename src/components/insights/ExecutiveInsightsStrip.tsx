import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
  audienceGapLabel,
  computeRateDelta,
  formatRateDeltaLabel,
  type RateDelta,
} from "@/lib/periodDelta";
import { conversionSplitNote } from "@/shared/sparkStat";
import { useAlertStore } from "@/store/alertStore";
import {
  ACTIVATION_BADGE_LABEL,
  buildProgramPulseCopy,
  buildProgramPulseOneLiner,
  type MixBucket,
  type SkuRow,
} from "@/components/insights/programPulseCopy";

/**
 * Executive Insights strip: conversion (Retail+On-Prem), trial quality,
 * this-week field cadence, activation-mix badges, top SKUs sampled, and a
 * one-liner + Slack copy built only from aggregates already on the page.
 */

const fmt = (n: number) => n.toLocaleString();

const ACTIVATION_BADGE_COLOR: Record<string, string> = {
  retail: "var(--spark-orange)",
  onprem: "rgba(255,255,255,0.65)",
  event: "var(--spark-sky)",
};

const rateChip = (d: RateDelta): { label: string; color: string } | null => {
  if (d.kind === "none") return null;
  const color =
    d.kind === "pts" && d.pts > 0
      ? "var(--spark-text)"
      : d.kind === "pts" && d.pts < 0
        ? "var(--spark-orange)"
        : "rgba(255,255,255,0.55)";
  return { label: formatRateDeltaLabel(d), color };
};

const Tile: React.FC<{
  eyebrow: string;
  label: string;
  value: string;
  hint?: string;
  chip?: { label: string; color: string } | null;
  accent?: "good" | "orange" | "neutral";
}> = ({ eyebrow, label, value, hint, chip, accent = "neutral" }) => (
  <div
    className="py-1 px-1"
    style={{
      borderLeft:
        accent === "orange"
          ? "2px solid var(--spark-orange)"
          : "1px solid var(--spark-border)",
      paddingLeft: 14,
    }}
  >
    <p
      className="display text-[12px]"
      style={{ color: "rgba(255,255,255,0.45)" }}
    >
      {eyebrow}
    </p>
    <p
      className="display text-[13px] mt-0.5"
      style={{ color: "rgba(255,255,255,0.62)" }}
    >
      {label}
    </p>
    <div className="flex items-baseline gap-2 mt-1 flex-wrap">
      <p
        className="tab-num font-bold text-2xl"
        style={{
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          letterSpacing: "-0.03em",
          color:
            accent === "orange"
              ? "var(--spark-orange)"
              : "var(--spark-text)",
        }}
      >
        {value}
      </p>
      {chip && (
        <span
          className="display text-[11px] px-2 py-0.5 rounded-md"
          style={{
            color: chip.color,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--spark-border)",
          }}
        >
          {chip.label}
        </span>
      )}
    </div>
    {hint && (
      <p
        className="text-[12px] mt-1.5 leading-snug"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {hint}
      </p>
    )}
  </div>
);

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

type ConvValue = TenantConversionKpisQueryType["response"]["tenantConversionKpis"];
type CadenceValue = TenantFieldCadenceQueryType["response"]["tenantFieldCadence"];
type CompareValue = TenantKpiComparisonQueryType["response"]["tenantKpiComparison"];
type MixValue = TenantActivationBreakdownQueryType["response"]["tenantActivationBreakdown"];

/** One query per sibling so the four pulse reads start together. */
const ConversionPulseQuery: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  onData: (value: ConvValue) => void;
}> = ({ tenantId, startDate, endDate, onData }) => {
  const data = useLazyLoadQuery<TenantConversionKpisQueryType>(
    TenantConversionKpisQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const value = data.tenantConversionKpis;
  useEffect(() => {
    onData(value);
  }, [value, onData]);
  return null;
};

const CadencePulseQuery: React.FC<{
  tenantId: string;
  onData: (value: CadenceValue) => void;
}> = ({ tenantId, onData }) => {
  const data = useLazyLoadQuery<TenantFieldCadenceQueryType>(
    TenantFieldCadenceQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const value = data.tenantFieldCadence;
  useEffect(() => {
    onData(value);
  }, [value, onData]);
  return null;
};

const ComparePulseQuery: React.FC<{
  tenantId: string;
  period: "month" | "quarter" | "year";
  onData: (value: CompareValue) => void;
}> = ({ tenantId, period, onData }) => {
  const data = useLazyLoadQuery<TenantKpiComparisonQueryType>(
    TenantKpiComparisonQuery,
    { tenantId, period },
    { fetchPolicy: "store-or-network" },
  );
  const value = data.tenantKpiComparison;
  useEffect(() => {
    onData(value);
  }, [value, onData]);
  return null;
};

const MixPulseQuery: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  onData: (value: MixValue) => void;
}> = ({ tenantId, startDate, endDate, onData }) => {
  const data = useLazyLoadQuery<TenantActivationBreakdownQueryType>(
    TenantActivationBreakdownQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const value = data.tenantActivationBreakdown;
  useEffect(() => {
    onData(value);
  }, [value, onData]);
  return null;
};

const PulseCard: React.FC<{
  startDate: string;
  endDate: string;
  rangeLabel: string;
  comparisonPeriod: "month" | "quarter" | "year";
  chromeless?: boolean;
  conv: ConvValue;
  cadence: CadenceValue;
  compare: CompareValue;
  mixData: MixValue;
  skuState: { topSkus: SkuRow[]; totalSamples: number };
}> = ({
  startDate,
  endDate,
  rangeLabel,
  comparisonPeriod,
  chromeless = false,
  conv,
  cadence,
  compare,
  mixData,
  skuState,
}) => {
  const { showAlert } = useAlertStore();
  const [copying, setCopying] = useState(false);
  const topSkus = skuState.topSkus;

  const mix = useMemo((): MixBucket[] => {
    const buckets = mixData?.buckets ?? [];
    return (["retail", "onprem", "event"] as const).map((key) => {
      const row = buckets.find((b) => b.key === key);
      return {
        key,
        label: ACTIVATION_BADGE_LABEL[key] ?? key,
        count: row?.count ?? 0,
      };
    });
  }, [mixData]);

  const convDelta = useMemo(
    () =>
      conv?.pct == null
        ? null
        : computeRateDelta(conv.pct, conv.previousPct, conv.sparseNote),
    [conv?.pct, conv?.previousPct, conv?.sparseNote],
  );

  const trial = useMemo(() => {
    if (!compare) return null;
    const audience = (
      side: typeof compare.current,
    ): { consumers: number; firstTime: number } =>
      side.program
        ? {
            // Only recaps whose template asked first-time.
            consumers: side.program.firstTimeBase,
            firstTime: side.program.firstTimeConsumers,
          }
        : {
            consumers:
              collapseSamplingKpis({
                consumersReached: side.consumersReached,
                samplesDistributed: side.samplesDistributed,
                totalEngagements: side.totalEngagements,
              })[0]?.value ?? 0,
            firstTime: side.firstTimeConsumers,
          };
    const cur = audience(compare.current);
    const prev = audience(compare.previous);
    if (cur.consumers <= 0 || cur.firstTime <= 0) return null;
    const pct = Math.round((cur.firstTime / cur.consumers) * 1000) / 10;
    const prevPct =
      prev.consumers > 0 && prev.firstTime > 0
        ? Math.round((prev.firstTime / prev.consumers) * 1000) / 10
        : null;
    const gap = audienceGapLabel(
      compare.current.program,
      compare.previous.program,
      compare.currentLabel,
      compare.previousLabel,
    );
    return {
      pct,
      prevPct,
      firstTime: cur.firstTime,
      consumers: cur.consumers,
      delta: computeRateDelta(
        pct,
        prevPct,
        compare.sparseNote ||
          (gap ? `${gap} recaps didn't all ask first-time — change hidden.` : null),
      ),
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
    convPctValue != null && convPctValue > 0 && convPctValue < 20
      ? ("orange" as const)
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
    <div
      className={chromeless ? undefined : "spark-card p-5 lg:p-6"}
      style={chromeless ? undefined : { borderRadius: 22 }}
    >
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div className="min-w-0">
          <p
            className="display text-[12px]"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Executive · {rangeLabel}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <h2
              className="display text-lg font-bold"
              style={{ letterSpacing: "-0.02em" }}
            >
              Program pulse
            </h2>
            {mix.map((b) => {
              const active = b.count > 0;
              const color = active
                ? (ACTIVATION_BADGE_COLOR[b.key] ?? "rgba(255,255,255,0.45)")
                : "rgba(255,255,255,0.35)";
              return (
                <span
                  key={b.key}
                  className="display text-[11px] px-2 py-0.5 rounded-md inline-flex items-center gap-1.5"
                  style={{
                    color,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? `${color}55` : "var(--spark-border)"}`,
                    opacity: active ? 1 : 0.45,
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
            color: "rgba(255,255,255,0.7)",
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
          eyebrow="Retail + on-prem"
          label="Conversion"
          value={convPct}
          hint={
            convPctValue != null
              ? `${fmt(sold)} sold ÷ ${fmt(sampled)} ${
                  conv.dryRecaps ? "sampled + engaged" : "sampled"
                }${
                  conv.previousLabel &&
                  !(
                    convDelta?.kind === "sparse" &&
                    convDelta.note.startsWith(conv.previousLabel)
                  )
                    ? ` · vs ${conv.previousLabel}${
                        convDelta?.kind === "pts"
                          ? ` (${conv.previousPct?.toFixed(1)}%)`
                          : ""
                      }`
                    : ""
                }${
                  convDelta?.kind === "sparse" ? ` · ${convDelta.note}` : ""
                }${conversionSplitNote(conv)}`.trim()
              : "No Retail / On-Prem sold ÷ sampled in this range"
          }
          chip={convDelta ? rateChip(convDelta) : null}
          accent={convAccent}
        />
        <Tile
          eyebrow={trial ? trial.label : comparisonPeriod}
          label="Trial quality"
          value={trial ? `${trial.pct}%` : "—"}
          hint={
            trial
              ? `${fmt(trial.firstTime)} first-time ÷ ${fmt(trial.consumers)} consumers${
                  trial.delta.kind === "pts"
                    ? ` · vs ${trial.previousLabel} (${trial.prevPct?.toFixed(1)}%)`
                    : trial.delta.kind === "sparse"
                      ? ` · ${trial.delta.note}`
                      : ""
                }`
              : "Hidden until first-time and consumers both exist"
          }
          chip={trial ? rateChip(trial.delta) : null}
          accent="neutral"
        />
        <Tile
          eyebrow="This week in field"
          label="Scheduled → approved"
          value={`${fmt(cadence?.scheduledNext7 ?? 0)} · ${fmt(cadence?.approvedRecapsLast7 ?? 0)}`}
          hint={`Next 7d scheduled · last 7d approved recaps`}
          accent="neutral"
        />
      </div>

      {topSkus.length > 0 && (
        <div
          className="mt-4 pt-4"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <p
              className="display text-[12px]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Top SKUs sampled · approved · structured
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
                        background: "rgba(242,243,238,0.55)",
                      }}
                    />
                  </div>
                  <p
                    className="tab-num mono text-sm font-semibold tabular-nums"
                    style={{
                      color: "var(--spark-text)",
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

type PulseProps = {
  tenantId: string;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  comparisonPeriod: "month" | "quarter" | "year";
  /** Skip outer spark-card when nested in a connected bento. */
  chromeless?: boolean;
};

function useReported<T>(onSame: (prev: T, next: T) => boolean) {
  const [slot, setSlot] = useState<{ seen: true; value: T } | { seen: false }>(
    { seen: false },
  );
  const onData = useCallback(
    (value: T) => {
      setSlot((prev) =>
        prev.seen && onSame(prev.value, value) ? prev : { seen: true, value },
      );
    },
    [onSame],
  );
  return { slot, onData };
}

const sameRef = <T,>(prev: T, next: T) => prev === next;

function PulseQueries(props: PulseProps) {
  const { tenantId, startDate, endDate, comparisonPeriod } = props;
  const conv = useReported<ConvValue>(sameRef);
  const cadence = useReported<CadenceValue>(sameRef);
  const compare = useReported<CompareValue>(sameRef);
  const mix = useReported<MixValue>(sameRef);
  const [skuState, setSkuState] = useState<{
    topSkus: SkuRow[];
    totalSamples: number;
  }>({ topSkus: [], totalSamples: 0 });
  const onSku = useCallback(
    (next: { topSkus: SkuRow[]; totalSamples: number }) => {
      setSkuState((prev) =>
        prev.totalSamples === next.totalSamples &&
        prev.topSkus.length === next.topSkus.length &&
        prev.topSkus.every(
          (row, i) =>
            row.product === next.topSkus[i]?.product &&
            row.samples === next.topSkus[i]?.samples,
        )
          ? prev
          : next,
      );
    },
    [],
  );

  return (
    <>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <SkuPulseLoader
            tenantId={tenantId}
            startDate={startDate}
            endDate={endDate}
            onData={onSku}
          />
        </Suspense>
      </ErrorBoundary>
      <Suspense fallback={null}>
        <ConversionPulseQuery
          tenantId={tenantId}
          startDate={startDate}
          endDate={endDate}
          onData={conv.onData}
        />
        <CadencePulseQuery tenantId={tenantId} onData={cadence.onData} />
        <ComparePulseQuery
          tenantId={tenantId}
          period={comparisonPeriod}
          onData={compare.onData}
        />
        <MixPulseQuery
          tenantId={tenantId}
          startDate={startDate}
          endDate={endDate}
          onData={mix.onData}
        />
        {conv.slot.seen &&
        cadence.slot.seen &&
        compare.slot.seen &&
        mix.slot.seen ? (
          <PulseCard
            startDate={startDate}
            endDate={endDate}
            rangeLabel={props.rangeLabel}
            comparisonPeriod={comparisonPeriod}
            chromeless={props.chromeless}
            conv={conv.slot.value}
            cadence={cadence.slot.value}
            compare={compare.slot.value}
            mixData={mix.slot.value}
            skuState={skuState}
          />
        ) : null}
      </Suspense>
    </>
  );
}

export default function ExecutiveInsightsStrip(props: PulseProps) {
  return (
    <PulseQueries
      key={`${props.tenantId}|${props.startDate}|${props.endDate}|${props.comparisonPeriod}`}
      {...props}
    />
  );
}
