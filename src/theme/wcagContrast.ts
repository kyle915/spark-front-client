/**
 * Pure WCAG 2.1 relative-luminance, alpha-compositing, contrast-ratio, and
 * light-surface neon-lime guardrail helpers.
 *
 * Shared between Vitest unit tests and Playwright E2E visual guardrails.
 * Zero Relay or DOM runtime dependencies so unit tests run cleanly before
 * `relay-compiler` runs in CI.
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface RgbaColor extends RgbColor {
  a: number;
}

export interface BackgroundLayer {
  color: string | RgbaColor | null | undefined;
  /** Element opacity (0..1) applied to this layer when compositing. */
  opacity?: number;
}

export interface ElementContrastSample {
  /** Foreground CSS color string or parsed RGBA color. */
  foreground: string | RgbaColor;
  /**
   * Background layers from innermost (the element itself) to outermost (html).
   * Semi-transparent layers are alpha-composited down onto `fallbackBackground`.
   */
  backgroundLayers: readonly (string | RgbaColor | BackgroundLayer | null | undefined)[];
  /** Opaque canvas fallback behind the root element (e.g. `#ffffff` or `#0a0b0d`). */
  fallbackBackground?: string | RgbaColor;
  /** Computed font-size in CSS px. */
  fontSizePx: number;
  /** Computed numeric font-weight (e.g. 400, 600, 700). */
  fontWeight: number;
  /** Cumulative element opacity affecting the foreground text (0..1). */
  effectiveOpacity?: number;
  /**
   * WCAG 2.1 SC 1.4.3 exempts inactive/disabled UI controls from the minimum
   * contrast ratio, though forbidden neon-lime text on light surfaces is still
   * flagged regardless of disabled state.
   */
  isDisabled?: boolean;
}

export interface ElementContrastEvaluation {
  passes: boolean;
  ratio: number;
  required: number;
  forbiddenNeonLime: boolean;
  effectiveFg: RgbaColor;
  effectiveBg: RgbaColor;
  effectiveFgHex: string;
  effectiveBgHex: string;
  reasons: string[];
}

export const LIGHT_CANVAS_FALLBACK: RgbaColor = { r: 246, g: 246, b: 242, a: 1 };
export const DARK_CANVAS_FALLBACK: RgbaColor = { r: 10, g: 11, b: 13, a: 1 };

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp255(value: number): number {
  return clamp(value, 0, 255);
}

function parseAlphaToken(raw: string | undefined): number {
  if (!raw) return 1;
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    return clamp01(Number.parseFloat(trimmed.slice(0, -1)) / 100);
  }
  return clamp01(Number.parseFloat(trimmed));
}

function parseRgbChannel(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    const pct = Number.parseFloat(trimmed.slice(0, -1));
    if (Number.isNaN(pct)) return null;
    return clamp255((pct / 100) * 255);
  }
  const num = Number.parseFloat(trimmed);
  if (Number.isNaN(num)) return null;
  return clamp255(num);
}

function parseAngleDegrees(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "none") return 0;
  let deg: number;
  if (trimmed.endsWith("deg")) {
    deg = Number.parseFloat(trimmed.slice(0, -3));
  } else if (trimmed.endsWith("rad")) {
    deg = (Number.parseFloat(trimmed.slice(0, -3)) * 180) / Math.PI;
  } else if (trimmed.endsWith("grad")) {
    deg = Number.parseFloat(trimmed.slice(0, -4)) * 0.9;
  } else if (trimmed.endsWith("turn")) {
    deg = Number.parseFloat(trimmed.slice(0, -4)) * 360;
  } else {
    deg = Number.parseFloat(trimmed);
  }
  if (Number.isNaN(deg)) return null;
  return ((deg % 360) + 360) % 360;
}

function parsePercentOrUnit(raw: string, unitScale = 1): number | null {
  const trimmed = raw.trim();
  if (trimmed === "none") return 0;
  if (trimmed.endsWith("%")) {
    const pct = Number.parseFloat(trimmed.slice(0, -1));
    if (Number.isNaN(pct)) return null;
    return (pct / 100) * unitScale;
  }
  const num = Number.parseFloat(trimmed);
  return Number.isNaN(num) ? null : num;
}

function linearToSrgbByte(linear: number): number {
  const clamped = clamp01(linear);
  const srgb =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return clamp255(srgb * 255);
}

/**
 * Convert OKLab (L in 0..1, a/b typically -0.4..0.4) to sRGB [0..255].
 * Uses the standard Björn Ottosson / CSS Color 4 matrices.
 */
function oklabToSrgb(L: number, a: number, b: number): RgbColor {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const linR = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: linearToSrgbByte(linR),
    g: linearToSrgbByte(linG),
    b: linearToSrgbByte(linB),
  };
}

function hslToRgb(hDeg: number, s: number, l: number): RgbColor {
  const h = ((hDeg % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: clamp255((r1 + m) * 255),
    g: clamp255((g1 + m) * 255),
    b: clamp255((b1 + m) * 255),
  };
}

/**
 * Parse a CSS color string (`#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()`,
 * `oklch()`, `oklab()`, `color(srgb ...)`, `transparent`) into an RGBA object.
 */
export function parseCssColor(raw: string | null | undefined): RgbaColor | null {
  if (!raw) return null;
  const input = raw.trim().toLowerCase();
  if (!input || input === "none" || input === "inherit" || input === "initial") {
    return null;
  }
  if (input === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (input === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (input === "black") return { r: 0, g: 0, b: 0, a: 1 };

  // #rgb, #rgba, #rrggbb, #rrggbbaa
  if (input.startsWith("#")) {
    const hex = input.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      const a =
        hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1;
      if ([r, g, b, a].some(Number.isNaN)) return null;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      const a =
        hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b, a].some(Number.isNaN)) return null;
      return { r, g, b, a };
    }
    return null;
  }

  // rgb(...) / rgba(...)
  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(input);
  if (rgbMatch) {
    const body = rgbMatch[1].trim();
    const [channelsPart, alphaPart] = body.split("/");
    const parts = channelsPart
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseRgbChannel(parts[0]);
    const g = parseRgbChannel(parts[1]);
    const b = parseRgbChannel(parts[2]);
    if (r === null || g === null || b === null) return null;
    const a = parseAlphaToken(alphaPart ?? parts[3]);
    return { r, g, b, a };
  }

  // hsl(...) / hsla(...)
  const hslMatch = /^hsla?\(([^)]+)\)$/.exec(input);
  if (hslMatch) {
    const body = hslMatch[1].trim();
    const [channelsPart, alphaPart] = body.split("/");
    const parts = channelsPart
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    if (parts.length < 3) return null;
    const h = parseAngleDegrees(parts[0]);
    const s = parsePercentOrUnit(parts[1], 1);
    const l = parsePercentOrUnit(parts[2], 1);
    if (h === null || s === null || l === null) return null;
    const rgb = hslToRgb(h, clamp01(s), clamp01(l));
    const a = parseAlphaToken(alphaPart ?? parts[3]);
    return { ...rgb, a };
  }

  // color(srgb r g b [/ a]) or color(srgb-linear r g b [/ a])
  const colorFnMatch = /^color\(\s*(srgb|srgb-linear)\s+([^)]+)\)$/.exec(input);
  if (colorFnMatch) {
    const space = colorFnMatch[1];
    const [channelsPart, alphaPart] = colorFnMatch[2].split("/");
    const parts = channelsPart.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const c0 = parsePercentOrUnit(parts[0], 1);
    const c1 = parsePercentOrUnit(parts[1], 1);
    const c2 = parsePercentOrUnit(parts[2], 1);
    if (c0 === null || c1 === null || c2 === null) return null;
    const a = parseAlphaToken(alphaPart);
    if (space === "srgb-linear") {
      return {
        r: linearToSrgbByte(c0),
        g: linearToSrgbByte(c1),
        b: linearToSrgbByte(c2),
        a,
      };
    }
    return {
      r: clamp255(c0 * 255),
      g: clamp255(c1 * 255),
      b: clamp255(c2 * 255),
      a,
    };
  }

  // oklab(L a b [/ alpha])
  const oklabMatch = /^oklab\(([^)]+)\)$/.exec(input);
  if (oklabMatch) {
    const [channelsPart, alphaPart] = oklabMatch[1].split("/");
    const parts = channelsPart.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const L = parsePercentOrUnit(parts[0], 1);
    const aChan = parsePercentOrUnit(parts[1], 0.4);
    const bChan = parsePercentOrUnit(parts[2], 0.4);
    if (L === null || aChan === null || bChan === null) return null;
    const rgb = oklabToSrgb(clamp01(L), aChan, bChan);
    return { ...rgb, a: parseAlphaToken(alphaPart) };
  }

  // oklch(L C H [/ alpha])
  const oklchMatch = /^oklch\(([^)]+)\)$/.exec(input);
  if (oklchMatch) {
    const [channelsPart, alphaPart] = oklchMatch[1].split("/");
    const parts = channelsPart.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const L = parsePercentOrUnit(parts[0], 1);
    const C = parsePercentOrUnit(parts[1], 0.4);
    const H = parseAngleDegrees(parts[2]);
    if (L === null || C === null || H === null) return null;
    const rad = (H * Math.PI) / 180;
    const rgb = oklabToSrgb(clamp01(L), C * Math.cos(rad), C * Math.sin(rad));
    return { ...rgb, a: parseAlphaToken(alphaPart) };
  }

  return null;
}

export function normalizeColor(
  value: string | RgbaColor | null | undefined,
): RgbaColor | null {
  if (!value) return null;
  if (typeof value === "string") return parseCssColor(value);
  return {
    r: clamp255(value.r),
    g: clamp255(value.g),
    b: clamp255(value.b),
    a: clamp01(value.a),
  };
}

/** Format an RGB/RGBA color as `#rrggbb` for crisp failure diagnostics. */
export function formatRgbHex(color: RgbColor): string {
  const toHex = (n: number) =>
    Math.round(clamp255(n)).toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Porter-Duff source-over alpha compositing of `fg` over `bg`.
 */
export function compositeOver(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const fgA = clamp01(fg.a);
  const bgA = clamp01(bg.a);
  const outA = fgA + bgA * (1 - fgA);
  if (outA <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  return {
    r: (fg.r * fgA + bg.r * bgA * (1 - fgA)) / outA,
    g: (fg.g * fgA + bg.g * bgA * (1 - fgA)) / outA,
    b: (fg.b * fgA + bg.b * bgA * (1 - fgA)) / outA,
    a: outA,
  };
}

function isLayerObject(
  item: string | RgbaColor | BackgroundLayer | null | undefined,
): item is BackgroundLayer {
  return (
    typeof item === "object" &&
    item !== null &&
    "color" in item
  );
}

/**
 * Resolve the effective opaque background color by compositing background
 * layers from outermost (root/ancestor) down to innermost (element itself)
 * onto an opaque canvas fallback.
 */
export function resolveEffectiveBackground(
  layersInnermostFirst: readonly (
    | string
    | RgbaColor
    | BackgroundLayer
    | null
    | undefined
  )[],
  fallbackBase: string | RgbaColor = LIGHT_CANVAS_FALLBACK,
): RgbaColor {
  const base = normalizeColor(fallbackBase) ?? LIGHT_CANVAS_FALLBACK;
  let acc: RgbaColor = { ...base, a: 1 };

  for (let i = layersInnermostFirst.length - 1; i >= 0; i -= 1) {
    const entry = layersInnermostFirst[i];
    if (!entry) continue;

    let color: RgbaColor | null;
    let opacity = 1;
    if (isLayerObject(entry)) {
      color = normalizeColor(entry.color);
      opacity = entry.opacity != null ? clamp01(entry.opacity) : 1;
    } else {
      color = normalizeColor(entry);
    }

    if (!color || color.a <= 0 || opacity <= 0) continue;
    acc = compositeOver({ ...color, a: color.a * opacity }, acc);
  }

  return { r: acc.r, g: acc.g, b: acc.b, a: 1 };
}

/**
 * WCAG 2.1 relative luminance (0 = pure black, 1 = pure white).
 */
export function relativeLuminance(color: RgbColor): number {
  const linearize = (channel: number) => {
    const s = clamp255(channel) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linearize(color.r) +
    0.7152 * linearize(color.g) +
    0.0722 * linearize(color.b)
  );
}

/**
 * WCAG 2.1 contrast ratio (1..21). Semi-transparent foregrounds are alpha-blended
 * over the opaque background before measuring luminance.
 */
export function contrastRatio(fg: RgbaColor, bg: RgbaColor): number {
  const opaqueBg =
    bg.a < 1 ? compositeOver(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;
  const effectiveFg = fg.a < 1 ? compositeOver(fg, opaqueBg) : fg;
  const lFg = relativeLuminance(effectiveFg);
  const lBg = relativeLuminance(opaqueBg);
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 AA minimum contrast threshold:
 * - 3.0:1 for large text (`>= 24px` normal, or `>= 18.66px` / 14pt bold `>= 700`)
 * - 4.5:1 for normal text
 */
export function requiredContrastRatio(
  fontSizePx: number,
  fontWeight: number,
): number {
  const isLarge =
    fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  return isLarge ? 3.0 : 4.5;
}

export function rgbToHsl(color: RgbColor): { h: number; s: number; l: number } {
  const r = clamp255(color.r) / 255;
  const g = clamp255(color.g) / 255;
  const b = clamp255(color.b) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) {
    return { h: 0, s: 0, l };
  }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  } else if (max === g) {
    h = ((b - r) / d + 2) * 60;
  } else {
    h = ((r - g) / d + 4) * 60;
  }
  return { h: ((h % 360) + 360) % 360, s, l };
}

/**
 * Explicitly guard against unreadable neon-green / lime foreground text on
 * light or pale-tinted surfaces (e.g. `#c5f546`, `#a3e635`, `#84cc16`,
 * `#c2df4d`, `#4ade80` on white or cream cards).
 *
 * Deep forest/emerald tones (e.g. `#2b4c08`, `#1f4708`, `#3f5c12`, `#166534`)
 * remain allowed on light surfaces because their lightness and relative
 * luminance are low and contrast is high.
 *
 * Neon lime on dark ops surfaces (`#0a0b0d`, `#141416`) remains allowed
 * because the background is dark (`relativeLuminance(bg) < 0.50`).
 */
export function isForbiddenNeonLimeOnLight(
  fg: RgbaColor,
  bg: RgbaColor,
): boolean {
  const opaqueBg =
    bg.a < 1 ? compositeOver(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;
  const bgLum = relativeLuminance(opaqueBg);
  if (bgLum < 0.5) return false;

  const effectiveFg = fg.a < 1 ? compositeOver(fg, opaqueBg) : fg;
  const { h, s, l } = rgbToHsl(effectiveFg);
  const fgLum = relativeLuminance(effectiveFg);

  const inLimeGreenHueBand = h >= 58 && h <= 152;
  const isChromatic = s >= 0.45;
  const isBrightForeground = l >= 0.4 || fgLum >= 0.28;

  return inLimeGreenHueBand && isChromatic && isBrightForeground;
}

/**
 * Evaluate a single rendered UI element against WCAG 2.1 AA contrast and the
 * light-surface neon-lime guardrail.
 */
export function evaluateElementContrast(
  sample: ElementContrastSample,
): ElementContrastEvaluation {
  const effectiveBg = resolveEffectiveBackground(
    sample.backgroundLayers,
    sample.fallbackBackground ?? LIGHT_CANVAS_FALLBACK,
  );
  const parsedFg = normalizeColor(sample.foreground) ?? {
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  };
  const opacityScale =
    sample.effectiveOpacity != null ? clamp01(sample.effectiveOpacity) : 1;
  const scaledFg: RgbaColor = {
    ...parsedFg,
    a: parsedFg.a * opacityScale,
  };
  const effectiveFg = compositeOver(scaledFg, effectiveBg);

  const ratio = contrastRatio(effectiveFg, effectiveBg);
  const required = requiredContrastRatio(sample.fontSizePx, sample.fontWeight);
  const forbiddenNeonLime = isForbiddenNeonLimeOnLight(
    effectiveFg,
    effectiveBg,
  );

  const reasons: string[] = [];
  if (forbiddenNeonLime) {
    reasons.push(
      `Forbidden neon-green/lime foreground ${formatRgbHex(effectiveFg)} on light surface ${formatRgbHex(effectiveBg)}`,
    );
  }
  if (!sample.isDisabled && ratio + 1e-6 < required) {
    reasons.push(
      `Contrast ${ratio.toFixed(2)}:1 below WCAG AA ${required.toFixed(1)}:1 (${formatRgbHex(effectiveFg)} on ${formatRgbHex(effectiveBg)}, ${sample.fontSizePx}px w${sample.fontWeight})`,
    );
  }

  return {
    passes: reasons.length === 0,
    ratio,
    required,
    forbiddenNeonLime,
    effectiveFg,
    effectiveBg,
    effectiveFgHex: formatRgbHex(effectiveFg),
    effectiveBgHex: formatRgbHex(effectiveBg),
    reasons,
  };
}
