import { useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopoJson from "us-atlas/states-10m.json";
import { TenantMarketPerformanceQuery } from "@/api/queries/TenantMarketPerformanceQuery";
import type { TenantMarketPerformanceQuery as TenantMarketPerformanceQueryType } from "@api/queries/__generated__/TenantMarketPerformanceQuery.graphql";

/**
 * Geographic Performance heatmap for the dashboards.
 *
 * Loads `tenantMarketPerformance` (all-time) for ONE client (tenant) and renders
 * a real US choropleth — each state filled by the selected KPI via a linear
 * ramp from a muted base → the bright spark-lime accent — plus a hover tooltip
 * per state, a low→high color legend, and a compact "Top states" ranked list
 * beside the map. The map geometry is the static `us-atlas` states TopoJSON
 * (bundled by Vite), decoded to GeoJSON features with `topojson-client` and
 * drawn as SVG paths via a d3-geo Albers-USA projection — no map-library
 * dependency. Each feature is joined to the backend's 2-letter `state` codes
 * through a static 50-state FIPS lookup (us-atlas keys features by FIPS id).
 *
 * A KPI selector (Consumers reached / Samples distributed / Products sold /
 * Total engagements / Events) chooses which metric colors the map; default is
 * Consumers reached.
 *
 * Mounted on both dashboards (admin DashboardEvent and the client
 * SparkClientDashboard) near the KPI / Insights panels, scoped to the active
 * tenant via `useAuthStore().tenantId` — the same id every per-tenant surface
 * uses. The caller renders nothing when no tenant is in scope; this component is
 * wrapped in a <Suspense> by the dashboard (same as the other lazy-loaded
 * dashboard cards) so it loads the data the app's usual way and doesn't block
 * first paint. Dark-theme styled to match <TenantKpiCharts> / <TenantInsights
 * Panel>: a calm `spark-card` surface, mono labels, display headings.
 *
 * Empty state: when `tenantMarketPerformance` is [] (no placed activity) we show
 * a quiet "No geographic data yet" card instead of a blank map.
 */

/* ─────────────────────── types & metric config ─────────────────────── */

type MarketRow =
  TenantMarketPerformanceQueryType["response"]["tenantMarketPerformance"][number];

// Selectable metrics. `field` is the MarketPerformance field that colors the
// map + drives the ranking; `label` is the human label in the selector/legend.
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

const fmt = (n: number) => n.toLocaleString();

/* ─────────────────────── 2-letter code → FIPS / name ─────────────────────── */

// us-atlas keys each state geography by its 2-digit FIPS `id` and carries a
// `properties.name`; the backend keys rows by the 2-letter postal code. This
// static table joins the two. Includes DC so District activity still colors in.
const STATE_BY_CODE: Record<string, { fips: string; name: string }> = {
  AL: { fips: "01", name: "Alabama" },
  AK: { fips: "02", name: "Alaska" },
  AZ: { fips: "04", name: "Arizona" },
  AR: { fips: "05", name: "Arkansas" },
  CA: { fips: "06", name: "California" },
  CO: { fips: "08", name: "Colorado" },
  CT: { fips: "09", name: "Connecticut" },
  DE: { fips: "10", name: "Delaware" },
  DC: { fips: "11", name: "District of Columbia" },
  FL: { fips: "12", name: "Florida" },
  GA: { fips: "13", name: "Georgia" },
  HI: { fips: "15", name: "Hawaii" },
  ID: { fips: "16", name: "Idaho" },
  IL: { fips: "17", name: "Illinois" },
  IN: { fips: "18", name: "Indiana" },
  IA: { fips: "19", name: "Iowa" },
  KS: { fips: "20", name: "Kansas" },
  KY: { fips: "21", name: "Kentucky" },
  LA: { fips: "22", name: "Louisiana" },
  ME: { fips: "23", name: "Maine" },
  MD: { fips: "24", name: "Maryland" },
  MA: { fips: "25", name: "Massachusetts" },
  MI: { fips: "26", name: "Michigan" },
  MN: { fips: "27", name: "Minnesota" },
  MS: { fips: "28", name: "Mississippi" },
  MO: { fips: "29", name: "Missouri" },
  MT: { fips: "30", name: "Montana" },
  NE: { fips: "31", name: "Nebraska" },
  NV: { fips: "32", name: "Nevada" },
  NH: { fips: "33", name: "New Hampshire" },
  NJ: { fips: "34", name: "New Jersey" },
  NM: { fips: "35", name: "New Mexico" },
  NY: { fips: "36", name: "New York" },
  NC: { fips: "37", name: "North Carolina" },
  ND: { fips: "38", name: "North Dakota" },
  OH: { fips: "39", name: "Ohio" },
  OK: { fips: "40", name: "Oklahoma" },
  OR: { fips: "41", name: "Oregon" },
  PA: { fips: "42", name: "Pennsylvania" },
  RI: { fips: "44", name: "Rhode Island" },
  SC: { fips: "45", name: "South Carolina" },
  SD: { fips: "46", name: "South Dakota" },
  TN: { fips: "47", name: "Tennessee" },
  TX: { fips: "48", name: "Texas" },
  UT: { fips: "49", name: "Utah" },
  VT: { fips: "50", name: "Vermont" },
  VA: { fips: "51", name: "Virginia" },
  WA: { fips: "53", name: "Washington" },
  WV: { fips: "54", name: "West Virginia" },
  WI: { fips: "55", name: "Wisconsin" },
  WY: { fips: "56", name: "Wyoming" },
};

// Reverse: FIPS (zero-padded, as us-atlas ids) → 2-letter code, so we can look
// up a geography's backend row from its `id` during render.
const CODE_BY_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_BY_CODE).map(([code, v]) => [v.fips, code]),
);

const codeForGeoId = (id: string | number | undefined): string | undefined => {
  if (id == null) return undefined;
  // us-atlas ids are 2-char strings ("06"); be defensive about number ids.
  const key = typeof id === "number" ? String(id).padStart(2, "0") : id;
  return CODE_BY_FIPS[key];
};

/* ─────────────────────── map geometry (topojson → svg paths) ─────────────────────── */

// SVG user-space box the projection is fit to; the <svg> scales responsively to
// its container via viewBox while staying within a bounded height (see render).
const MAP_W = 800;
const MAP_H = 420;

// One GeoJSON feature per state geometry. `feature()` decodes the us-atlas
// states TopoJSON object into a FeatureCollection; we read its `.features`
// once at module load (pure + cheap, no React peer). Each feature's `id` is the
// 2-digit FIPS string we join to the backend rows via codeForGeoId.
type StateFeature = {
  id?: string | number;
  properties: { name?: string } & Record<string, unknown>;
  [key: string]: unknown;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- topojson/d3-geo decode:
   the us-atlas Topology is a hand-shimmed JSON module, so we hand topojson's
   feature() and d3-geo's projection the structural objects via `any` (exactly
   the published topojson-client recipe) and re-type the decoded result. */
const STATE_FEATURES: StateFeature[] = (
  feature(statesTopoJson as any, (statesTopoJson as any).objects.states) as any
).features;

// Albers-USA projection fit to the MAP_W×MAP_H box over the full state set, and
// a path generator that turns each feature into an SVG `d` string.
const mapProjection = geoAlbersUsa().fitSize([MAP_W, MAP_H], {
  type: "FeatureCollection",
  features: STATE_FEATURES,
} as any);
const mapPathGen = geoPath(mapProjection);
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ─────────────────────── color ramp ─────────────────────── */

// Muted base (a dark spark-surface tone) → bright spark-lime accent. We
// interpolate the two rgb triples by value/max — no d3-scale needed. States
// with no data render in EMPTY_FILL (a neutral, near-invisible fill).
const RAMP_BASE: [number, number, number] = [34, 41, 26]; // muted lime-tinted dark
const RAMP_ACCENT: [number, number, number] = [197, 245, 70]; // var(--spark-lime)
const EMPTY_FILL = "rgba(255,255,255,0.045)";
const STROKE = "#0a0d09"; // var(--spark-bg) — thin separators between states

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

// t ∈ [0,1]. We floor the ramp at a small t so even the lowest non-zero state
// reads as "lit" rather than blending into the empty fill.
const rampColor = (t: number): string => {
  const clamped = Math.max(0, Math.min(1, t));
  const eased = clamped === 0 ? 0 : 0.18 + clamped * 0.82;
  const r = lerp(RAMP_BASE[0], RAMP_ACCENT[0], eased);
  const g = lerp(RAMP_BASE[1], RAMP_ACCENT[1], eased);
  const b = lerp(RAMP_BASE[2], RAMP_ACCENT[2], eased);
  return `rgb(${r}, ${g}, ${b})`;
};

/* ─────────────────────── tooltip ─────────────────────── */

type TooltipState = {
  row: MarketRow;
  name: string;
  x: number;
  y: number;
} | null;

const Tooltip: React.FC<{ tip: NonNullable<TooltipState> }> = ({ tip }) => {
  const rows: { label: string; value: number }[] = [
    { label: "Events", value: tip.row.eventCount },
    { label: "Recaps", value: tip.row.recapCount },
    { label: "Consumers reached", value: tip.row.consumersReached },
    { label: "Samples distributed", value: tip.row.samplesDistributed },
    { label: "Products sold", value: tip.row.productsSold },
    { label: "Engagements", value: tip.row.totalEngagements },
  ];
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: tip.x + 14,
        top: tip.y + 14,
        minWidth: 180,
        background: "var(--spark-surface-2, #161a12)",
        border: "1px solid var(--spark-border)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <p
        className="display font-bold text-sm mb-2"
        style={{ color: "var(--spark-text)", letterSpacing: "-0.01em" }}
      >
        {tip.name}
      </p>
      <div className="grid grid-cols-1 gap-1">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-4"
          >
            <span
              className="mono text-[9px]"
              style={{
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
              }}
            >
              {r.label}
            </span>
            <span
              className="tab-num text-[12px] font-semibold"
              style={{ color: "var(--spark-text)" }}
            >
              {fmt(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────── panel ─────────────────────── */

const TenantGeoHeatmap: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [metricKey, setMetricKey] = useState<MetricKey>("consumersReached");
  const [tip, setTip] = useState<TooltipState>(null);
  // Which state path the cursor is over — drives the lime hover fill that RSM's
  // style.hover used to handle. Matched against each feature's FIPS `id`.
  const [hoverId, setHoverId] = useState<string | number | null>(null);

  const data = useLazyLoadQuery<TenantMarketPerformanceQueryType>(
    TenantMarketPerformanceQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );

  const rows = useMemo(
    () => data?.tenantMarketPerformance ?? [],
    [data],
  );

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  // Index rows by 2-letter code for O(1) geography lookup, and find the max of
  // the selected metric to normalize the ramp.
  const { byCode, maxValue } = useMemo(() => {
    const map: Record<string, MarketRow> = {};
    let max = 0;
    for (const r of rows) {
      const code = r.state?.toUpperCase();
      if (!code) continue;
      map[code] = r;
      const v = r[metricKey];
      if (v > max) max = v;
    }
    return { byCode: map, maxValue: max };
  }, [rows, metricKey]);

  // Ranked list — states sorted desc by the selected metric. Drop zero values
  // so the list shows only states with activity for this metric.
  const ranked = useMemo(
    () =>
      [...rows]
        .filter((r) => r[metricKey] > 0)
        .sort((a, b) => b[metricKey] - a[metricKey]),
    [rows, metricKey],
  );

  // Empty: no placed activity anywhere. Quiet card instead of a blank map.
  if (rows.length === 0) {
    return (
      <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h2
            className="display text-lg lg:text-xl font-bold"
            style={{ letterSpacing: "-0.02em" }}
          >
            Geographic performance
          </h2>
        </div>
        <p
          className="text-sm py-10 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No geographic data yet — states light up here as placed activity comes
          in.
        </p>
      </div>
    );
  }

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          Geographic performance
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            {ranked.length} {ranked.length === 1 ? "STATE" : "STATES"} · ALL TIME
          </p>
          {/* KPI selector — which metric colors the map + drives the ranking.
              Same compact dark <select> chrome as the KPI panel's year dropdown
              so the two surfaces read as one. Default = Consumers reached. */}
          <select
            aria-label="Heatmap metric"
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value as MetricKey)}
            className="mono text-[11px] rounded-lg px-2.5 py-1.5 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              letterSpacing: "0.06em",
            }}
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Choropleth — spans 2 of 3 columns on lg. Height bounded; the SVG
            scales responsively to its container via the viewBox. */}
        <div className="lg:col-span-2">
          <div
            className="relative"
            style={{ width: "100%", maxHeight: 360 }}
            onMouseLeave={() => setTip(null)}
          >
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              role="img"
              aria-label={`US map shaded by ${metric.label.toLowerCase()} per state`}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: "100%", height: "auto", maxHeight: 360 }}
            >
              {STATE_FEATURES.map((feat) => {
                const code = codeForGeoId(feat.id);
                const row = code ? byCode[code] : undefined;
                const value = row ? row[metricKey] : 0;
                const baseFill =
                  row && value > 0
                    ? rampColor(maxValue > 0 ? value / maxValue : 0)
                    : EMPTY_FILL;
                const hovered = hoverId != null && feat.id === hoverId;
                const fill = hovered && row ? "var(--spark-lime)" : baseFill;
                const d = mapPathGen(feat as never);
                if (!d) return null;
                return (
                  <path
                    key={String(feat.id)}
                    d={d}
                    fill={fill}
                    stroke={STROKE}
                    strokeWidth={hovered ? 0.75 : 0.5}
                    style={{
                      outline: "none",
                      cursor: row ? "pointer" : "default",
                    }}
                    onMouseEnter={(e) => {
                      setHoverId(feat.id ?? null);
                      if (!row || !code) return;
                      setTip({
                        row,
                        name:
                          STATE_BY_CODE[code]?.name ??
                          (feat.properties.name as string) ??
                          code,
                        x: e.nativeEvent.offsetX,
                        y: e.nativeEvent.offsetY,
                      });
                    }}
                    onMouseMove={(e) => {
                      if (!row) return;
                      setTip((prev) =>
                        prev
                          ? {
                              ...prev,
                              x: e.nativeEvent.offsetX,
                              y: e.nativeEvent.offsetY,
                            }
                          : prev,
                      );
                    }}
                    onMouseLeave={() => {
                      setHoverId((prev) => (prev === feat.id ? null : prev));
                      setTip(null);
                    }}
                  />
                );
              })}
            </svg>
            {tip && <Tooltip tip={tip} />}
          </div>

          {/* Legend — low→high ramp swatch + the active metric name. */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <p
              className="mono text-[9px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
              }}
            >
              {metric.label}
            </p>
            <div className="flex items-center gap-2">
              <span
                className="mono text-[9px]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Low
              </span>
              <div
                aria-hidden="true"
                style={{
                  width: 120,
                  height: 8,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${rampColor(0.02)}, ${rampColor(1)})`,
                  border: "1px solid var(--spark-border)",
                }}
              />
              <span
                className="mono text-[9px]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                High{maxValue > 0 ? ` · ${fmt(maxValue)}` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Top states ranked list — sorted desc by the selected metric, with
            the value. Both useful on its own and a graceful companion to the
            map (and the whole story when a state geometry is hard to hit). */}
        <div>
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            TOP STATES
          </p>
          {ranked.length === 0 ? (
            <p
              className="text-[13px]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              No states with {metric.label.toLowerCase()} yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ranked.slice(0, 10).map((r, i) => {
                const code = r.state.toUpperCase();
                const name = STATE_BY_CODE[code]?.name ?? code;
                const value = r[metricKey];
                const pct = maxValue > 0 ? value / maxValue : 0;
                return (
                  <li
                    key={code}
                    className="relative rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--spark-border)" }}
                  >
                    {/* Mini inline bar so the list reads as a ranking, not just
                        rows — width tracks the value vs. the leader. */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${Math.max(6, pct * 100)}%`,
                        background: rampColor(pct),
                        opacity: 0.22,
                      }}
                    />
                    <div className="relative flex items-center justify-between gap-2 px-3 py-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="mono text-[10px] shrink-0"
                          style={{ color: "rgba(255,255,255,0.4)" }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className="text-[13px] truncate"
                          style={{ color: "var(--spark-text)" }}
                        >
                          {name}
                        </span>
                      </span>
                      <span
                        className="tab-num text-[13px] font-bold shrink-0"
                        style={{ color: "var(--spark-lime)" }}
                      >
                        {fmt(value)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantGeoHeatmap;
