import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopoJson from "us-atlas/states-10m.json";
import type { PitchFootprintState } from "./pitchDeckTypes";

export const FOOTPRINT_MAP_W = 800;
export const FOOTPRINT_MAP_H = 490;

export const STATE_BY_CODE: Record<string, { fips: string; name: string }> = {
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

export type FootprintStateShape = {
  code: string;
  d: string;
  cx: number;
  cy: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATE_FEATURES: { id?: string | number }[] = (
  feature(statesTopoJson as any, (statesTopoJson as any).objects.states) as any
).features;
const projection = geoAlbersUsa().fitSize([FOOTPRINT_MAP_W, FOOTPRINT_MAP_H], {
  type: "FeatureCollection",
  features: STATE_FEATURES,
} as any);
const pathGen = geoPath(projection);
/* eslint-enable @typescript-eslint/no-explicit-any */

export const FOOTPRINT_SHAPES: FootprintStateShape[] = STATE_FEATURES.flatMap(
  (feat) => {
    const key =
      feat.id == null
        ? ""
        : typeof feat.id === "number"
          ? String(feat.id).padStart(2, "0")
          : feat.id;
    const code = CODE_BY_FIPS[key];
    const d = pathGen(feat as never);
    if (!code || !d) return [];
    const [cx, cy] = pathGen.centroid(feat as never);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return [];
    const [nx, ny] = LABEL_NUDGE[code] ?? [0, 0];
    return [{ code, d, cx: cx + nx, cy: cy + ny }];
  },
);

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return [43, 76, 8];
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return [43, 76, 8];
  return [r, g, b];
}

export function blendFootprintColor(ratio: number, accentHex: string): string {
  const [ar, ag, ab] = parseHexRgb(accentHex);
  const isNearBlack = ar + ag + ab < 90;
  const [tr, tg, tb] = isNearBlack ? [43, 76, 8] : [ar, ag, ab];
  const t = 0.25 + Math.max(0, Math.min(1, ratio)) * 0.72;
  const r = Math.round(244 * (1 - t) + tr * t);
  const g = Math.round(245 * (1 - t) + tg * t);
  const b = Math.round(239 * (1 - t) + tb * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Pure standalone SVG markup of the US choropleth activation footprint map.
 * Used by the `.pptx` exporter to rasterize a crisp high-DPI PNG directly onto
 * Slide 3 without requiring a mounted DOM element.
 */
export function buildFootprintSvgMarkup(
  states: readonly PitchFootprintState[],
  accentHex = "#2B4C08",
): string {
  const byCode = new Map(states.map((s) => [s.state.toUpperCase(), s]));
  const maxVal = Math.max(
    1,
    ...states.map((s) => Math.max(s.visits || 0, s.stores || 0)),
  );

  const paths = FOOTPRINT_SHAPES.map((shape) => {
    const row = byCode.get(shape.code);
    const fill = row
      ? blendFootprintColor((row.visits || row.stores || 1) / maxVal, accentHex)
      : "#EEF0E8";
    return `<path d="${shape.d}" fill="${fill}" stroke="#FFFFFF" stroke-width="1.25" />`;
  }).join("");

  const labels = FOOTPRINT_SHAPES.flatMap((shape) => {
    const row = byCode.get(shape.code);
    if (!row) return [];
    const ratio = (row.visits || row.stores || 1) / maxVal;
    const textFill = ratio > 0.55 ? "#FFFFFF" : "#14160F";
    const sub = `${row.stores}d`;
    return [
      `<text x="${shape.cx.toFixed(1)}" y="${(shape.cy - 2).toFixed(1)}" text-anchor="middle" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="11" font-weight="700" fill="${textFill}">${escapeXml(shape.code)}</text>`,
      `<text x="${shape.cx.toFixed(1)}" y="${(shape.cy + 10).toFixed(1)}" text-anchor="middle" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="9.5" font-weight="600" fill="${textFill}" opacity="0.88">${escapeXml(sub)}</text>`,
    ];
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FOOTPRINT_MAP_W} ${FOOTPRINT_MAP_H}" width="${FOOTPRINT_MAP_W}" height="${FOOTPRINT_MAP_H}"><rect width="${FOOTPRINT_MAP_W}" height="${FOOTPRINT_MAP_H}" fill="#FFFFFF" rx="12"/>${paths}${labels}</svg>`;
}
