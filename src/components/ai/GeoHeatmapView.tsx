import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopoJson from "us-atlas/states-10m.json";
import { inkRgba } from "@/theme/chartInk";
import { readAppearance } from "@/theme/appearance";
import { chartSurface } from "@/lib/sparkChart";
import {
  NO_DATA_FILL,
  focusBox,
  labelInk,
  rampColor,
  rampPosition,
  shareLabel,
  type Box,
  type Mode,
} from "@/lib/geoHeatmap";

/**
 * The Geographic performance card, drawn from rows already loaded (see
 * <TenantGeoHeatmap> for the query). A US map shaded by the chosen KPI in
 * one blue (more = stronger), each active state labelled with its value,
 * a ranked list beside it, and a hover tooltip per state. When all the
 * activity sits in one corner of the country the map frames those states
 * instead of showing a mostly empty US; a button switches to the full map.
 */

export type GeoRow = {
  readonly state: string;
  readonly eventCount: number;
  readonly recapCount: number;
  readonly consumersReached: number;
  readonly samplesDistributed: number;
  readonly productsSold: number;
  readonly totalEngagements: number;
};

export type MetricKey =
  | "consumersReached"
  | "samplesDistributed"
  | "productsSold"
  | "totalEngagements"
  | "eventCount";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "consumersReached", label: "Consumers sampled" },
  { key: "samplesDistributed", label: "Samples handed out" },
  { key: "productsSold", label: "Products sold" },
  { key: "totalEngagements", label: "Total engagements" },
  { key: "eventCount", label: "Events" },
];

const fmt = (n: number) => n.toLocaleString("en-US");

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;

/* ─────────────────────── 2-letter code → FIPS / name ─────────────────────── */

// us-atlas keys each state by its 2-digit FIPS id; the backend keys rows by
// the 2-letter postal code. Includes DC.
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

const CODE_BY_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_BY_CODE).map(([code, v]) => [v.fips, code]),
);

const codeForGeoId = (id: string | number | undefined): string | undefined => {
  if (id == null) return undefined;
  const key = typeof id === "number" ? String(id).padStart(2, "0") : id;
  return CODE_BY_FIPS[key];
};

const stateName = (code: string) => STATE_BY_CODE[code]?.name ?? code;

/* ─────────────────────── geometry ─────────────────────── */

const MAP_W = 800;
const MAP_H = 500;

type StateShape = {
  code: string;
  d: string;
  /** Where the label goes, in map units. */
  cx: number;
  cy: number;
  bounds: Box;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- topojson/d3-geo decode:
   the us-atlas Topology is a hand-shimmed JSON module, so topojson's
   feature() and d3-geo's projection get the structural objects via `any`
   (the published topojson-client recipe). */
const STATE_FEATURES: { id?: string | number }[] = (
  feature(statesTopoJson as any, (statesTopoJson as any).objects.states) as any
).features;
const projection = geoAlbersUsa().fitSize([MAP_W, MAP_H], {
  type: "FeatureCollection",
  features: STATE_FEATURES,
} as any);
const pathGen = geoPath(projection);
/* eslint-enable @typescript-eslint/no-explicit-any */

// A few states' geometric centres fall somewhere awkward (Florida's in the
// panhandle bend, Michigan's in the lake); nudge their labels, in map units.
const LABEL_NUDGE: Record<string, [number, number]> = {
  FL: [14, 16],
  MI: [12, 18],
  LA: [-8, 0],
  KY: [6, 2],
  WV: [-2, 4],
  ID: [0, 16],
  VA: [8, 2],
  MD: [-6, -2],
  CA: [-8, 0],
};

const SHAPES: StateShape[] = STATE_FEATURES.flatMap((feat) => {
  const code = codeForGeoId(feat.id);
  const d = pathGen(feat as never);
  if (!code || !d) return [];
  const [cx, cy] = pathGen.centroid(feat as never);
  const [[x0, y0], [x1, y1]] = pathGen.bounds(feat as never);
  const [nx, ny] = LABEL_NUDGE[code] ?? [0, 0];
  return [
    {
      code,
      d,
      cx: cx + nx,
      cy: cy + ny,
      bounds: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    },
  ];
});
const SHAPE_BY_CODE = Object.fromEntries(SHAPES.map((s) => [s.code, s]));

// Hit-testing for label placement: the state outlines as Path2D, tested on
// a throwaway canvas. Missing outside a browser, where labels are skipped.
const hitCtx: CanvasRenderingContext2D | null = (() => {
  try {
    return typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");
  } catch {
    return null;
  }
})();
const outlines = new Map<string, Path2D>();
const outline = (shape: StateShape): Path2D | null => {
  if (typeof Path2D === "undefined") return null;
  let p = outlines.get(shape.code);
  if (!p) {
    p = new Path2D(shape.d);
    outlines.set(shape.code, p);
  }
  return p;
};

const LABEL_FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

/** On-screen width in px of a two-line label (code over value). */
const labelWidthPx = (code: string, value: string): number => {
  if (!hitCtx) return (Math.max(code.length, value.length) * 8) + 6;
  hitCtx.font = `500 12px ${LABEL_FONT}`;
  const a = hitCtx.measureText(code).width;
  hitCtx.font = `700 13px ${LABEL_FONT}`;
  const b = hitCtx.measureText(value).width;
  return Math.max(a, b) + 4;
};

/** Whether a w×h box centred on (x, y), in map units, sits inside the state. */
const boxInside = (shape: StateShape, x: number, y: number, w: number, h: number): boolean => {
  const path = outline(shape);
  if (!hitCtx || !path) return false;
  // Corners may graze the border: the label carries a halo in the state's
  // own fill, so a few pixels over the line still read as inside.
  for (const fx of [-0.4, 0, 0.4]) {
    for (const fy of [-0.4, 0, 0.4]) {
      if (!hitCtx.isPointInPath(path, x + fx * w, y + fy * h)) return false;
    }
  }
  return true;
};

/**
 * Where a w×h label fits inside a state: its centre first, then a few
 * nearby spots. Null when it fits nowhere (the ranked list and the tooltip
 * still carry that state's number).
 */
const labelSpot = (shape: StateShape, w: number, h: number): [number, number] | null => {
  if (shape.bounds.w < w || shape.bounds.h < h) return null;
  // Candidate centres on a grid over the state's box, nearest the
  // geometric centre first.
  const { cx, cy, bounds } = shape;
  const spots: [number, number][] = [[cx, cy]];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = bounds.x + w / 2 + ((bounds.w - w) * i) / N;
      const y = bounds.y + h / 2 + ((bounds.h - h) * j) / N;
      spots.push([x, y]);
    }
  }
  spots.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
  for (const [x, y] of spots) {
    if (boxInside(shape, x, y, w, h)) return [x, y];
  }
  return null;
};

const unionBox = (boxes: Box[]): Box | null => {
  if (boxes.length === 0) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** Width of the element, kept current as the layout changes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ─────────────────────── tooltip ─────────────────────── */

type Tip = { code: string; x: number; y: number; above: boolean };

const Tooltip: React.FC<{
  row: GeoRow;
  metric: { key: MetricKey; label: string };
  total: number;
  x: number;
  y: number;
  flip: boolean;
  /** Open upward (cursor in the lower half of the map). */
  above: boolean;
}> = ({ row, metric, total, x, y, flip, above }) => {
  const others: { label: string; value: number }[] = [
    { label: "Events", value: row.eventCount },
    { label: "Recaps", value: row.recapCount },
    { label: "Consumers sampled", value: row.consumersReached },
    { label: "Samples handed out", value: row.samplesDistributed },
    { label: "Products sold", value: row.productsSold },
  ].filter((r) => r.label !== metric.label);
  const value = row[metric.key];
  const share = shareLabel(value, total);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20"
      style={{
        left: flip ? undefined : x + 14,
        right: flip ? `calc(100% - ${x - 14}px)` : undefined,
        top: above ? undefined : y + 14,
        bottom: above ? `calc(100% - ${y - 14}px)` : undefined,
        minWidth: 200,
        background: "var(--spark-surface)",
        border: "1px solid var(--spark-border)",
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "var(--spark-elev-1)",
      }}
    >
      <p className="text-[13px] font-semibold m-0" style={TEXT}>
        {stateName(row.state.toUpperCase())}
      </p>
      <p className="m-0 mt-1 mb-2 flex items-baseline gap-2">
        <span className="tab-num text-lg font-semibold" style={TEXT}>
          {fmt(value)}
        </span>
        <span className="text-xs" style={SECONDARY}>
          {metric.label.toLowerCase()}
          {share ? ` · ${share} of total` : ""}
        </span>
      </p>
      <div className="grid gap-1" style={{ borderTop: "1px solid var(--spark-hairline)", paddingTop: 8 }}>
        {others.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="text-xs" style={META}>
              {r.label}
            </span>
            <span className="tab-num text-xs font-medium" style={TEXT}>
              {fmt(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────── card ─────────────────────── */

const LIST_ROWS = 8;

const Card: React.FC<{ children: React.ReactNode; meta?: React.ReactNode; controls?: React.ReactNode }> = ({
  children,
  meta,
  controls,
}) => (
  <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
    <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
      <div>
        <h2 className="display text-lg lg:text-xl font-bold m-0" style={{ letterSpacing: "-0.02em" }}>
          Geographic performance
        </h2>
        {meta ? (
          <p className="text-[13px] m-0 mt-1" style={META}>
            {meta}
          </p>
        ) : null}
      </div>
      {controls}
    </div>
    {children}
  </div>
);

export const GeoHeatmapView: React.FC<{
  rows: readonly GeoRow[];
  rangeLabel?: string;
  onSelectState?: (code: string) => void;
}> = ({ rows, rangeLabel, onSelectState }) => {
  const mode: Mode = readAppearance();
  const [metricKey, setMetricKey] = useState<MetricKey>("consumersReached");
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [mapRef, mapWidth] = useWidth<HTMLDivElement>();

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const { byCode, ranked, max, min, total } = useMemo(() => {
    const byCode: Record<string, GeoRow> = {};
    for (const r of rows) {
      const code = r.state?.toUpperCase();
      if (code && STATE_BY_CODE[code]) byCode[code] = r;
    }
    const ranked = Object.values(byCode)
      .filter((r) => r[metricKey] > 0)
      .sort((a, b) => b[metricKey] - a[metricKey]);
    const values = ranked.map((r) => r[metricKey]);
    return {
      byCode,
      ranked,
      max: values[0] ?? 0,
      min: values[values.length - 1] ?? 0,
      total: values.reduce((s, v) => s + v, 0),
    };
  }, [rows, metricKey]);

  const fillFor = (code: string): string => {
    const v = byCode[code]?.[metricKey] ?? 0;
    return v > 0 ? rampColor(rampPosition(v, max), mode) : NO_DATA_FILL[mode];
  };

  const focus = useMemo(
    () =>
      focusBox(
        unionBox(ranked.flatMap((r) => SHAPE_BY_CODE[r.state.toUpperCase()]?.bounds ?? [])),
        { w: MAP_W, h: MAP_H },
      ),
    [ranked],
  );
  const view: Box = focus && !showAll ? focus : { x: 0, y: 0, w: MAP_W, h: MAP_H };
  // Map units per screen pixel, so labels stay a fixed on-screen size
  // whatever the zoom or the card width.
  const unitsPerPx = mapWidth > 0 ? view.w / mapWidth : 0;

  const labels = useMemo(() => {
    if (!(unitsPerPx > 0)) return [];
    return ranked.flatMap((r) => {
      const code = r.state.toUpperCase();
      const shape = SHAPE_BY_CODE[code];
      if (!shape) return [];
      const text = fmt(r[metricKey]);
      const needW = labelWidthPx(code, text) * unitsPerPx;
      const needH = 30 * unitsPerPx;
      const spot = labelSpot(shape, needW, needH);
      if (!spot) return [];
      const fill = fillFor(code);
      return [{ code, text, x: spot[0], y: spot[1], ink: labelInk(fill), halo: fill }];
    });
    // fillFor reads byCode/max/mode, all covered by ranked + metricKey + mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, metricKey, unitsPerPx, mode]);

  // When zoomed in, name the neighbouring states quietly so the frame is
  // easy to place. On the full map they would only add noise.
  const zoomed = view.w < MAP_W;
  const contextLabels = useMemo(() => {
    if (!zoomed || !(unitsPerPx > 0)) return [];
    const activeCodes = new Set(ranked.map((r) => r.state.toUpperCase()));
    return SHAPES.flatMap((shape) => {
      if (activeCodes.has(shape.code)) return [];
      const b = shape.bounds;
      // Only states at least partly in frame.
      if (b.x + b.w < view.x || b.x > view.x + view.w || b.y + b.h < view.y || b.y > view.y + view.h) {
        return [];
      }
      const spot = labelSpot(shape, (labelWidthPx(shape.code, "") + 2) * unitsPerPx, 16 * unitsPerPx);
      if (!spot) return [];
      const [x, y] = spot;
      const inFrame =
        x > view.x + 10 * unitsPerPx &&
        x < view.x + view.w - 10 * unitsPerPx &&
        y > view.y + 10 * unitsPerPx &&
        y < view.y + view.h - 10 * unitsPerPx;
      return inFrame ? [{ code: shape.code, x, y }] : [];
    });
  }, [zoomed, unitsPerPx, ranked, view.x, view.y, view.w, view.h]);

  const select = (code: string) => onSelectState?.(code);

  const scope = rangeLabel ? rangeLabel : "All time";

  if (rows.length === 0) {
    return (
      <Card meta={scope}>
        <p className="text-sm py-10 text-center m-0" style={META}>
          No activity with a US state yet. States fill in here as events are recapped.
        </p>
      </Card>
    );
  }

  const controls = (
    <select
      aria-label="Metric shown on the map"
      value={metricKey}
      onChange={(e) => {
        setMetricKey(e.target.value as MetricKey);
        setShowAll(false);
      }}
      className="text-[13px] rounded-lg px-2.5 py-1.5 cursor-pointer"
      style={{
        background: inkRgba(0.04),
        border: "1px solid var(--spark-border)",
        color: "var(--spark-text)",
      }}
    >
      {METRICS.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );

  const meta = `${ranked.length} ${ranked.length === 1 ? "state" : "states"} · ${scope}`;
  const tipRow = tip ? byCode[tip.code] : undefined;
  const stroke = chartSurface();
  const hoverStroke = mode === "light" ? "#14160f" : "#f2f3ee";

  return (
    <Card meta={meta} controls={controls}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Map */}
        <div className="lg:col-span-3 min-w-0">
          <div ref={mapRef} className="relative" onMouseLeave={() => setTip(null)}>
            {ranked.length === 0 ? (
              <p className="text-sm py-10 text-center m-0" style={META}>
                No states with {metric.label.toLowerCase()} in this range.
              </p>
            ) : (
              <svg
                viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                role="img"
                aria-label={`US map shaded by ${metric.label.toLowerCase()}. ${ranked
                  .slice(0, 5)
                  .map((r) => `${stateName(r.state.toUpperCase())} ${fmt(r[metricKey])}`)
                  .join(", ")}.`}
                preserveAspectRatio="xMidYMid meet"
                style={{ width: "100%", height: "auto", maxHeight: 340, display: "block" }}
              >
                {SHAPES.map((s) => {
                  const active = (byCode[s.code]?.[metricKey] ?? 0) > 0;
                  return (
                    <path
                      key={s.code}
                      d={s.d}
                      fill={fillFor(s.code)}
                      // While one state is hovered, the others step back.
                      opacity={hover && hover !== s.code && active ? 0.55 : 1}
                      stroke={stroke}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: active && onSelectState ? "pointer" : "default" }}
                      onMouseEnter={(e) => {
                        setHover(active ? s.code : null);
                        if (!active) return setTip(null);
                        const box = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
                        if (!box) return;
                        const y = e.clientY - box.top;
                        setTip({ code: s.code, x: e.clientX - box.left, y, above: y > box.height / 2 });
                      }}
                      onMouseMove={(e) => {
                        if (!active) return;
                        const box = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
                        if (!box) return;
                        const y = e.clientY - box.top;
                        setTip({ code: s.code, x: e.clientX - box.left, y, above: y > box.height / 2 });
                      }}
                      onMouseLeave={() => {
                        setHover((h) => (h === s.code ? null : h));
                        setTip(null);
                      }}
                      onClick={() => active && select(s.code)}
                    />
                  );
                })}
                {/* Hovered state's outline on top, so its full edge shows. */}
                {hover && SHAPE_BY_CODE[hover] ? (
                  <path
                    d={SHAPE_BY_CODE[hover].d}
                    fill="none"
                    stroke={hoverStroke}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ) : null}
                {contextLabels.map((l) => (
                  <text
                    key={`ctx-${l.code}`}
                    x={l.x}
                    y={l.y}
                    dy={4 * unitsPerPx}
                    textAnchor="middle"
                    pointerEvents="none"
                    fill={inkRgba(0.55)}
                    fontSize={12 * unitsPerPx}
                    style={{ fontFamily: LABEL_FONT }}
                  >
                    {l.code}
                  </text>
                ))}
                {labels.map((l) => (
                  <text
                    key={l.code}
                    x={l.x}
                    y={l.y}
                    textAnchor="middle"
                    pointerEvents="none"
                    fill={l.ink}
                    stroke={l.halo}
                    strokeWidth={3 * unitsPerPx}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ fontFamily: LABEL_FONT }}
                  >
                    <tspan x={l.x} dy={-4 * unitsPerPx} fontSize={12 * unitsPerPx} fontWeight={500} opacity={0.85}>
                      {l.code}
                    </tspan>
                    <tspan x={l.x} dy={15 * unitsPerPx} fontSize={13 * unitsPerPx} fontWeight={700}>
                      {l.text}
                    </tspan>
                  </text>
                ))}
              </svg>
            )}
            {tip && tipRow ? (
              <Tooltip
                row={tipRow}
                metric={metric}
                total={total}
                x={tip.x}
                y={tip.y}
                flip={mapWidth > 0 && tip.x > mapWidth - 230}
                above={tip.above}
              />
            ) : null}
          </div>

          {/* Legend */}
          {ranked.length > 0 ? (
            <div className="flex items-center gap-x-5 gap-y-2 mt-4 flex-wrap text-xs" style={SECONDARY}>
              <span className="font-medium" style={TEXT}>
                {metric.label}
              </span>
              {ranked.length === 1 ? (
                <span className="flex items-center gap-2">
                  <Swatch color={fillFor(ranked[0].state.toUpperCase())} />
                  <span className="tab-num">{fmt(max)}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>Fewer</span>
                  <span className="tab-num" style={TEXT}>
                    {fmt(min)}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 112,
                      height: 10,
                      borderRadius: 3,
                      background: `linear-gradient(90deg, ${rampColor(rampPosition(min, max), mode)}, ${rampColor(1, mode)})`,
                    }}
                  />
                  <span className="tab-num" style={TEXT}>
                    {fmt(max)}
                  </span>
                  <span>More</span>
                </span>
              )}
              <span className="flex items-center gap-2">
                <Swatch color={NO_DATA_FILL[mode]} border />
                <span>No activity</span>
              </span>
              {focus ? (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs underline underline-offset-2 cursor-pointer ml-auto"
                  style={{ ...SECONDARY, background: "none", border: 0, padding: 0 }}
                >
                  {showAll ? "Zoom to active states" : "Show all states"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Ranked list */}
        <div className="lg:col-span-2 min-w-0">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[13px] font-medium m-0" style={SECONDARY}>
              By state
            </p>
            <p className="text-xs m-0" style={META}>
              Share of total
            </p>
          </div>
          {ranked.length === 0 ? (
            <p className="text-[13px] m-0" style={META}>
              No states with {metric.label.toLowerCase()} yet.
            </p>
          ) : (
            <>
              <ul className="m-0 p-0 list-none">
                {ranked.slice(0, LIST_ROWS).map((r) => {
                  const code = r.state.toUpperCase();
                  const value = r[metricKey];
                  const active = hover === code;
                  return (
                    <li key={code}>
                      <button
                        type="button"
                        onClick={() => select(code)}
                        onMouseEnter={() => setHover(code)}
                        onMouseLeave={() => setHover((h) => (h === code ? null : h))}
                        onFocus={() => setHover(code)}
                        onBlur={() => setHover((h) => (h === code ? null : h))}
                        title={onSelectState ? `Show ${stateName(code)} in the tracker` : undefined}
                        className="w-full text-left rounded-lg px-2 py-2 cursor-pointer"
                        style={{
                          background: active ? inkRgba(0.05) : "transparent",
                          border: 0,
                          borderBottom: "1px solid var(--spark-hairline)",
                        }}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-[13px] truncate" style={TEXT}>
                            {stateName(code)}
                            <span className="text-xs ml-1.5" style={META}>
                              {code}
                            </span>
                          </span>
                          <span className="flex items-baseline gap-2 shrink-0">
                            <span className="tab-num text-[13px] font-semibold" style={TEXT}>
                              {fmt(value)}
                            </span>
                            <span className="tab-num text-xs w-9 text-right" style={META}>
                              {shareLabel(value, total)}
                            </span>
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className="block mt-1.5"
                          style={{ height: 4, borderRadius: 2, background: inkRgba(0.06) }}
                        >
                          <span
                            className="block h-full"
                            style={{
                              width: `${Math.max(2, (value / max) * 100)}%`,
                              borderRadius: 2,
                              background: fillFor(code),
                            }}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {ranked.length > LIST_ROWS ? (
                <p className="text-xs m-0 mt-2" style={META}>
                  {ranked.length - LIST_ROWS} more{" "}
                  {ranked.length - LIST_ROWS === 1 ? "state adds" : "states add"}{" "}
                  {fmt(ranked.slice(LIST_ROWS).reduce((s, r) => s + r[metricKey], 0))}. Hover the map for
                  each one.
                </p>
              ) : null}
              <p className="text-xs m-0 mt-3 flex justify-between gap-3" style={META}>
                <span>Total across mapped states</span>
                <span className="tab-num font-semibold" style={TEXT}>
                  {fmt(total)}
                </span>
              </p>
            </>
          )}
          <p className="text-xs m-0 mt-3" style={META}>
            Placed by each event's state. Events without a US state are not on the map, so this
            total can be lower than the headline.
          </p>
        </div>
      </div>
    </Card>
  );
};

const Swatch: React.FC<{ color: string; border?: boolean }> = ({ color, border }) => (
  <span
    aria-hidden="true"
    style={{
      width: 14,
      height: 10,
      borderRadius: 3,
      background: color,
      boxShadow: border ? "inset 0 0 0 1px var(--spark-border)" : undefined,
    }}
  />
);

export default GeoHeatmapView;
