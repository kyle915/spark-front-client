import TenantGeoHeatmap from "@/components/ai/TenantGeoHeatmap";
import useStickyState from "@/hooks/useStickyState";
import { pickFieldPhoto } from "@/utils/fieldPhoto";
import ReportSubscriptionToggle from "./ReportSubscriptionToggle";
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
import MonthHighlight from "@/components/explain/MonthHighlight";
import ProgramBriefCard from "./ProgramBriefCard";
import ReportEvidenceStrip from "./ReportEvidenceStrip";
import { monthOfDate } from "@/lib/storeProfile";
import SparkGhostButton, { SparkGhostLink } from "@/shared/SparkGhostButton";
import { useEventDashboardData } from "@/hooks/useEventDashboardData";
import { useAuthStore } from "@/store/authStore";
import type { DashboardFilters } from "@/components/filters/FiltersPanel";
import { Suspense, createContext, useContext, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { SendTestClientReportMutation } from "@/api/mutations/SendTestClientReportMutation";
import type { SendTestClientReportMutation as SendTestClientReportMutationType } from "@api/mutations/__generated__/SendTestClientReportMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { TenantRequestsRollupQuery } from "@/api/queries/TenantRequestsRollupQuery";
import type { TenantRequestsRollupQuery as TenantRequestsRollupQueryType } from "@api/queries/__generated__/TenantRequestsRollupQuery.graphql";
import "@/lib/sparkChartRegister";
import { Bar } from "react-chartjs-2";
import { labelsEveryRow, mergeSameLabel, rankRows, sharePercent } from "@/lib/chartRows";
import { barSeries, chartOptions, foldToOther, valueLabels } from "@/lib/sparkChart";
import { useAppearance } from "@/theme/appearance";
import { inputColorScheme } from "@/theme/inputColorScheme";
import ErrorBoundary from "@/components/ErrorBoundary";
import RecapDecksCard from "@/components/pages/client-recap/RecapDecksCard";
import useSparkRole from "@/hooks/useSparkRole";
import {
  ConsumerSplits,
  ConsumersAddUpNote,
  ConsumersPerWeek,
} from "@/components/charts/ConsumerCharts";
import { useConsumerBreakdown } from "@/hooks/useConsumerBreakdown";
import { ofAsked } from "@/lib/consumerBreakdown";
import { TenantConversionKpisQuery } from "@/api/queries/TenantConversionKpisQuery";
import type { TenantConversionKpisQuery as TenantConversionKpisQueryType } from "@api/queries/__generated__/TenantConversionKpisQuery.graphql";

const everyValue = valueLabels("all");

/** One quiet sentence where a chart has nothing to draw. */
const ChartEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="spark-chart-empty h-full">{children}</div>
);

/** A ranked list of thin ink bars, largest first, value at each bar's tip. */
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
  // Monday-start week label "MMM D" (week start). Cheap to compute,
  // easy to read on a 12-bar chart.
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ---------------------------------------------------------------------------
// Date range — one window for the KPI strip and every chart on the page.
// ---------------------------------------------------------------------------
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

/** Contiguous Monday-start week buckets covering the range (4–53 weeks). */
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

/**
 * Server-aggregated request counts by createdAt day and requestType for the
 * active report date range — one query, never truncated at 2,000 rows.
 */
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
  // One type is a number, not a one-bar chart.
  if (mix.length === 1) {
    return (
      <div className="flex h-full flex-col justify-center gap-1">
        <p className="tab-num text-3xl font-bold" style={{ color: "var(--spark-text)" }}>
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

/**
 * Spark v2 — Reports.
 * Wireframe: spark-demo/index.html lines 2418-2484.
 *
 * The summary comes first, then the charts. One date range (presets or
 * custom) drives both.
 *
 * Consumers sampled has ONE source on this page: `tenantConsumerBreakdown`.
 * The headline figure and the weekly, store and state charts all read that
 * one rollup, so they add up to each other by construction. (They used to
 * come from two places: the headline from `eventDashboard`, the charts from
 * a page of recap rows that the server cuts at 50, so the charts fell short
 * of the headline for any client with more recaps than that.)
 */

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";


/**
 * "From the field" — photos from approved recaps in the range, with a
 * lightbox. Best photos are one frame per store and date. Further frames
 * from that stop are on All photos. Renders nothing when there are no
 * photos at all.
 */
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
        // Recaps whose only images are receipts / product spend are skipped.
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
  // No picks in this range yet: show what the section always showed.
  const hasBest = picked.best.length > 0;
  const shown = hasBest && view === "best" ? picked.best : allPhotos;
  return (
    <div className="spark-card p-5" id="report-photos">
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
  <div className="spark-card p-5">
    <h3 className="spark-title font-semibold mb-2">
      {title}
    </h3>
    <p
      className="text-xs mb-3"
      style={{ color: "var(--spark-text-meta)" }}
    >
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

/** The two request charts, shown only when the range has requests. */
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

const SummaryItem: React.FC<{
  label: string;
  figure: React.ReactNode;
  note?: React.ReactNode;
}> = ({ label, figure, note }) => (
  <div className="min-w-0">
    <dt className="text-[13px] font-medium" style={{ color: "var(--spark-text-secondary)" }}>
      {label}
    </dt>
    <dd
      className="tab-num m-0 mt-1 text-3xl font-bold truncate"
      style={{ color: "var(--spark-text)", letterSpacing: "-0.03em" }}
    >
      {figure}
    </dd>
    {note ? (
      <dd className="m-0 mt-1 text-xs" style={{ color: "var(--spark-text-meta)" }}>
        {note}
      </dd>
    ) : null}
  </div>
);

/**
 * Consumers sampled, from the same rollup the charts below draw, so the
 * headline and the charts cannot disagree.
 */
const ConsumersSummary: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  /** The dashboard's figure, which also counts recaps not yet approved. */
  everyRecap: number | null | undefined;
}> = ({ tenantId, startDate, endDate, everyRecap }) => {
  const breakdown = useConsumerBreakdown(tenantId, startDate, endDate);
  const { isAdmin } = useSparkRole();
  if (!breakdown) return <ConsumersUnavailable />;
  const waiting =
    isAdmin && typeof everyRecap === "number" && everyRecap > breakdown.total
      ? everyRecap
      : null;
  return (
    <SummaryItem
      label="Consumers sampled"
      figure={breakdown.total.toLocaleString()}
      note={
        <>
          on {breakdown.recaps.toLocaleString()} approved{" "}
          {breakdown.recaps === 1 ? "recap" : "recaps"}
          {waiting !== null ? (
            <span className="block">
              {waiting.toLocaleString()} counting every recap filed, approved or not
            </span>
          ) : null}
        </>
      }
    />
  );
};

/** No figure is better than one the charts below would not add up to. */
const ConsumersUnavailable: React.FC = () => (
  <SummaryItem label="Consumers sampled" figure="—" note="This figure could not load." />
);

/** Sold ÷ sampled for retail and on-premise only. Spark computes the rate. */
const PeriodConversion: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
}> = ({ tenantId, startDate, endDate }) => {
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
  const counts =
    sold > 0 || sampled > 0
      ? `${sold.toLocaleString()} sold ÷ ${sampled.toLocaleString()} sampled · `
      : "";
  return (
    <SummaryItem
      label="Conversion"
      figure={figure}
      note={`${counts}retail and on-premise only`}
    />
  );
};

export default function SparkReports() {
  const { tenantId } = useAuthStore();
  const { isAdmin: isStaffView } = useSparkRole();
  // The chosen range sticks per client in this browser, so a view someone
  // set up is still there next time.
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
  // Sends ONLY to the signed-in person (server-enforced) — a self-serve copy
  // of the monthly report without waiting for the scheduled email.
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

  return (
    <Layout>
      <ReportsRangeContext.Provider value={range}>
      <div className="space-y-6 max-w-7xl spark-fade-in">
        <SparkPageHeader
          eyebrow={`REPORTS · ${range.label.toUpperCase()}`}
          title="Program report."
          support="Numbers, photos and consumer feedback for the dates you pick. Consumers counted are sampled — not reach or samples handed out."
          action={
            <>
            {/* Staff only: a first draft of a client recap for any dates. */}
            {isStaffView ? (
              <SparkGhostLink
                to={`/reports/client-recap?start=${ymdLocal(range.start)}&end=${ymdLocal(range.end)}`}
              >
                Build a recap deck
              </SparkGhostLink>
            ) : null}
            <SparkGhostButton
              onClick={emailLastMonth}
              disabled={emailing || !tenantId}
              title="Email the monthly performance PDF for last month to your own address only"
            >
              {emailing ? "Sending…" : "Email me last month's PDF"}
            </SparkGhostButton>
            <SparkGhostButton
              onClick={() => window.print()}
              title="Save the current view as PDF via the browser print dialog"
            >
              Export PDF
            </SparkGhostButton>
            </>
          }
        />

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {/* Same segmented control as the Dashboard range picker. */}
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
                className="rounded-lg px-2 py-1"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  colorScheme: inputColorScheme(),
                }}
              />
              <span style={{ color: "var(--spark-text-meta)" }}>to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="Range end"
                className="rounded-lg px-2 py-1"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  colorScheme: inputColorScheme(),
                }}
              />
              {customIncomplete && (
                <span style={{ color: "var(--spark-text-meta)" }}>
                  Pick both dates — showing the last 90 days until then.
                </span>
              )}
            </span>
          )}
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
                preset={rangeKey}
                staff={isStaffView}
              />
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
            className="spark-card p-5 sm:p-6"
          />
        ) : null}

        {/* Headline numbers, under the brief, before any chart. */}
        <section className="spark-card p-5 sm:p-6" aria-label={`Summary, ${range.label}`}>
          <dl className="m-0 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-6 gap-y-5">
            {tenantId ? (
              <ErrorBoundary
                key={`${tenantId}|${startYmd}|${endYmd}`}
                fallback={<ConsumersUnavailable />}
              >
                <Suspense fallback={<SummaryItem label="Consumers sampled" figure="…" />}>
                  <ConsumersSummary
                    tenantId={tenantId}
                    startDate={startYmd}
                    endDate={endYmd}
                    everyRecap={m.consumersSampled}
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
                  <SummaryItem label="Conversion" figure="—" note="retail and on-premise only" />
                }
              >
                <Suspense
                  fallback={
                    <SummaryItem label="Conversion" figure="…" note="retail and on-premise only" />
                  }
                >
                  <PeriodConversion tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <SummaryItem label="Conversion" figure="—" note="retail and on-premise only" />
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

        <div className="print:hidden">
          <ReportSubscriptionToggle tenantId={tenantId || null} />
        </div>

        <div className="print:hidden">
          <ProgramShareControl tenantId={tenantId || null} />
        </div>

        {/* Recap decks Ignite has shared with this brand. Nothing renders
            until staff mark one ready. */}
        <div className="print:hidden">
          <RecapDecksCard
            tenantId={tenantId ? String(tenantId) : null}
            staffView={isStaffView}
          />
        </div>

        {/* Request charts — hidden when nothing was requested in the range,
            so two empty boxes don't lead the report. */}
        <Suspense fallback={null}>
          <RequestChartsRow />
        </Suspense>

        {/* Consumers sampled by week, store and state: one rollup, the same
            one the summary reads, so every chart adds up to the headline. */}
        {tenantId ? (
          <section className="spark-card p-5 sm:p-6 space-y-6">
            <ConsumersPerWeek tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
            <ConsumerSplits tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
            <ConsumersAddUpNote tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
          </section>
        ) : null}

        {/* Everything the recaps collected, beyond the headline KPIs. */}
        {tenantId ? (
          <RecapFieldTotalsSection
            tenantId={tenantId}
            startDate={startYmd}
            endDate={endYmd}
          />
        ) : null}

        {/* Which stores, days and times produce the most per staffed hour. */}
        {tenantId ? (
          <FieldEfficiencySection
            tenantId={tenantId}
            startDate={startYmd}
            endDate={endYmd}
          />
        ) : null}

        {/* Where the program ran: states shaded by activity for the range. */}
        {tenantId ? (
          <div>
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

        {/* Voice before the photo grid: one sentence per theme, then one frame per stop. */}
        {tenantId ? (
          <section className="spark-card p-5 sm:p-6" id="report-themes">
            <FeedbackThemes tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
          </section>
        ) : null}
        <Suspense fallback={<PanelSkeleton label="Loading photos" />}>
          <FieldPhotos />
        </Suspense>
        {tenantId ? (
          <section className="spark-card p-5 sm:p-6" id="report-competitors">
            <CompetitorMentions tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
          </section>
        ) : null}
        {tenantId ? (
          <section className="spark-card p-5 sm:p-6">
            <ProductRegions tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
          </section>
        ) : null}
        {/* Renders its own card, and nothing when there are no shelf photos. */}
        {tenantId ? (
          <div id="report-shelf">
            <OnShelfSummary tenantId={tenantId} startDate={startYmd} endDate={endYmd} />
          </div>
        ) : null}
      </div>
      </ReportsRangeContext.Provider>
    </Layout>
  );
}
