import TenantGeoHeatmap from "@/components/ai/TenantGeoHeatmap";
import useStickyState from "@/hooks/useStickyState";
import { pickFieldPhoto } from "@/utils/fieldPhoto";
import ReportSubscriptionToggle from "./ReportSubscriptionToggle";
import ExecutiveSnapshotCard from "./ExecutiveSnapshotCard";
import RecapFieldTotalsSection, { SampledQuestionNote } from "./RecapFieldTotalsSection";
import FieldEfficiencySection from "./FieldEfficiencySection";
import ProgramShareControl from "./ProgramShareControl";
import { ReportsFieldPhotosQuery } from "@/api/queries/ReportsFieldPhotosQuery";
import { ReportsBestPhotosQuery } from "@/api/queries/ReportsBestPhotosQuery";
import type { ReportsBestPhotosQuery as ReportsBestPhotosQueryType } from "@api/queries/__generated__/ReportsBestPhotosQuery.graphql";
import { bestPhotoCaption, onePhotoPerStop, type FieldPhotoView } from "./fieldPhotos";
import { conversionFigure } from "./conversionTile";
import type { ReportsFieldPhotosQuery as ReportsFieldPhotosQueryType } from "@api/queries/__generated__/ReportsFieldPhotosQuery.graphql";
import CampaignPhotoHighlights from "@/reports/CampaignPhotoHighlights";
import FeedbackThemes from "@/components/charts/FeedbackThemes";
import { CompetitorMentions, ProductRegions } from "@/components/charts/CommentInsights";
import OnShelfSummary from "@/components/charts/OnShelfSummary";
import { PanelSkeleton } from "@/layout/PageSkeletons";
import { thumbUrl } from "@/utils/thumb";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import PresentModeControl from "@/shared/PresentModeControl";
import SparkSheet from "@/shared/SparkSheet";
import { REPORTS_HUB_TABS } from "@/shared/sparkHubNav";
import MonthHighlight from "@/components/explain/MonthHighlight";
import ProgramBriefCard from "./ProgramBriefCard";
import ReportEvidenceStrip from "./ReportEvidenceStrip";
import { monthOfDate } from "@/lib/storeProfile";
import SparkGhostButton, { SparkGhostLink } from "@/shared/SparkGhostButton";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { useAuthStore } from "@/store/authStore";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { Suspense, createContext, useContext, useMemo, useState } from "react";
import { fetchQuery } from "relay-runtime";
import { useLazyLoadQuery, useMutation, useRelayEnvironment } from "react-relay/hooks";
import { SendTestClientReportMutation } from "@/api/mutations/SendTestClientReportMutation";
import type { SendTestClientReportMutation as SendTestClientReportMutationType } from "@api/mutations/__generated__/SendTestClientReportMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { TenantRequestsRollupQuery } from "@/api/queries/TenantRequestsRollupQuery";
import type { TenantRequestsRollupQuery as TenantRequestsRollupQueryType } from "@api/queries/__generated__/TenantRequestsRollupQuery.graphql";
import { ConsumerBreakdownQuery } from "@/api/queries/ConsumerBreakdownQuery";
import type { ConsumerBreakdownQuery as ConsumerBreakdownQueryType } from "@api/queries/__generated__/ConsumerBreakdownQuery.graphql";
import { TenantSkuPulseQuery } from "@/api/queries/TenantSkuPulseQuery";
import type { TenantSkuPulseQuery as TenantSkuPulseQueryType } from "@api/queries/__generated__/TenantSkuPulseQuery.graphql";
import FieldEfficiencySectionQueryNode from "./__generated__/FieldEfficiencySectionQuery.graphql";
import type { FieldEfficiencySectionQuery as FieldEfficiencySectionQueryType } from "./__generated__/FieldEfficiencySectionQuery.graphql";
import "@/lib/sparkChartRegister";
import { Bar } from "react-chartjs-2";
import { labelsEveryRow, mergeSameLabel, rankRows, sharePercent } from "@/lib/chartRows";
import { barSeries, chartOptions, foldToOther, valueLabels } from "@/lib/sparkChart";
import { useAppearance } from "@/theme/appearance";
import { inputColorScheme } from "@/theme/inputColorScheme";
import ErrorBoundary from "@/components/ErrorBoundary";
import RecapDecksCard from "@/components/pages/client-recap/RecapDecksCard";
import useSparkRole from "@/hooks/useSparkRole";
import { SparkMark } from "@/recap/SparkMark";
import { askAiSubjectFromTenant } from "@/components/ai/askAiSubjectName";
import {
  ConsumerSplits,
  ConsumersAddUpNote,
  ConsumersPerWeek,
} from "@/components/charts/ConsumerCharts";
import { useConsumerBreakdown } from "@/hooks/useConsumerBreakdown";
import {
  KpiDeltaBadge,
  StudioKpiSkeleton,
} from "@/motion/StudioKpiCard";
import { ofAsked } from "@/lib/consumerBreakdown";
import { TenantConversionKpisQuery } from "@/api/queries/TenantConversionKpisQuery";
import type { TenantConversionKpisQuery as TenantConversionKpisQueryType } from "@api/queries/__generated__/TenantConversionKpisQuery.graphql";
import {
  buildProgramExecutiveBrief,
  buildProgramReportCsv,
  computePriorDateWindow,
  formatPercentDelta,
  formatPointDelta,
  type DeltaBadge,
  type ReportChartMetric,
} from "./programReportHelpers";

const everyValue = valueLabels("all");

const ChartEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="spark-chart-empty h-full">{children}</div>
);

const RankedBars: React.FC<{
  label: string;
  rows: ReadonlyArray<{ label: string; value: number }>;
}> = ({ label, rows }) => {
  useAppearance();
  return (
    <Bar
      data={{
        labels: rows.map((r) => r.label),
        datasets: [barSeries({ label, data: rows.map((r) => r.value), horizontal: true })],
      }}
      options={chartOptions<"bar">({ horizontal: true })}
      plugins={labelsEveryRow(rows.length) ? [everyValue] : []}
    />
  );
};

const isoWeekKey = (d: Date): string => {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

type RangeKey = "30" | "90" | "180" | "ytd" | "custom";
type ReportsRange = { start: Date; end: Date; label: string };

const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseYmd = (v: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const out = new Date(y, m - 1, d);
  return Number.isNaN(out.getTime()) ? null : out;
};

function buildReportsRange(
  key: RangeKey,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): ReportsRange {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const startOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  if (key === "custom") {
    const from = parseYmd(customFrom);
    const to = parseYmd(customTo);
    if (from && to && from <= to) {
      const e = new Date(to);
      e.setHours(23, 59, 59, 999);
      return { start: startOf(from), end: e, label: `${customFrom} → ${customTo}` };
    }
    key = "90";
  }
  if (key === "ytd") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end,
      label: "Year to date",
    };
  }
  const days = Number(key);
  const start = startOf(now);
  start.setDate(start.getDate() - days);
  return { start, end, label: `Last ${days} days` };
}

const weekBuckets = (range: ReportsRange) => {
  const start = new Date(range.start);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  const weeks = Math.min(
    53,
    Math.max(4, Math.ceil((range.end.getTime() - start.getTime()) / (7 * 86_400_000))),
  );
  const buckets: { key: string; count: number }[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    buckets.push({ key: isoWeekKey(d), count: 0 });
  }
  return buckets;
};

const ReportsRangeContext = createContext<ReportsRange>(
  buildReportsRange("90", "", ""),
);
const useReportsRange = () => useContext(ReportsRangeContext);

const useReportsRequestsRollup = () => {
  const { tenantId } = useAuthStore();
  const range = useReportsRange();
  return useLazyLoadQuery<TenantRequestsRollupQueryType>(
    TenantRequestsRollupQuery,
    {
      tenantId: tenantId || null,
      startDate: ymdLocal(range.start),
      endDate: ymdLocal(range.end),
      dateField: "created_at",
    },
    { fetchPolicy: "store-or-network" },
  ).tenantRequestsRollup;
};

const EventsPerWeekChart: React.FC = () => {
  useAppearance();
  const rollup = useReportsRequestsRollup();
  const range = useReportsRange();
  const { labels, values } = useMemo(() => {
    const buckets = weekBuckets(range);
    const idxByKey = new Map(buckets.map((b, i) => [b.key, i]));

    for (const dayRow of rollup.byDay) {
      const d = parseYmd(dayRow.date);
      if (!d || dayRow.count <= 0) continue;
      const key = isoWeekKey(d);
      const idx = idxByKey.get(key);
      if (idx !== undefined) buckets[idx].count += dayRow.count;
    }
    return {
      labels: buckets.map((b) => b.key),
      values: buckets.map((b) => b.count),
    };
  }, [rollup.byDay, range]);

  if (values.every((v) => v === 0)) {
    return <ChartEmpty>No requests created in this window.</ChartEmpty>;
  }
  return (
    <Bar
      data={{ labels, datasets: [barSeries({ label: "Requests created", data: values })] }}
      options={chartOptions<"bar">()}
    />
  );
};

const ActivationMixChart: React.FC = () => {
  const rollup = useReportsRequestsRollup();
  const mix = useMemo(() => {
    const rows = rollup.byRequestType
      .filter((r) => r.count > 0)
      .map((r) => ({
        label: r.name === "Unspecified" ? "Other" : r.name,
        value: r.count,
      }));
    return rankRows(mergeSameLabel(foldToOther(rows, 7)));
  }, [rollup.byRequestType]);

  if (mix.length === 0) {
    return <ChartEmpty>No requests in this date range.</ChartEmpty>;
  }
  const total = mix.reduce((sum, r) => sum + r.value, 0);
  if (mix.length === 1) {
    return (
      <div className="flex h-full flex-col justify-center gap-1">
        <p className="tab-num text-3xl font-semibold" style={{ color: "var(--spark-text)", letterSpacing: "-0.035em" }}>
          {total.toLocaleString()}
        </p>
        <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
          {total === 1 ? "request" : "requests"}, all {mix[0].label}
        </p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="relative min-h-0 flex-1">
        <RankedBars label="Requests" rows={mix} />
      </div>
      <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
        {mix[0].label} is {sharePercent(mix[0].value, total)}% of{" "}
        {total.toLocaleString()} requests.
      </p>
    </div>
  );
};

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";

const FieldPhotos: React.FC = () => {
  const { tenantId } = useAuthStore();
  const range = useReportsRange();
  const [view, setView] = useState<FieldPhotoView>("best");
  const best = useLazyLoadQuery<ReportsBestPhotosQueryType>(
    ReportsBestPhotosQuery,
    {
      tenantId: String(tenantId ?? ""),
      startDate: ymdLocal(range.start),
      endDate: ymdLocal(range.end),
      first: 80,
    },
    { fetchPolicy: "store-or-network" },
  );
  const picked = useMemo(() => {
    const frames = (best?.tenantPhotoGallery?.photos ?? []).map((p) => ({
      url: thumbUrl(p.url, 800) || p.url,
      store: p.store,
      state: p.state,
      eventDate: p.eventDate,
      caption: p.caption,
    }));
    const split = onePhotoPerStop(frames);
    const toView = (p: (typeof frames)[number]) => ({
      url: p.url,
      caption: bestPhotoCaption(p),
    });
    return { best: split.best.map(toView), rest: split.rest.map(toView) };
  }, [best]);
  const data = useLazyLoadQuery<ReportsFieldPhotosQueryType>(
    ReportsFieldPhotosQuery,
    {
      first: 60,
      filters: {
        tenantId: tenantId || null,
        startDate: ymdLocal(range.start),
        endDate: ymdLocal(range.end),
        approved: true,
      },
    },
    { fetchPolicy: "store-or-network" },
  );
  const photos = useMemo(
    () =>
      (data?.customRecaps?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map((n) => ({ n, src: pickFieldPhoto(n.customRecapFiles) }))
        .filter((x): x is { n: typeof x.n; src: string } => Boolean(x.src))
        .slice(0, 24)
        .map(({ n, src }) => {
          const day = n.eventDate
            ? new Date(`${String(n.eventDate).slice(0, 10)}T12:00:00`).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" },
              )
            : "";
          const where = [n.eventRetailer, n.eventState].filter(Boolean).join(", ");
          return {
            url: thumbUrl(src, 800) || src,
            caption: [where, day].filter(Boolean).join(" · "),
          };
        }),
    [data],
  );
  const extra = picked.rest.filter((frame) => !photos.some((photo) => photo.url === frame.url));
  const allPhotos = [...photos, ...extra];
  if (allPhotos.length === 0 && picked.best.length === 0) return null;
  const hasBest = picked.best.length > 0;
  const shown = hasBest && view === "best" ? picked.best : allPhotos;
  return (
    <div className="spark-card p-5 spark-print-keep" id="report-photos">
      {hasBest ? (
        <div
          className="pill-group mb-3 print:hidden"
          role="group"
          aria-label="Which photos to show"
        >
          {(
            [
              ["best", "Best photos"],
              ["all", "All photos"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`pill-btn whitespace-nowrap ${view === key ? "on" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <CampaignPhotoHighlights photos={shown} />
    </div>
  );
};

const ChartCard: React.FC<{
  title: string;
  subtitle: string;
  tall?: boolean;
  empty?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, tall, empty, children }) => (
  <div className="spark-card p-5 spark-print-keep">
    <h3 className="spark-title font-semibold mb-1">{title}</h3>
    <p className="text-xs mb-3" style={{ color: "var(--spark-text-meta)" }}>
      {subtitle}
    </p>
    <div
      className={
        tall
          ? "relative h-[200px] sm:h-[260px] md:h-[300px]"
          : "relative h-[180px] sm:h-[240px] md:h-[260px]"
      }
    >
      {empty ? (
        <ChartEmpty>No data for this range yet.</ChartEmpty>
      ) : (
        <Suspense
          fallback={
            <div
              className="grid place-items-center h-full text-xs"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Loading…
            </div>
          }
        >
          {children}
        </Suspense>
      )}
    </div>
  </div>
);

const RequestChartsRow: React.FC = () => {
  const rollup = useReportsRequestsRollup();
  if (rollup.totalCount <= 0) return null;
  return (
    <div className="space-y-2">
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ChartCard title="Requests per week" subtitle="Inbound activation volume.">
            <EventsPerWeekChart />
          </ChartCard>
        </div>
        <ChartCard title="Activation mix" subtitle="Requests by type in this range.">
          <ActivationMixChart />
        </ChartCard>
      </div>
    </div>
  );
};

/* ───────────────────────── summary ───────────────────────── */

const DeltaPill: React.FC<{ badge: DeltaBadge | null }> = ({ badge }) => {
  if (!badge) return null;
  return (
    <div className="mt-1.5">
      <KpiDeltaBadge direction={badge.direction} label={badge.text} />
    </div>
  );
};

const SummaryItem: React.FC<{
  label: string;
  figure: React.ReactNode;
  delta?: DeltaBadge | null;
  note?: React.ReactNode;
}> = ({ label, figure, delta, note }) => (
  <div className="min-w-0">
    <dt className="text-[13px] font-medium" style={{ color: "var(--spark-text-secondary)" }}>
      {label}
    </dt>
    <dd
      className="display tab-num m-0 mt-1 text-3xl font-semibold truncate"
      style={{ color: "var(--spark-text)", letterSpacing: "-0.035em" }}
    >
      {figure}
    </dd>
    <DeltaPill badge={delta ?? null} />
    {note ? (
      <dd className="m-0 mt-1 text-xs" style={{ color: "var(--spark-text-meta)" }}>
        {note}
      </dd>
    ) : null}
  </div>
);

const PriorConsumersDelta: React.FC<{
  tenantId: string;
  currentTotal: number;
  priorStartDate: string;
  priorEndDate: string;
  priorShortLabel: string;
}> = ({ tenantId, currentTotal, priorStartDate, priorEndDate, priorShortLabel }) => {
  const prior = useConsumerBreakdown(tenantId, priorStartDate, priorEndDate);
  const badge = formatPercentDelta(currentTotal, prior?.total, priorShortLabel);
  return <DeltaPill badge={badge} />;
};

const ConsumersSummary: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  everyRecap: number | null | undefined;
  comparePrior: boolean;
}> = ({ tenantId, startDate, endDate, everyRecap, comparePrior }) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  const { isAdmin } = useSparkRole();
  if (!breakdown) return <ConsumersUnavailable />;
  const waiting =
    isAdmin && typeof everyRecap === "number" && everyRecap > breakdown.total
      ? everyRecap
      : null;
  const priorWin = comparePrior ? computePriorDateWindow(startDate, endDate) : null;
  return (
    <div className="min-w-0">
      <dt
        className="text-[13px] font-medium"
        style={{ color: "var(--spark-text-secondary)" }}
      >
        Consumers sampled
      </dt>
      <dd
        className="display tab-num m-0 mt-1 text-3xl font-semibold truncate"
        style={{ color: "var(--spark-text)", letterSpacing: "-0.035em" }}
      >
        {breakdown.total.toLocaleString()}
      </dd>
      {priorWin ? (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <PriorConsumersDelta
              tenantId={tenantId}
              currentTotal={breakdown.total}
              priorStartDate={priorWin.startDate}
              priorEndDate={priorWin.endDate}
              priorShortLabel={priorWin.shortLabel}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}
      <dd className="m-0 mt-1 text-xs" style={{ color: "var(--spark-text-meta)" }}>
        on {breakdown.recaps.toLocaleString()} approved{" "}
        {breakdown.recaps === 1 ? "recap" : "recaps"}
        {waiting !== null ? (
          <span className="block">
            {waiting.toLocaleString()} counting every recap filed, approved or not
          </span>
        ) : null}
      </dd>
    </div>
  );
};

const ConsumersUnavailable: React.FC = () => (
  <SummaryItem label="Consumers sampled" figure="—" note="This figure could not load." />
);

const PeriodConversionAndSales: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  comparePrior: boolean;
}> = ({ tenantId, startDate, endDate, comparePrior }) => {
  const data = useLazyLoadQuery<TenantConversionKpisQueryType>(
    TenantConversionKpisQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-and-network" },
  );
  const kpis = data.tenantConversionKpis;
  const sold = kpis?.sold ?? 0;
  const sampled = kpis?.engagements ?? 0;
  const pct = kpis?.pct;
  const figure = conversionFigure(sold, sampled, pct);
  const priorLabel = kpis?.previousLabel?.trim() || "prior window";
  const soldDelta = comparePrior
    ? formatPercentDelta(sold, kpis?.previousSold, priorLabel)
    : null;
  const convDelta = comparePrior
    ? formatPointDelta(pct, kpis?.previousPct, priorLabel)
    : null;
  const counts =
    sold > 0 || sampled > 0
      ? `${sold.toLocaleString()} sold ÷ ${sampled.toLocaleString()} sampled · `
      : "";
  return (
    <>
      <SummaryItem
        label="Units sold"
        figure={sold > 0 ? sold.toLocaleString() : "—"}
        delta={soldDelta}
        note="retail and on-premise recaps"
      />
      <SummaryItem
        label="Conversion"
        figure={figure}
        delta={convDelta}
        note={`${counts}retail and on-premise only`}
      />
    </>
  );
};

const REPORT_SECTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "program-brief", label: "Brief" },
  { id: "report-kpis", label: "Headline KPIs" },
  { id: "report-velocity", label: "Velocity & stores" },
  { id: "report-efficiency", label: "Hourly ROI" },
  { id: "report-markets", label: "Markets" },
  { id: "report-themes", label: "Shopper voice" },
  { id: "report-photos", label: "Photos & shelf" },
];

export default function SparkReports() {
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const { isAdmin: isStaffView } = useSparkRole();
  const environment = useRelayEnvironment();
  const stickyKey = `@spark.view.reports/${tenantId || "all"}`;
  const [rangeKey, setRangeKey] = useStickyState<RangeKey>(
    `${stickyKey}/range`,
    "90",
    (raw) =>
      raw === "30" || raw === "90" || raw === "180" || raw === "ytd" || raw === "custom"
        ? raw
        : null,
  );
  const isYmd = (raw: unknown) =>
    typeof raw === "string" && (raw === "" || /^\d{4}-\d{2}-\d{2}$/.test(raw)) ? raw : null;
  const [customFrom, setCustomFrom] = useStickyState<string>(`${stickyKey}/from`, "", isYmd);
  const [customTo, setCustomTo] = useStickyState<string>(`${stickyKey}/to`, "", isYmd);
  const [comparePrior, setComparePrior] = useStickyState<boolean>(
    `${stickyKey}/comparePrior`,
    false,
    (raw) => (typeof raw === "boolean" ? raw : null),
  );
  const [chartMetric, setChartMetric] = useState<ReportChartMetric>("sampled");
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<"csv" | "brief" | null>(null);

  const range = useMemo(
    () => buildReportsRange(rangeKey, customFrom, customTo),
    [rangeKey, customFrom, customTo],
  );
  const customIncomplete =
    rangeKey === "custom" && range.label.startsWith("Last ");
  const startYmd = ymdLocal(range.start);
  const endYmd = ymdLocal(range.end);
  const filters: DashboardFilters = useMemo(
    () => ({
      distributorIds: [],
      rmmAsignedId: null,
      quarter: null,
      startDate: startYmd,
      endDate: endYmd,
    }),
    [startYmd, endYmd],
  );
  const { dashboard } = useEventDashboardData(tenantId || "", filters, 0);
  const showAlert = useAlertStore((st) => st.showAlert);
  const [commitEmail, emailing] = useMutation<SendTestClientReportMutationType>(
    SendTestClientReportMutation,
  );
  const emailLastMonth = () => {
    if (emailing || !tenantId) return;
    commitEmail({
      variables: { input: { tenantId } },
      onCompleted: (res) => {
        const r = res.sendTestClientReport;
        showAlert(
          r?.success
            ? "Sent. Check your inbox for last month's report."
            : r?.message || "Couldn't send the report. Please try again.",
          r?.success ? "success" : "error",
        );
      },
      onError: () =>
        showAlert("Couldn't send the report. Please try again.", "error"),
    });
  };
  const m = dashboard.metrics;
  const intent = ofAsked(m.purchaseIntent, m.purchaseIntentBase);
  const awareness = ofAsked(m.brandAwareness, m.brandAwarenessBase);
  const brandTitle =
    askAiSubjectFromTenant({
      name: null,
      requestUrlName: tenantMeta?.requestUrlName ?? tenantSlug,
    }) || "Program";

  const collectExportPayload = async () => {
    if (!tenantId) return null;
    const [bd, conv, sku, eff] = await Promise.all([
      fetchQuery<ConsumerBreakdownQueryType>(
        environment,
        ConsumerBreakdownQuery,
        { tenantId, startDate: startYmd, endDate: endYmd },
        { fetchPolicy: "store-or-network" },
      )
        .toPromise()
        .catch(() => null),
      fetchQuery<TenantConversionKpisQueryType>(
        environment,
        TenantConversionKpisQuery,
        { tenantId, startDate: startYmd, endDate: endYmd },
        { fetchPolicy: "store-or-network" },
      )
        .toPromise()
        .catch(() => null),
      fetchQuery<TenantSkuPulseQueryType>(
        environment,
        TenantSkuPulseQuery,
        { tenantId, startDate: startYmd, endDate: endYmd },
        { fetchPolicy: "store-or-network" },
      )
        .toPromise()
        .catch(() => null),
      fetchQuery<FieldEfficiencySectionQueryType>(
        environment,
        FieldEfficiencySectionQueryNode,
        { tenantId, startDate: startYmd, endDate: endYmd },
        { fetchPolicy: "store-or-network" },
      )
        .toPromise()
        .catch(() => null),
    ]);
    const breakdown = bd?.tenantConsumerBreakdown;
    const convKpis = conv?.tenantConversionKpis;
    const effData = eff?.tenantFieldEfficiency;
    return {
      brandName: brandTitle,
      rangeLabel: range.label,
      startDate: startYmd,
      endDate: endYmd,
      consumersSampled: breakdown?.total ?? m.consumersSampled ?? 0,
      approvedRecaps: breakdown?.recaps ?? 0,
      unitsSold: convKpis?.sold ?? 0,
      conversionPct: convKpis?.pct ?? null,
      eventsRun: m.totalEvents ?? 0,
      samplesPerHour: effData?.total?.samplesPerHour ?? null,
      unitsPerHour: effData?.total?.unitsPerHour ?? null,
      byWeek: breakdown?.byWeek ?? [],
      byStore: breakdown?.byStore ?? [],
      byState: breakdown?.byState ?? [],
      skus: sku?.tenantSkuPulse?.items ?? [],
      topEfficiencyStores: effData?.topStores ?? [],
    };
  };

  const handleExportCsv = async () => {
    if (!tenantId || exportBusy) return;
    setExportBusy("csv");
    try {
      const payload = await collectExportPayload();
      if (!payload) return;
      const csv = buildProgramReportCsv(payload);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spark-program-report-${startYmd}-to-${endYmd}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAlert("Exported program report CSV.", "success");
    } catch {
      showAlert("Couldn't export CSV right now.", "error");
    } finally {
      setExportBusy(null);
    }
  };

  const handleCopyBrief = async () => {
    if (!tenantId || exportBusy) return;
    setExportBusy("brief");
    try {
      const payload = await collectExportPayload();
      if (!payload) return;
      const text = buildProgramExecutiveBrief(payload);
      await navigator.clipboard.writeText(text);
      showAlert("Copied executive brief to clipboard.", "success");
    } catch {
      showAlert("Couldn't copy brief to clipboard.", "error");
    } finally {
      setExportBusy(null);
    }
  };

  return (
    <Layout>
      <ReportsRangeContext.Provider value={range}>
        <div className="space-y-6 max-w-7xl spark-fade-in spark-scale">
          {/* Print-only executive masthead */}
          <header
            className="hidden print:flex items-center justify-between pb-4 mb-6"
            style={{ borderBottom: "1px solid #d1d5db" }}
          >
            <div>
              <p className="text-xs font-medium" style={{ color: "#6b7280" }}>
                Program performance report · {range.label} ({startYmd} → {endYmd})
              </p>
              <h1 className="display text-2xl font-semibold mt-0.5">
                {brandTitle}
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                Compiled from approved recaps on Spark by Ignite Productions
              </p>
            </div>
            <SparkMark height={22} />
          </header>

          <div data-present-hide="true" className="print:hidden">
            <SparkHubTabs tabs={REPORTS_HUB_TABS} ariaLabel="Analytics views" />
          </div>

          <div className="print:hidden">
            <SparkPageHeader
              eyebrow={`Reports · ${range.label}`}
              title="Program report"
              infoTip="Approved recap metrics, photos, and consumer feedback for the selected window. Consumers counted are sampled — not reach or total samples handed out."
              action={
                <>
                  <PresentModeControl />
                  {isStaffView ? (
                    <SparkGhostLink
                      to={`/reports/client-recap?start=${ymdLocal(range.start)}&end=${ymdLocal(range.end)}`}
                    >
                      Build deck
                    </SparkGhostLink>
                  ) : null}
                  <SparkGhostButton
                    onClick={() => void handleCopyBrief()}
                    disabled={Boolean(exportBusy) || !tenantId}
                    title="Copy a formatted executive summary for the selected date range"
                  >
                    {exportBusy === "brief" ? "Copying…" : "Copy brief"}
                  </SparkGhostButton>
                  <SparkGhostButton
                    onClick={() => void handleExportCsv()}
                    disabled={Boolean(exportBusy) || !tenantId}
                    title="Download CSV of KPIs, weekly velocity, top stores, states, and SKUs for this date range"
                  >
                    {exportBusy === "csv" ? "Exporting…" : "Export CSV"}
                  </SparkGhostButton>
                  <SparkGhostButton
                    onClick={() => window.print()}
                    title="Save the current view as a print-ready PDF"
                  >
                    Export PDF
                  </SparkGhostButton>
                  <SparkGhostButton
                    onClick={() => setShareSheetOpen(true)}
                    disabled={!tenantId}
                    title="Share a live public link or manage monthly report emails"
                  >
                    Share &amp; schedule
                  </SparkGhostButton>
                </>
              }
            />
          </div>

          {/* Sticky Date Range + Compare Prior + Section Quick-Jump Bar */}
          <div className="sticky top-0 z-20 spark-insights-range space-y-2.5 print:hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="pill-group max-w-full overflow-x-auto spark-scroll-fade">
                  {(
                    [
                      ["30", "30 days"],
                      ["90", "90 days"],
                      ["180", "6 months"],
                      ["ytd", "Year to date"],
                      ["custom", "Custom"],
                    ] as [RangeKey, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRangeKey(key)}
                      aria-pressed={rangeKey === key}
                      className={`pill-btn whitespace-nowrap shrink-0 ${rangeKey === key ? "on" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {rangeKey === "custom" && (
                  <span className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      aria-label="Range start"
                      className="rounded-lg px-2 py-1 text-xs"
                      style={{
                        background: "transparent",
                        color: "var(--spark-text)",
                        border: "1px solid var(--spark-border)",
                        colorScheme: inputColorScheme(),
                      }}
                    />
                    <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                      to
                    </span>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => setCustomTo(e.target.value)}
                      aria-label="Range end"
                      className="rounded-lg px-2 py-1 text-xs"
                      style={{
                        background: "transparent",
                        color: "var(--spark-text)",
                        border: "1px solid var(--spark-border)",
                        colorScheme: inputColorScheme(),
                      }}
                    />
                    {customIncomplete && (
                      <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                        Pick both dates — showing 90 days until then.
                      </span>
                    )}
                  </span>
                )}
              </div>

              <button
                type="button"
                aria-pressed={comparePrior}
                onClick={() => setComparePrior(!comparePrior)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
                style={{
                  background: comparePrior
                    ? "var(--spark-lime)"
                    : "rgba(var(--spark-ink-rgb),0.035)",
                  color: comparePrior
                    ? "var(--spark-on-accent)"
                    : "var(--spark-text-secondary)",
                  border: comparePrior
                    ? "1px solid var(--spark-lime)"
                    : "1px solid var(--spark-border)",
                }}
              >
                <span>{comparePrior ? "● Comparing prior window" : "Compare prior window"}</span>
              </button>
            </div>

            <nav
              aria-label="Report sections"
              className="flex items-center gap-4 overflow-x-auto spark-scroll-fade text-xs"
            >
              {REPORT_SECTIONS.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="whitespace-nowrap font-medium transition hover:underline underline-offset-4"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {sec.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Shared Recap Decks (renders nothing when none are published) */}
          <div className="print:hidden">
            <RecapDecksCard
              tenantId={tenantId ? String(tenantId) : null}
              staffView={isStaffView}
            />
          </div>

          {tenantId ? (
            <ErrorBoundary
              key={`brief|${tenantId}|${startYmd}|${endYmd}`}
              fallback={
                <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
                  The brief could not load.
                </p>
              }
            >
              <Suspense fallback={null}>
                <ProgramBriefCard
                  tenantId={tenantId}
                  startDate={startYmd}
                  endDate={endYmd}
                  preset={customIncomplete ? "90" : rangeKey}
                  staff={isStaffView}
                  canWrite={!customIncomplete}
                />
              </Suspense>
            </ErrorBoundary>
          ) : null}

          {tenantId ? (
            <ErrorBoundary
              key={`exec-snapshot|${tenantId}`}
              fallback={null}
            >
              <Suspense fallback={null}>
                <ExecutiveSnapshotCard tenantId={tenantId} />
              </Suspense>
            </ErrorBoundary>
          ) : null}

          {tenantId ? (
            <ReportEvidenceStrip tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
          ) : null}

          {tenantId ? (
            <MonthHighlight
              tenantId={tenantId}
              month={monthOfDate(endYmd)}
              className="spark-card p-5 sm:p-6 spark-print-keep"
            />
          ) : null}

          {/* Headline numbers, under the brief, before any chart. */}
          <section
            id="report-kpis"
            className="spark-card p-5 sm:p-6 spark-print-keep"
            aria-label={`Summary, ${range.label}`}
          >
            <dl className="m-0 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-6 gap-y-5">
              {tenantId ? (
                <ErrorBoundary
                  key={`${tenantId}|${startYmd}|${endYmd}`}
                  fallback={<ConsumersUnavailable />}
                >
                  <Suspense fallback={<StudioKpiSkeleton variant="inline" label="Consumers sampled" />}>
                    <ConsumersSummary
                      tenantId={tenantId}
                      startDate={startYmd}
                      endDate={endYmd}
                      everyRecap={m.consumersSampled}
                      comparePrior={comparePrior}
                    />
                  </Suspense>
                </ErrorBoundary>
              ) : (
                <SummaryItem label="Consumers sampled" figure={fmtNum(m.consumersSampled)} />
              )}
              {tenantId ? (
                <ErrorBoundary
                  key={`conv|${tenantId}|${startYmd}|${endYmd}`}
                  fallback={
                    <>
                      <SummaryItem label="Units sold" figure="—" note="retail and on-premise recaps" />
                      <SummaryItem label="Conversion" figure="—" note="retail and on-premise only" />
                    </>
                  }
                >
                  <Suspense
                    fallback={
                      <>
                        <StudioKpiSkeleton variant="inline" label="Units sold" />
                        <StudioKpiSkeleton variant="inline" label="Conversion" />
                      </>
                    }
                  >
                    <PeriodConversionAndSales
                      tenantId={tenantId}
                      startDate={startYmd}
                      endDate={endYmd}
                      comparePrior={comparePrior}
                    />
                  </Suspense>
                </ErrorBoundary>
              ) : (
                <>
                  <SummaryItem label="Units sold" figure="—" note="retail and on-premise recaps" />
                  <SummaryItem label="Conversion" figure="—" note="retail and on-premise only" />
                </>
              )}
              <SummaryItem
                label="Events run"
                figure={fmtNum(m.totalEvents)}
                note="events with a recap filed"
              />
              <SummaryItem
                label="Purchase intent"
                figure={intent ? intent.rate : "—"}
                note={intent ? (intent.asked ?? undefined) : "not asked on these recaps"}
              />
              <SummaryItem
                label="Brand awareness"
                figure={awareness ? awareness.rate : "—"}
                note={awareness ? (awareness.asked ?? undefined) : "not asked on these recaps"}
              />
            </dl>
            {tenantId ? (
              <ErrorBoundary fallback={null}>
                <Suspense fallback={null}>
                  <SampledQuestionNote
                    tenantId={tenantId}
                    startDate={startYmd}
                    endDate={endYmd}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : null}
          </section>

          <Suspense fallback={null}>
            <RequestChartsRow />
          </Suspense>

          {/* Velocity, Stores, States & SKUs with unified Metric Switcher */}
          {tenantId ? (
            <section
              id="report-velocity"
              className="spark-card p-5 sm:p-6 space-y-6 spark-print-keep"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap pb-3" style={{ borderBottom: "1px solid var(--spark-hairline, var(--spark-border))" }}>
                <div>
                  <h3 className="display font-semibold text-base" style={{ letterSpacing: "-0.02em" }}>
                    Sampling velocity &amp; account breakdown
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--spark-text-meta)" }}>
                    Click any store or state bar to inspect its account profile or market map.
                  </p>
                </div>
                <div
                  className="pill-group print:hidden"
                  role="group"
                  aria-label="Chart metric"
                >
                  {(
                    [
                      ["sampled", "Total sampled"],
                      ["avg", "Avg / activation"],
                      ["activations", "Activations"],
                    ] as [ReportChartMetric, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setChartMetric(key)}
                      aria-pressed={chartMetric === key}
                      className={`pill-btn whitespace-nowrap ${chartMetric === key ? "on" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <ConsumersPerWeek
                tenantId={tenantId}
                startDate={startYmd}
                endDate={endYmd}
                metric={chartMetric}
                comparePrior={comparePrior}
              />
              <ConsumerSplits
                tenantId={tenantId}
                startDate={startYmd}
                endDate={endYmd}
                metric={chartMetric}
              />
              <ConsumersAddUpNote
                tenantId={tenantId}
                startDate={startYmd}
                endDate={endYmd}
                metric={chartMetric}
              />
            </section>
          ) : null}

          {tenantId ? (
            <RecapFieldTotalsSection
              tenantId={tenantId}
              startDate={startYmd}
              endDate={endYmd}
            />
          ) : null}

          {tenantId ? (
            <div id="report-efficiency" className="spark-print-keep">
              <FieldEfficiencySection
                tenantId={tenantId}
                startDate={startYmd}
                endDate={endYmd}
              />
            </div>
          ) : null}

          {tenantId ? (
            <div id="report-markets" className="spark-print-keep">
              <h3 className="display font-bold mb-3" style={{ letterSpacing: "-0.02em" }}>
                Where we activated
              </h3>
              <Suspense fallback={<PanelSkeleton label="Loading the map" />}>
                <TenantGeoHeatmap
                  tenantId={tenantId}
                  startDate={startYmd}
                  endDate={endYmd}
                  rangeLabel={range.label}
                />
              </Suspense>
            </div>
          ) : null}

          {tenantId ? (
            <section className="spark-card p-5 sm:p-6 spark-print-keep" id="report-themes">
              <FeedbackThemes tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
            </section>
          ) : null}
          <Suspense fallback={<PanelSkeleton label="Loading photos" />}>
            <FieldPhotos />
          </Suspense>
          {tenantId ? (
            <section className="spark-card p-5 sm:p-6 spark-print-keep" id="report-competitors">
              <CompetitorMentions tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
            </section>
          ) : null}
          {tenantId ? (
            <section className="spark-card p-5 sm:p-6 spark-print-keep">
              <ProductRegions tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
            </section>
          ) : null}
          {tenantId ? (
            <div id="report-shelf" className="spark-print-keep">
              <OnShelfSummary tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
            </div>
          ) : null}
        </div>

        {/* Docked Share & Schedule studio drawer */}
        <SparkSheet
          open={shareSheetOpen}
          onOpenChange={setShareSheetOpen}
          side="right"
          eyebrow={`Reports · ${brandTitle}`}
          title="Share & monthly schedule"
        >
          <div className="space-y-5">
            <ProgramShareControl tenantId={tenantId || null} />

            <div className="spark-card p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-sm">Monthly PDF email</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--spark-text-meta)" }}>
                  Delivered automatically on the 1st of each month, or send last month&apos;s report to yourself right now.
                </p>
              </div>
              <ReportSubscriptionToggle tenantId={tenantId || null} />
              <div className="pt-1">
                <SparkGhostButton
                  onClick={emailLastMonth}
                  disabled={emailing || !tenantId}
                >
                  {emailing ? "Sending…" : "Email me last month's PDF"}
                </SparkGhostButton>
              </div>
            </div>
          </div>
        </SparkSheet>
      </ReportsRangeContext.Provider>
    </Layout>
  );
}
