import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
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

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  colorScheme: "dark",
};

const eyebrow: React.CSSProperties = {
  letterSpacing: "0.18em",
  color: "rgba(255,255,255,0.55)",
  textTransform: "uppercase",
};

const dim: React.CSSProperties = { color: "rgba(255,255,255,0.55)" };
const dimmer: React.CSSProperties = { color: "rgba(255,255,255,0.4)" };

const modeLabel = (mode: string): string =>
  mode === "quantity" ? "UNITS" : mode === "sessions" ? "SESSIONS (approx.)" : "NO DATA";

const modeColor = (mode: string): string =>
  mode === "quantity"
    ? "var(--spark-lime, #f2f3ee)"
    : mode === "sessions"
      ? "rgba(255,200,80,0.85)"
      : "rgba(255,255,255,0.4)";

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
        <h3 className="font-bold text-sm">{title}</h3>
        <span
          className="mono text-[9px] px-2 py-0.5 rounded-full"
          style={{
            border: `1px solid ${modeColor(mode)}`,
            color: modeColor(mode),
            letterSpacing: "0.08em",
          }}
        >
          {modeLabel(mode)}
        </span>
      </div>
      <p className="mono text-[10px] mb-3" style={dimmer}>
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
              {items.map((item) => (
                <tr
                  key={item.product}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <td className="py-1.5 pr-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {item.product}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">
                    {fmtNum(item.total)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="pt-2 font-semibold" style={dim}>
                  Total
                </td>
                <td
                  className="pt-2 text-right tabular-nums font-bold"
                  style={{ color: modeColor(mode) }}
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
            "No AI summary available for this window (Gemini unavailable, or nothing to summarize).",
            "error",
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
            className="text-xs px-2.5 py-1 rounded-full transition hover:bg-white/5"
            style={{ border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)" }}
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
          style={inputStyle}
        />
        <span style={dimmer}>–</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="text-xs"
          style={inputStyle}
        />
        <select
          value={market ?? ""}
          onChange={(e) => setMarket(e.target.value || null)}
          className="text-xs ml-auto"
          style={inputStyle}
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
            style={inputStyle}
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
            label: "Samples / hour",
            value: report.samplesPerHour.perHour != null ? report.samplesPerHour.perHour.toFixed(2) : "—",
          },
          { label: "Samples (window)", value: fmtNum(report.samplesPerHour.samples) },
          { label: "Hours (window)", value: report.samplesPerHour.hours.toFixed(1) },
          { label: "Samples YTD", value: fmtNum(ytdTotal) },
        ].map((t) => (
          <div
            key={t.label}
            className="spark-card rounded-2xl px-4 py-3"
            style={{ borderTop: "2px solid var(--spark-lime, #f2f3ee)" }}
          >
            <p className="mono text-[9px]" style={eyebrow}>
              {t.label}
            </p>
            <p className="text-xl font-bold tabular-nums">{t.value}</p>
          </div>
        ))}
      </div>
      {report.samplesPerHour.estimated && (
        <p className="text-xs" style={{ color: "rgba(255,200,80,0.85)" }}>
          ⚠ At least one shift in this window has no real clock-in/out pair —
          scheduled duration was used for hours.
        </p>
      )}

      {/* SKU breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkuBreakdownCard
          title="YTD SKU Breakdown"
          subtitle={`JAN 1 – TODAY`}
          mode={report.ytdSkuBreakdown.mode}
          items={report.ytdSkuBreakdown.items}
        />
        <SkuBreakdownCard
          title="This Window's SKU Breakdown"
          subtitle={`${shortDate(startDate).toUpperCase()} – ${shortDate(endDate).toUpperCase()}`}
          mode={report.weekSkuBreakdown.mode}
          items={report.weekSkuBreakdown.items}
        />
      </div>

      {/* Locations hit */}
      <div className="spark-card p-5">
        <h3 className="font-bold text-sm mb-1">Locations Hit</h3>
        <p className="mono text-[10px] mb-3" style={dimmer}>
          {report.locationsHit.length} STOP{report.locationsHit.length === 1 ? "" : "S"} IN WINDOW
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
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td className="py-1.5 pr-3" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {shortDate(loc.date)}
                    </td>
                    <td className="py-1.5 pr-3 font-semibold">{loc.market ?? "—"}</td>
                    <td className="py-1.5 pr-3" style={{ color: "rgba(255,255,255,0.85)" }}>
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
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
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
            style={{ background: "var(--spark-lime, #f2f3ee)", color: "#0a0d09" }}
          >
            {summaryInFlight ? "Summarizing…" : "✦ Summarize with AI"}
          </button>
        </div>

        {aiSummary && (
          <div
            className="rounded-xl p-3 mb-4 text-xs whitespace-pre-line"
            style={{
              background: "rgba(242,243,238,0.06)",
              border: "1px solid rgba(242,243,238,0.25)",
              color: "rgba(255,255,255,0.9)",
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
              <li key={i} className="py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="mono text-[9px] mb-1" style={dimmer}>
                  {[c.market, c.corridor].filter(Boolean).join(" · ") || "UNKNOWN LOCATION"}
                  {c.date ? ` · ${shortDate(c.date).toUpperCase()}` : ""}
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {c.text}
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
      <div className="max-w-6xl space-y-6">
        <div>
          <p className="mono text-[10px]" style={eyebrow}>
            OUTPUTS · FIELD SAMPLING
          </p>
          <h1 className="text-2xl font-bold mt-1 mb-1">Field Sampling Report</h1>
          <p className="text-xs" style={dim}>
            Samples per hour, YTD + weekly SKU breakdowns, locations hit,
            what's coming up next, and field call-outs — grouped by metro
            market for guerrilla field-sampling programs.
          </p>
        </div>
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
