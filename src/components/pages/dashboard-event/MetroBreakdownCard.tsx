import { useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantMetroBreakdownQuery } from "@/api/queries/TenantMetroBreakdownQuery";
import type { TenantMetroBreakdownQuery as TenantMetroBreakdownQueryType } from "@api/queries/__generated__/TenantMetroBreakdownQuery.graphql";
import { EventTypeQuery } from "@/api/queries/EventTypeQuery";
import type { EventTypeQuery as EventTypeQueryType } from "@api/queries/__generated__/EventTypeQuery.graphql";

/**
 * Week-by-metro-market breakdown table for tenants whose events follow the
 * "<Market> — <Corridor> · <date>" naming convention — Feel Free's
 * Guerrilla Field Sampling program (Miami, Ft. Lauderdale, Tampa/St. Pete,
 * Austin, San Antonio), which has no structured city/market field to
 * group by (see `tenantMetroBreakdown` / `recaps/tenant_overview.py` on
 * the backend). Kyle's ask: "pull a date range from week to week broken
 * down by each individual market" — the YTD range pill up top has no way
 * to slice by market, so this is a dedicated card with its own date-range
 * control.
 *
 * Renders NOTHING when the backend returns zero metros — i.e. tenants
 * whose events don't follow the naming convention never see this section
 * (Girl Beer, Liquid Death, etc. are unaffected). That emptiness check
 * doubles as "does this feature apply to this tenant," so there's no
 * separate per-tenant feature flag to maintain.
 *
 * Mounted on the admin DashboardEvent page (same pattern as
 * <TenantGeoHeatmap> / <TenantBaLeaderboard>), scoped to the active tenant
 * via `useAuthStore().tenantId`.
 */

type MetricKey =
  | "consumersReached"
  | "samplesDistributed"
  | "productsSold"
  | "totalEngagements"
  | "eventCount";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "consumersReached", label: "Consumers reached" },
  { key: "samplesDistributed", label: "Samples distributed" },
  { key: "productsSold", label: "Products sold" },
  { key: "totalEngagements", label: "Total engagements" },
  { key: "eventCount", label: "Events" },
];

const PRESETS: { key: string; label: string; weeks: number }[] = [
  { key: "4w", label: "4 weeks", weeks: 4 },
  { key: "8w", label: "8 weeks", weeks: 8 },
  { key: "12w", label: "12 weeks", weeks: 12 },
];

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const weeksAgoRange = (weeks: number): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (weeks * 7 - 1));
  return { start: toIsoDate(start), end: toIsoDate(end) };
};

// "2026-07-02" -> "Jul 2" (local, no UTC shift — see wallDate in
// ImportConnecteamPdfModal.tsx for the same construction rationale).
const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const fmtNum = (v: number) => v.toLocaleString();

type Props = { tenantId: string };

const MetroBreakdownCard: React.FC<Props> = ({ tenantId }) => {
  const initial = weeksAgoRange(8);
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  // undefined = "no explicit choice yet, use the smart default (first metric
  // with data)"; set = the user picked this metric and it sticks.
  const [metricOverride, setMetricOverride] = useState<MetricKey | undefined>(
    undefined,
  );
  // undefined = "no user override yet, use the auto-detected Field Sampling
  // type"; null = "user explicitly chose All event types."
  const [eventTypeOverride, setEventTypeOverride] = useState<
    string | null | undefined
  >(undefined);

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

  const data = useLazyLoadQuery<TenantMetroBreakdownQueryType>(
    TenantMetroBreakdownQuery,
    {
      tenantId,
      startDate,
      endDate,
      eventTypeId: effectiveEventTypeId,
    },
    { fetchPolicy: "store-or-network" },
  );

  const breakdown = data?.tenantMetroBreakdown;
  const metros = breakdown?.metros ?? [];
  const weeks = breakdown?.weeks ?? [];

  // Smart default: keep the historical "Consumers reached" default when it
  // actually has data, but fall through to the first KPI that does — so a
  // samples-only program (Feel Free tracks structured samples, not per-metro
  // consumers) opens on "Samples distributed" instead of an all-zero table.
  // A user's explicit pick (metricOverride) always wins.
  const smartDefaultMetric = useMemo<MetricKey>(() => {
    const sumOf = (key: MetricKey) =>
      weeks.reduce(
        (wsum, week) =>
          wsum + week.cells.reduce((csum, c) => csum + (c[key] ?? 0), 0),
        0,
      );
    const preference: MetricKey[] = [
      "consumersReached",
      "samplesDistributed",
      "productsSold",
      "totalEngagements",
    ];
    for (const key of preference) {
      if (sumOf(key) > 0) return key;
    }
    return "consumersReached";
  }, [weeks]);
  const metric = metricOverride ?? smartDefaultMetric;

  // No metros / a single market / no activity → hide the card. One
  // market plus 4/8/12-week controls is empty chrome, not a breakdown.
  const hasAnyValue = weeks.some((week) =>
    week.cells.some((c) =>
      METRICS.some((m) => Number(c[m.key] ?? 0) > 0),
    ),
  );
  if (metros.length < 2 || !hasAnyValue) return null;

  const applyPreset = (n: number) => {
    const r = weeksAgoRange(n);
    setStartDate(r.start);
    setEndDate(r.end);
  };

  return (
    <div className="spark-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-sm">Metro Market Breakdown</h3>
          <p
            className="mono text-[10px] mt-1"
            style={{ letterSpacing: "0.08em", color: "var(--spark-text-meta)" }}
          >
            WEEK-BY-WEEK · {metros.length} MARKET{metros.length === 1 ? "" : "S"}
          </p>
        </div>
        <select
          value={metric}
          onChange={(e) => setMetricOverride(e.target.value as MetricKey)}
          className="text-xs"
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            background: "rgba(var(--spark-ink-rgb),0.04)",
            border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
            color: "#fff",
          }}
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.weeks)}
            className="text-xs px-2.5 py-1 rounded-full transition hover:bg-white/5"
            style={{
              border: "1px solid rgba(var(--spark-ink-rgb),0.14)",
              color: "var(--spark-text-secondary)",
              background: "transparent",
            }}
          >
            {p.label}
          </button>
        ))}
        <span
          className="mono text-[10px] mx-1"
          style={{ color: "var(--spark-text-meta)" }}
        >
          OR
        </span>
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="text-xs"
          style={{
            padding: "5px 8px",
            borderRadius: 8,
            background: "rgba(var(--spark-ink-rgb),0.04)",
            border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
            color: "#fff",
            colorScheme: "dark",
          }}
        />
        <span style={{ color: "var(--spark-text-meta)" }}>–</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="text-xs"
          style={{
            padding: "5px 8px",
            borderRadius: 8,
            background: "rgba(var(--spark-ink-rgb),0.04)",
            border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
            color: "#fff",
            colorScheme: "dark",
          }}
        />
        {eventTypes.length > 1 && (
          <select
            value={effectiveEventTypeId ?? ""}
            onChange={(e) => setEventTypeOverride(e.target.value || null)}
            className="text-xs ml-auto"
            style={{
              padding: "5px 8px",
              borderRadius: 8,
              background: "rgba(var(--spark-ink-rgb),0.04)",
              border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
              color: "#fff",
            }}
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

      {weeks.length === 0 ? (
        <div
          className="text-xs py-6 text-center"
          style={{ color: "var(--spark-text-meta)" }}
        >
          No activity in this date range.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--spark-border, #1f2418)" }}>
                <th
                  className="text-left py-2 pr-3 font-normal mono"
                  style={{ color: "var(--spark-text-meta)", letterSpacing: "0.06em" }}
                >
                  WEEK OF
                </th>
                {metros.map((metro) => (
                  <th
                    key={metro}
                    className="text-right py-2 px-3 font-semibold"
                    style={{ color: "var(--spark-text)" }}
                  >
                    {metro}
                  </th>
                ))}
                <th
                  className="text-right py-2 pl-3 font-semibold"
                  style={{ color: "var(--spark-lime, #f2f3ee)" }}
                >
                  All markets
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => {
                const total = week.cells.reduce(
                  (sum, c) => sum + (c[metric] ?? 0),
                  0,
                );
                return (
                  <tr
                    key={`${week.isoYear}-${week.isoWeek}`}
                    style={{ borderBottom: "1px solid rgba(var(--spark-ink-rgb),0.05)" }}
                  >
                    <td className="py-2 pr-3" style={{ color: "var(--spark-text-secondary)" }}>
                      {shortDate(week.weekStart)}
                    </td>
                    {metros.map((metro) => {
                      const cell = week.cells.find((c) => c.metro === metro);
                      return (
                        <td
                          key={metro}
                          className="text-right py-2 px-3 tabular-nums"
                          style={{
                            color: cell
                              ? "rgba(var(--spark-ink-rgb),0.9)"
                              : "rgba(var(--spark-ink-rgb),0.25)",
                          }}
                        >
                          {cell ? fmtNum(cell[metric] ?? 0) : "—"}
                        </td>
                      );
                    })}
                    <td
                      className="text-right py-2 pl-3 tabular-nums font-semibold"
                      style={{ color: "var(--spark-lime, #f2f3ee)" }}
                    >
                      {fmtNum(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MetroBreakdownCard;
