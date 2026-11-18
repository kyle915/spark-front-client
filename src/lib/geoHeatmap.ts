/**
 * Colour and framing rules for the Geographic performance map.
 *
 * Colour: one blue, light to dark, so more activity always reads as a
 * stronger fill. The stops are the dataviz skill's blue ramp (the same
 * blue as Spark's first series colour), checked with `validate_palette.js
 * --ordinal`: monotone lightness, visible step gaps, single hue, and the
 * faintest stop clears 2:1 against the card in each appearance. Dark mode
 * runs the ramp the other way (more = lighter), so the strongest state is
 * always the one that stands out most from the card (light: steps 250–700,
 * dark: steps 600–300, each validated in its own appearance).
 *
 * States with no activity are a flat neutral grey, not the bottom of the
 * ramp, so "none" never looks like "a little".
 */

export type Mode = "light" | "dark";
type Rgb = [number, number, number];

// Fewest → most.
const RAMP: Record<Mode, string[]> = {
  light: ["#86b6ef", "#3987e5", "#256abf", "#184f95", "#0d366b"],
  // Stops at a saturated mid blue rather than running to near-white, so the
  // top state reads as "most", not as a pale blank.
  dark: ["#184f95", "#256abf", "#3987e5", "#6da7ec"],
};

/** Fill for a state with no activity: neutral, quieter than any data step. */
export const NO_DATA_FILL: Record<Mode, string> = {
  light: "#e9e9e3",
  dark: "#2a2a2e",
};

const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** The ramp colour at t ∈ [0, 1] (0 = fewest, 1 = most). */
export function rampColor(t: number, mode: Mode): string {
  const stops = RAMP[mode];
  const clamped = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
  const pos = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  return rgbToHex([0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f) as Rgb);
}

/**
 * Where a value sits on the ramp. Anchored at zero, so a state with half the
 * leader's total sits halfway up the ramp. A small floor keeps the smallest
 * real value visibly blue next to the grey "no activity" fill.
 */
export function rampPosition(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return 0.08 + 0.92 * Math.min(1, value / max);
}

const luminance = (hex: string): number => {
  const lin = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

const INK_DARK = "#14160f";
const INK_LIGHT = "#ffffff";

/** The text colour (ink or white) that reads best on a given fill. */
export function labelInk(fill: string): string {
  const l = luminance(fill);
  const onWhite = (1.05) / (l + 0.05);
  const onInk = (l + 0.05) / (luminance(INK_DARK) + 0.05);
  return onWhite >= onInk ? INK_LIGHT : INK_DARK;
}

export type Box = { x: number; y: number; w: number; h: number };

/**
 * The part of the map to show. When every active state fits in a small
 * corner of the US (two or three neighbours, say), frame those states with
 * some of their neighbours for context; otherwise show the whole country.
 * Returns null for "show the whole map".
 *
 * `active` is the union bounding box of the active states, in map units;
 * `map` is the full map's size.
 */
export function focusBox(
  active: Box | null,
  map: { w: number; h: number },
): Box | null {
  if (!active) return null;
  // Spread over more than about half the country: the whole map reads fine.
  if (active.w > map.w * 0.5 || active.h > map.h * 0.55) return null;

  const aspect = map.w / map.h;
  const cx = active.x + active.w / 2;
  const cy = active.y + active.h / 2;
  // Pad around the active states, and never zoom in so far that a single
  // state fills the frame: keep at least a third of the country's width.
  let w = Math.max(active.w * 1.6, map.w * 0.34);
  let h = Math.max(active.h * 1.6, w / aspect);
  w = Math.max(w, h * aspect);
  h = w / aspect;
  // Nothing gained when the frame is nearly the whole map.
  if (w >= map.w * 0.8) return null;

  // Keep the frame on the map where possible.
  const x = Math.min(Math.max(cx - w / 2, 0), map.w - w);
  const y = Math.min(Math.max(cy - h / 2, 0), map.h - h);
  return { x, y, w, h };
}

/** "62%" — share of the mapped total, whole percent ("<1%" for slivers). */
export function shareLabel(value: number, total: number): string {
  if (!(total > 0) || !(value > 0)) return "";
  const pct = (value / total) * 100;
  if (pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}
