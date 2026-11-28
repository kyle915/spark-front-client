import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { CalendarRange, Plus } from "lucide-react";
import WhatChangedLine from "@/components/explain/WhatChangedLine";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import useSparkRole from "@/hooks/useSparkRole";
import { ofAsked } from "@/lib/consumerBreakdown";
import { LeafTabs } from "@/motion/LeafTabs";
import { KpiDeltaBadge, type KpiDirection } from "@/motion/StudioKpiCard";
import { TenantConversionKpisQuery } from "@/api/queries/TenantConversionKpisQuery";
import type { TenantConversionKpisQuery as TenantConversionKpisQueryType } from "@api/queries/__generated__/TenantConversionKpisQuery.graphql";
import { TenantRequestsRollupQuery } from "@/api/queries/TenantRequestsRollupQuery";
import type { TenantRequestsRollupQuery as TenantRequestsRollupQueryType } from "@api/queries/__generated__/TenantRequestsRollupQuery.graphql";
import { conversionFigure } from "@/components/pages/reports/conversionTile";
import {
  formatPercentDelta,
  formatPointDelta,
} from "@/components/pages/reports/programReportHelpers";
import {
  computeSnapshotHorizon,
  SNAPSHOT_HORIZON_OPTIONS,
  type ClientSnapshotHorizon,
} from "./clientSnapshotHelpers";

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";

/**
 * Brand Client Program Snapshot — 30d / 90d / YTD LeafTabs, 5 buyer-critical
 * KPIs (Events Run, Consumers Sampled, Units Sold, Sample-to-Sale Conversion %,
 * and Purchase Intent) with KpiDeltaBadge prior-window comparisons, plus a
 * welcoming "Launch in progress" onboarding card when a newly launched brand
 * has 0 completed recaps yet.
 */
export const ClientProgramSnapshot: React.FC<{ tenantId: string }> = ({
  tenantId,
}) => {
  const [horizon, setHorizon] = useState<ClientSnapshotHorizon>("30d");
  const windowInfo = useMemo(() => computeSnapshotHorizon(horizon), [horizon]);
  const { startDate, endDate, priorStart, priorEnd, heading, priorLabel } =
    windowInfo;

  const { isClient } = useSparkRole();
  const filters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate,
      endDate,
      ...(isClient ? { clientView: true } : {}),
    }),
    [startDate, endDate, isClient],
  );
  const { dashboard } = useEventDashboardData(tenantId, filters, 0);
  const m = dashboard.metrics;

  const priorFilters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: priorStart,
      endDate: priorEnd,
      ...(isClient ? { clientView: true } : {}),
    }),
    [priorStart, priorEnd, isClient],
  );
  const prior = useEventDashboardData(tenantId, priorFilters, 0).dashboard
    .metrics;

  const convData = useLazyLoadQuery<TenantConversionKpisQueryType>(
    TenantConversionKpisQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const convKpis = convData.tenantConversionKpis;
  const sold = convKpis?.sold ?? 0;
  const convSampled = convKpis?.engagements ?? 0;
  const convPct = convKpis?.pct ?? null;
  const convDisplay = conversionFigure(sold, convSampled, convPct);

  // Upcoming 90-day scheduled activations rollup (powers the welcoming launch
  // state when a newly onboarded brand has 0 completed recaps yet).
  const upcomingRollup = useLazyLoadQuery<TenantRequestsRollupQueryType>(
    TenantRequestsRollupQuery,
    {
      tenantId,
      startDate: endDate,
      endDate: windowInfo.upcomingEndDate,
      dateField: "date",
    },
    { fetchPolicy: "store-or-network" },
  ).tenantRequestsRollup;

  const upcomingCount = useMemo(
    () =>
      (upcomingRollup?.byDay ?? []).reduce(
        (sum, row) => sum + (row.count > 0 ? row.count : 0),
        0,
      ),
    [upcomingRollup?.byDay],
  );
  const upcomingRetailers = useMemo(
    () =>
      (upcomingRollup?.topRetailers ?? [])
        .map((r) => r.name.trim())
        .filter((n) => Boolean(n) && !["—", "–", "-"].includes(n))
        .slice(0, 3),
    [upcomingRollup?.topRetailers],
  );

  const intent = ofAsked(m.purchaseIntent, m.purchaseIntentBase);
  const hasPriorActivity = (prior.totalEvents ?? 0) > 0;
  const hasPriorConv = (convKpis?.previousRecaps ?? 0) > 0;

  const hasActivity =
    (m.totalEvents ?? 0) > 0 || (m.consumersSampled ?? 0) > 0 || sold > 0;

  if (!hasActivity) {
    return (
      <section
        className="spark-card p-5 sm:p-6 space-y-4"
        aria-label="Program launch status"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(var(--spark-accent-rgb), 0.14)",
              color: "var(--spark-text)",
              border: "1px solid rgba(var(--spark-accent-rgb), 0.35)",
            }}
          >
            <span
              aria-hidden
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--spark-lime)" }}
            />
            Launch in progress
          </span>
          <LeafTabs
            ariaLabel="Program snapshot horizon"
            value={horizon}
            onChange={setHorizon}
            options={SNAPSHOT_HORIZON_OPTIONS}
          />
        </div>

        <div>
          <h2
            className="text-xl sm:text-2xl font-semibold"
            style={{ letterSpacing: "-0.02em" }}
          >
            {upcomingCount > 0
              ? `Launch in progress — ${upcomingCount.toLocaleString()} upcoming ${
                  upcomingCount === 1 ? "activation" : "activations"
                } scheduled`
              : `No approved recaps in ${heading.toLowerCase()} yet`}
          </h2>
          <p
            className="text-sm mt-1.5 leading-relaxed max-w-2xl"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            {upcomingCount > 0
              ? `Your field slate is on the calendar${
                  upcomingRetailers.length > 0
                    ? ` across ${upcomingRetailers.join(", ")}`
                    : ""
                }. Consumers sampled, units sold, sample-to-sale conversion, and store photos will populate here automatically as recaps are approved.`
              : "Switch to a wider window above or schedule your next retail activation to start tracking consumers sampled, units sold, and conversion."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {upcomingCount > 0 ? (
            <Link
              to="/upcoming"
              className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 no-underline transition hover:opacity-90"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
              }}
            >
              <CalendarRange size={13.5} strokeWidth={1.9} />
              View upcoming schedule
            </Link>
          ) : null}
          <Link
            to="/requests/create"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 no-underline transition hover:opacity-90"
            style={
              upcomingCount > 0
                ? {
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                    background: "var(--spark-surface-2)",
                  }
                : {
                    background: "var(--spark-lime)",
                    color: "var(--spark-on-accent)",
                  }
            }
          >
            <Plus size={13.5} strokeWidth={2} />
            Schedule activation
          </Link>
        </div>
      </section>
    );
  }

  const eventsDelta = hasPriorActivity
    ? formatPercentDelta(m.totalEvents, prior.totalEvents, priorLabel)
    : null;
  const sampledDelta = hasPriorActivity
    ? formatPercentDelta(m.consumersSampled, prior.consumersSampled, priorLabel)
    : null;
  const soldDelta = hasPriorConv
    ? formatPercentDelta(sold, convKpis?.previousSold, priorLabel)
    : null;
  const convDelta = hasPriorConv
    ? formatPointDelta(convPct, convKpis?.previousPct, priorLabel)
    : null;
  const intentDelta = hasPriorActivity
    ? formatPointDelta(m.purchaseIntent, prior.purchaseIntent, priorLabel)
    : null;

  const tiles: Array<{
    key: string;
    label: string;
    value: string;
    sub: string;
    delta: { text: string; direction: KpiDirection } | null;
  }> = [
    {
      key: "events",
      label: m.totalEvents === 1 ? "Event run" : "Events run",
      value: fmtNum(m.totalEvents),
      sub: "approved recaps",
      delta: eventsDelta,
    },
    {
      key: "sampled",
      label: "Consumers sampled",
      value: fmtNum(m.consumersSampled),
      sub: "field engagements",
      delta: sampledDelta,
    },
    {
      key: "sold",
      label: "Units sold",
      value: sold > 0 || convSampled > 0 ? fmtNum(sold) : "—",
      sub: "retail & on-premise",
      delta: soldDelta,
    },
    {
      key: "conversion",
      label: "Conversion",
      value: convDisplay,
      sub:
        sold > 0 && convSampled > 0
          ? `${sold.toLocaleString()} ÷ ${convSampled.toLocaleString()} sampled`
          : "sample-to-sale",
      delta: convDelta,
    },
    {
      key: "intent",
      label: "Purchase intent",
      value: intent ? intent.rate : "—",
      sub: intent?.asked ? `${intent.asked} asked` : "said they'd buy",
      delta: intentDelta,
    },
  ];

  return (
    <section
      className="spark-card p-5 sm:p-6"
      aria-label={`Your program · ${heading}`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2
            className="text-xl sm:text-2xl font-semibold"
            style={{ letterSpacing: "-0.02em" }}
          >
            {heading}
          </h2>
          <LeafTabs
            ariaLabel="Program snapshot horizon"
            value={horizon}
            onChange={setHorizon}
            options={SNAPSHOT_HORIZON_OPTIONS}
          />
        </div>
        <Link
          to="/reports"
          className="px-3.5 py-1.5 rounded-[8px] text-xs font-semibold no-underline transition hover:opacity-90"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
          }}
        >
          Open program report
        </Link>
      </div>

      <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {tiles.map((t) => (
          <div
            key={t.key}
            className="rounded-xl p-3 flex flex-col justify-between gap-1.5 min-w-0"
            style={{
              background: "var(--spark-surface-2)",
              border: "1px solid var(--spark-hairline, var(--spark-border))",
            }}
          >
            <dt
              className="text-xs font-medium truncate"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              {t.label}
            </dt>
            <dd className="m-0 space-y-1">
              <div
                className="text-2xl font-bold tab-num leading-none"
                style={{ letterSpacing: "-0.03em", color: "var(--spark-text)" }}
              >
                {t.value}
              </div>
              {t.delta ? (
                <div>
                  <KpiDeltaBadge
                    direction={t.delta.direction}
                    label={t.delta.text}
                  />
                </div>
              ) : (
                <p
                  className="text-[11px] truncate m-0"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {t.sub}
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <WhatChangedLine
        tenantId={tenantId}
        startDate={startDate}
        endDate={endDate}
        className="mt-4"
      />
    </section>
  );
};

export default ClientProgramSnapshot;
