import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { AlertTriangle } from "lucide-react";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { REPORTS_HUB_TABS } from "@/shared/sparkHubNav";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { EventTypeQuery } from "@/api/queries/EventTypeQuery";
import type { EventTypeQuery as EventTypeQueryType } from "@api/queries/__generated__/EventTypeQuery.graphql";
import { TenantMetroBreakdownQuery } from "@/api/queries/TenantMetroBreakdownQuery";
import type { TenantMetroBreakdownQuery as TenantMetroBreakdownQueryType } from "@api/queries/__generated__/TenantMetroBreakdownQuery.graphql";
import { TenantFieldSamplingReportQuery } from "@/api/queries/TenantFieldSamplingReportQuery";
import type { TenantFieldSamplingReportQuery as TenantFieldSamplingReportQueryType } from "@api/queries/__generated__/TenantFieldSamplingReportQuery.graphql";
import { GenerateFieldSamplingCalloutSummaryMutation } from "@/api/mutations/GenerateFieldSamplingCalloutSummaryMutation";
import type { GenerateFieldSamplingCalloutSummaryMutation as GenerateFieldSamplingCalloutSummaryMutationType } from "@api/mutations/__generated__/GenerateFieldSamplingCalloutSummaryMutation.graphql";
import { inputColorScheme } from "@/theme/inputColorScheme";
import ExpandableText from "@/shared/ExpandableText";
import { samplesBasisLabels } from "./samplesBasis";

/**
 * Field Sampling Report — a consolidated rollup for tenants running a
 * guerrilla field-sampling program across metro markets (Feel Free's
 * being the first). Kyle's ask, verbatim: "Samples per hour / Total
 * samples YTD (broken down in each SKU) / Total samples for that week
 * (broken down in each SKU) / Locations hit / What is coming up the next
 * week / Things to note or field call outs," with a market + date
 * selector, and Gemini "if it's worth it."
 *
 * Every number on this page is deterministic — see
 * `recaps/field_sampling_report.py` on the backend. The one AI touchpoint
 * (a Gemini narrative over the call-outs feed) is opt-in via the
 * "Summarize with AI" button, never generated automatically, matching
 * this codebase's precedent of keeping client-facing numbers off the AI
 * path (tenants/insights/service.py's docstring explains the same
 * decision for a different feature).
 */

const pad = (n: number) => String(n).padStart(2, "0");
const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const weeksAgoRange = (weeks: number): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (weeks * 7 - 1));
  return { start: toIsoDate(start), end: toIsoDate(end) };
};

// Plain "YYYY-MM-DD" -> "Jul 2", parsed as a local wall date (no UTC
// shift) — same construction as MetroBreakdownCard.tsx's shortDate.
const shortDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const fmtNum = (v: number) => v.toLocaleString();

const PRESETS: { key: string; label: string; weeks: number }[] = [
  { key: "1w", label: "This week", weeks: 1 },
  { key: "4w", label: "Last 4 weeks", weeks: 4 },
  { key: "8w", label: "Last 8 weeks", weeks: 8 },
];

// A function so the colour scheme is read at render, not at import.
const inputStyle = (): React.CSSProperties => ({
  padding: "6px 8px",
  borderRadius: 8,
  background: "rgba(var(--spark-ink-rgb),0.04)",
  border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
  color: "var(--spark-text)",
  colorScheme: inputColorScheme(),
});

const eyebrow: React.CSSProperties = {
  color: "var(--spark-text-meta)",
};

const dim: React.CSSProperties = { color: "var(--spark-text-meta)" };
const dimmer: React.CSSProperties = { color: "var(--spark-text-meta)" };

const modeLabel = (mode: string): string =>
  mode === "quantity" ? "Units" : mode === "sessions" ? "Sessions (approx.)" : "No data";

const SkuBreakdownCard: React.FC<{
  title: string;
  subtitle: string;
  mode: string;
  items: readonly { readonly product: string; readonly total: number }[];
}> = ({ title, subtitle, mode, items }) => {
  const total = items.reduce((sum, i) => sum + i.total, 0);
  return (
    <div className="spark-card p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span
          className={`chip ${
            mode === "quantity"
              ? "chip-lime"
              : mode === "sessions"
                ? "chip-orange"
                : "chip-muted"
          }`}
        >
          {modeLabel(mode)}
        </span>
      </div>
      <p className="text-xs mb-3" style={dimmer}>
        {subtitle}
      </p>
      {items.length === 0 ? (
        <p className="text-xs py-4 text-center" style={dim}>
          No SKU data in this window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <tbody>
              {(() => {
                const maxItem = Math.max(1, ...items.map((i) => i.total));
                return items.map((item) => {
                  const barPct = Math.min(100, Math.round((item.total / maxItem) * 100));
                  const sharePct = total > 0 ? Math.round((item.total / total) * 100) : 0;
                  return (
                    <tr
                      key={item.product}
                      style={{ borderBottom: "1px solid var(--spark-hairline, rgba(var(--spark-ink-rgb),0.06))" }}
                    >
                      <td className="py-2 pr-3" style={{ color: "var(--spark-text)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{item.product}</span>
                          <span className="tab-num text-xs shrink-0" style={dim}>
                            {sharePct}%
                          </span>
                        </div>
                        <div
                          className="mt-1 h-1.5 rounded-sm overflow-hidden"
                          style={{ background: "rgba(var(--spark-ink-rgb),0.06)" }}
                        >
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${barPct}%`,
                              background: "rgba(var(--spark-ink-rgb),0.45)",
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums font-semibold align-top">
                        {fmtNum(item.total)}
                      </td>
                    </tr>
                  );
                });
              })()}
              <tr>
                <td className="pt-2 font-semibold" style={dim}>
                  Total
                </td>
                <td
                  className="pt-2 text-right tabular-nums font-semibold"
                  style={{ color: "var(--spark-text)" }}
                >
                  {fmtNum(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ReportBody: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const { showAlert } = useAlertStore();
  const initial = weeksAgoRange(1);
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  // undefined = auto-detect "Field Sampling"; null = user picked "All
  // event types" — same three-state convention as MetroBreakdownCard.
  const [eventTypeOverride, setEventTypeOverride] = useState<
    string | null | undefined
  >(undefined);
  const [market, setMarket] = useState<string | null>(null);

  const eventTypesData = useLazyLoadQuery<EventTypeQueryType>(
    EventTypeQuery,
    { filters: { tenantId: tenantId ?? "" }, first: 50 },
    { fetchPolicy: "store-or-network" },
  );
  const eventTypes = useMemo(
    () =>
      (eventTypesData?.eventTypes?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [eventTypesData],
  );
  const defaultEventTypeId = useMemo(() => {
    const match = eventTypes.find(
      (t) => (t.name ?? "").trim().toLowerCase() === "field sampling",
    );
    return match ? String(match.id) : null;
  }, [eventTypes]);
  const effectiveEventTypeId =
    eventTypeOverride !== undefined ? eventTypeOverride : defaultEventTypeId;

  // A fixed, wide (~2-year) probe window purely to populate the market
  // dropdown's options — independent of the report's own date range, same
  // "fetch options once" posture as the event-type query above. The
  // FieldSamplingReport type has no standalone "known markets" field, so
  // this reuses tenantMetroBreakdown's `metros` list instead of adding a
  // redundant backend query.
  const marketProbeRange = useMemo(() => weeksAgoRange(104), []);
  const marketsData = useLazyLoadQuery<TenantMetroBreakdownQueryType>(
    TenantMetroBreakdownQuery,
    {
      tenantId,
      startDate: marketProbeRange.start,
      endDate: marketProbeRange.end,
      eventTypeId: effectiveEventTypeId,
    },
    { fetchPolicy: "store-or-network" },
  );
  const markets = marketsData?.tenantMetroBreakdown?.metros ?? [];

  const data = useLazyLoadQuery<TenantFieldSamplingReportQueryType>(
    TenantFieldSamplingReportQuery,
    { tenantId, startDate, endDate, eventTypeId: effectiveEventTypeId, market },
    { fetchPolicy: "network-only" },
  );
  const report = data.tenantFieldSamplingReport;

  const ytdTotal = report.ytdSkuBreakdown.items.reduce((s, i) => s + i.total, 0);
  const basisLabels = samplesBasisLabels(report.samplesPerHour.basis);

  const [commitSummary, summaryInFlight] =
    useMutation<GenerateFieldSamplingCalloutSummaryMutationType>(
      GenerateFieldSamplingCalloutSummaryMutation,
    );
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryWindowKey, setSummaryWindowKey] = useState<string | null>(null);
  const windowKey = `${startDate}|${endDate}|${effectiveEventTypeId ?? ""}|${market ?? ""}`;
  const summaryIsStale = aiSummary !== null && summaryWindowKey !== windowKey;

  const requestSummary = () => {
    commitSummary({
      variables: { tenantId, startDate, endDate, eventTypeId: effectiveEventTypeId, market },
      onCompleted: (res) => {
        const summary = res.generateFieldSamplingCalloutSummary?.summary ?? null;
        setAiSummary(summary);
        setSummaryWindowKey(windowKey);
        if (!summary) {
          showAlert(
            "No summary is available for this window yet. Try a wider date range, or try again in a minute.",
            "info",
          );
        }
      },
      onError: (err) => showAlert(`Couldn't generate summary: ${err.message}`, "error"),
    });
  };

  const applyPreset = (n: number) => {
    const r = weeksAgoRange(n);
    setStartDate(r.start);
    setEndDate(r.end);
  };

  return (
    <>
      {/* Controls */}
      <div className="spark-card p-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.weeks)}
            className="text-xs px-2.5 py-1 rounded-full transition spark-row-hover"
            style={{ border: "1px solid rgba(var(--spark-ink-rgb),0.14)", color: "var(--spark-text-secondary)" }}
          >
            {p.label}
          </button>
        ))}
        <span className="mono text-[10px] mx-1" style={dimmer}>
          OR
        </span>
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="text-xs"
          style={inputStyle()}
        />
        <span style={dimmer}>–</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="text-xs"
          style={inputStyle()}
        />
        <select
          value={market ?? ""}
          onChange={(e) => setMarket(e.target.value || null)}
          className="text-xs ml-auto"
          style={inputStyle()}
        >
          <option value="">All markets</option>
          {markets.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {eventTypes.length > 1 && (
          <select
            value={effectiveEventTypeId ?? ""}
            onChange={(e) => setEventTypeOverride(e.target.value || null)}
            className="text-xs"
            style={inputStyle()}
          >
            <option value="">All event types</option>
            {eventTypes.map((t) => (
              <option key={String(t.id)} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: basisLabels.perHour,
            value: report.samplesPerHour.perHour != null ? report.samplesPerHour.perHour.toFixed(2) : "—",
          },
          { label: basisLabels.total, value: fmtNum(report.samplesPerHour.samples) },
          { label: "Hours (window)", value: report.samplesPerHour.hours.toFixed(1) },
          { label: "Samples YTD", value: fmtNum(ytdTotal) },
        ].map((t) => (
          <div
            key={t.label}
            className="spark-card rounded-2xl px-4 py-3"
          >
            <p className="text-xs font-medium" style={eyebrow}>
              {t.label}
            </p>
            <p className="text-xl font-bold tabular-nums mt-1">{t.value}</p>
          </div>
        ))}
      </div>
      {basisLabels.note ? (
        <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
          {basisLabels.note}
        </p>
      ) : null}
      {report.samplesPerHour.estimated && (
        <p className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--spark-flag-ink)" }}>
          <AlertTriangle size={14} strokeWidth={1.75} className="shrink-0" />
          <span>
            At least one shift in this window has no real clock-in/out pair — scheduled duration was used for hours.
          </span>
        </p>
      )}

      {/* SKU breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkuBreakdownCard
          title="YTD SKU Breakdown"
          subtitle="Jan 1 – Today"
          mode={report.ytdSkuBreakdown.mode}
          items={report.ytdSkuBreakdown.items}
        />
        <SkuBreakdownCard
          title="This Window's SKU Breakdown"
          subtitle={`${shortDate(startDate)} – ${shortDate(endDate)}`}
          mode={report.weekSkuBreakdown.mode}
          items={report.weekSkuBreakdown.items}
        />
      </div>

      {/* Locations hit */}
      <div className="spark-card p-5">
        <h3 className="font-bold text-sm mb-1">Locations Hit</h3>
        <p className="text-xs mb-3" style={dimmer}>
          {report.locationsHit.length} stop{report.locationsHit.length === 1 ? "" : "s"} in window
        </p>
        {report.locationsHit.length === 0 ? (
          <p className="text-xs py-4 text-center" style={dim}>
            No stops recorded in this window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--spark-border, #1f2418)" }}>
                  <th className="text-left py-2 pr-3 font-normal mono" style={{ ...dim, letterSpacing: "0.06em" }}>
                    DATE
                  </th>
                  <th className="text-left py-2 pr-3 font-normal mono" style={{ ...dim, letterSpacing: "0.06em" }}>
                    MARKET
                  </th>
                  <th className="text-left py-2 pr-3 font-normal mono" style={{ ...dim, letterSpacing: "0.06em" }}>
                    CORRIDOR
                  </th>
                  <th className="text-left py-2 font-normal mono" style={{ ...dim, letterSpacing: "0.06em" }}>
                    ADDRESS
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.locationsHit.map((loc, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(var(--spark-ink-rgb),0.05)" }}>
                    <td className="py-1.5 pr-3" style={{ color: "var(--spark-text-secondary)" }}>
                      {shortDate(loc.date)}
                    </td>
                    <td className="py-1.5 pr-3 font-semibold">{loc.market ?? "—"}</td>
                    <td className="py-1.5 pr-3" style={{ color: "var(--spark-text)" }}>
                      {loc.corridor ?? "—"}
                    </td>
                    <td className="py-1.5" style={dim}>
                      {loc.address ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div className="spark-card p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="font-bold text-sm">Coming Up — Next 7 Days</h3>
          {report.upcoming.total > report.upcoming.items.length && (
            <span className="mono text-[10px]" style={dimmer}>
              +{report.upcoming.total - report.upcoming.items.length} MORE
            </span>
          )}
        </div>
        <p className="mono text-[10px] mb-3" style={dimmer}>
          {report.upcoming.total} SHIFT{report.upcoming.total === 1 ? "" : "S"} SCHEDULED
        </p>
        {report.upcoming.items.length === 0 ? (
          <p className="text-xs py-4 text-center" style={dim}>
            Nothing scheduled in the next 7 days.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.upcoming.items.map((shift, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                style={{ borderBottom: "1px solid rgba(var(--spark-ink-rgb),0.05)" }}
              >
                <div>
                  <span className="font-semibold text-xs">{shift.market ?? shift.name ?? "—"}</span>
                  {shift.corridor && (
                    <span className="text-xs ml-2" style={dim}>
                      {shift.corridor}
                    </span>
                  )}
                  {shift.address && (
                    <div className="text-xs mt-0.5" style={dimmer}>
                      {shift.address}
                    </div>
                  )}
                </div>
                <span className="mono text-[10px]" style={{ color: "var(--spark-lime, #f2f3ee)" }}>
                  {fmtDateTime(shift.startTime)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Field call-outs */}
      <div className="spark-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-sm">Field Call-Outs</h3>
            <p className="mono text-[10px] mt-1" style={dimmer}>
              {report.callouts.length} NOTE{report.callouts.length === 1 ? "" : "S"} IN WINDOW
            </p>
          </div>
          <button
            type="button"
            onClick={requestSummary}
            disabled={summaryInFlight || report.callouts.length === 0}
            title={
              report.callouts.length === 0
                ? "No field call-outs in this window to summarize."
                : undefined
            }
            className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40"
            style={{ background: "var(--spark-lime, #f2f3ee)", color: "var(--spark-on-accent)" }}
          >
            {summaryInFlight ? "Summarizing…" : "Summarize with AI"}
          </button>
        </div>

        {aiSummary && (
          <div
            className="rounded-xl p-3 mb-4 text-xs whitespace-pre-line"
            style={{
              background: "rgba(var(--spark-accent-rgb),0.06)",
              border: "1px solid rgba(var(--spark-accent-rgb),0.25)",
              color: "var(--spark-text)",
            }}
          >
            <p className="mono text-[9px] mb-2" style={{ color: "var(--spark-lime, #f2f3ee)", letterSpacing: "0.1em" }}>
              AI SUMMARY{summaryIsStale ? " · FROM A PREVIOUS WINDOW — RE-SUMMARIZE FOR THIS ONE" : ""}
            </p>
            {aiSummary}
          </div>
        )}

        {report.callouts.length === 0 ? (
          <p className="text-xs py-4 text-center" style={dim}>
            No field notes or feedback in this window.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.callouts.map((c, i) => (
              <li key={i} className="py-2" style={{ borderBottom: "1px solid rgba(var(--spark-ink-rgb),0.05)" }}>
                <p className="mono text-[9px] mb-1" style={dimmer}>
                  {[c.market, c.corridor].filter(Boolean).join(" · ") || "FIELD NOTE"}
                  {c.date ? ` · ${shortDate(c.date).toUpperCase()}` : ""}
                </p>
                <p className="text-sm" style={{ color: "var(--spark-text)" }}>
                  <ExpandableText text={c.text} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

const SparkFieldSamplingReport: React.FC = () => {
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <div className="max-w-7xl space-y-5 spark-scale">
        <SparkHubTabs tabs={REPORTS_HUB_TABS} ariaLabel="Analytics views" />
        <SparkPageHeader
          eyebrow="Reports & ROI · Field sampling"
          title="Field sampling report"
          support="Samples per hour, YTD and weekly SKU breakdowns, locations hit, upcoming shifts, and field call-outs grouped by metro market."
        />
        {tenantId ? (
          <Suspense
            fallback={
              <div className="text-sm py-8" style={dim}>
                Building report…
              </div>
            }
          >
            <ReportBody tenantId={tenantId} />
          </Suspense>
        ) : (
          <p className="text-sm" style={dim}>
            Pick a tenant first (top-left switcher).
          </p>
        )}
      </div>
    </Layout>
  );
};

export default SparkFieldSamplingReport;
