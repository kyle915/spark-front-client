import { describe, expect, it } from "vitest";
import {
  DARK_CANVAS_FALLBACK,
  LIGHT_CANVAS_FALLBACK,
  compositeOver,
  contrastRatio,
  evaluateElementContrast,
  formatRgbHex,
  isForbiddenNeonLimeOnLight,
  parseCssColor,
  relativeLuminance,
  requiredContrastRatio,
  resolveEffectiveBackground,
} from "./wcagContrast";

describe("parseCssColor", () => {
  it("parses hex, rgb/rgba, hsl, color(srgb), oklab, and oklch", () => {
    expect(parseCssColor("#0A0B0D")).toEqual({ r: 10, g: 11, b: 13, a: 1 });
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssColor("rgba(20, 22, 15, 0.78)")).toEqual({
      r: 20,
      g: 22,
      b: 15,
      a: 0.78,
    });
    expect(parseCssColor("rgb(20 22 15 / 50%)")).toEqual({
      r: 20,
      g: 22,
      b: 15,
      a: 0.5,
    });
    expect(parseCssColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });

    const srgb = parseCssColor("color(srgb 1 0.5 0 / 0.8)");
    expect(srgb).not.toBeNull();
    expect(Math.round(srgb!.r)).toBe(255);
    expect(Math.round(srgb!.g)).toBe(128);
    expect(Math.round(srgb!.b)).toBe(0);
    expect(srgb!.a).toBeCloseTo(0.8, 3);

    const whiteOklch = parseCssColor("oklch(1 0 0)");
    expect(whiteOklch).not.toBeNull();
    expect(Math.round(whiteOklch!.r)).toBe(255);
    expect(Math.round(whiteOklch!.g)).toBe(255);
    expect(Math.round(whiteOklch!.b)).toBe(255);

    const darkOklch = parseCssColor("oklch(0.14 0 0)");
    expect(darkOklch).not.toBeNull();
    expect(darkOklch!.r).toBeLessThan(20);
    expect(darkOklch!.g).toBeLessThan(20);
    expect(darkOklch!.b).toBeLessThan(20);
  });
});

describe("WCAG 2.1 luminance & contrast math", () => {
  it("computes canonical WCAG reference ratios", () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(relativeLuminance(black)).toBeCloseTo(0, 6);
    expect(relativeLuminance(white)).toBeCloseTo(1, 6);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 2);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 2);

    // #767676 on white is the canonical WCAG AA 4.54:1 boundary
    const passGray = parseCssColor("#767676")!;
    const failGray = parseCssColor("#777777")!;
    expect(contrastRatio(passGray, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(failGray, white)).toBeLessThan(4.5);
  });

  it("composites translucent layers over ancestor backgrounds accurately", () => {
    const resolved = resolveEffectiveBackground(
      ["rgba(63, 92, 18, 0.11)", "#ffffff", "#f6f6f2"],
      LIGHT_CANVAS_FALLBACK,
    );
    // Alpha-composite rounding can land on either adjacent hex; both stay
    // within the pale lime-tint band used by light-mode chip surfaces.
    expect(formatRgbHex(resolved)).toMatch(/^#eae[cd]e[45]$/);

    const forest = parseCssColor("#2b4c08")!;
    expect(contrastRatio(forest, resolved)).toBeGreaterThan(7.5);
  });

  it("applies layer opacity when compositing", () => {
    const blended = compositeOver(
      { r: 0, g: 0, b: 0, a: 0.5 },
      { r: 255, g: 255, b: 255, a: 1 },
    );
    expect(Math.round(blended.r)).toBe(128);
    expect(blended.a).toBe(1);
  });

  it("enforces 4.5:1 for normal text and 3.0:1 for large/bold labels", () => {
    expect(requiredContrastRatio(12, 600)).toBe(4.5);
    expect(requiredContrastRatio(14, 700)).toBe(4.5);
    expect(requiredContrastRatio(18.66, 700)).toBe(3.0);
    expect(requiredContrastRatio(18.66, 400)).toBe(4.5);
    expect(requiredContrastRatio(24, 400)).toBe(3.0);
  });
});

describe("light-surface neon-lime guardrail", () => {
  it("flags neon-green and lime foregrounds on light and pale-tinted surfaces", () => {
    const lightWhite = parseCssColor("#ffffff")!;
    const paleCream = parseCssColor("#f6f6f2")!;
    const paleLimeTint = resolveEffectiveBackground(
      ["rgba(197, 245, 70, 0.15)", "#ffffff"],
      LIGHT_CANVAS_FALLBACK,
    );

    for (const badColor of [
      "#c5f546",
      "#b8ff29",
      "#a3e635",
      "#84cc16",
      "#c2df4d",
      "#4ade80",
    ]) {
      const fg = parseCssColor(badColor)!;
      expect(isForbiddenNeonLimeOnLight(fg, lightWhite), badColor).toBe(true);
      expect(isForbiddenNeonLimeOnLight(fg, paleCream), badColor).toBe(true);
      expect(isForbiddenNeonLimeOnLight(fg, paleLimeTint), badColor).toBe(true);

      const evalRes = evaluateElementContrast({
        foreground: badColor,
        backgroundLayers: ["rgba(197, 245, 70, 0.15)", "#ffffff"],
        fallbackBackground: LIGHT_CANVAS_FALLBACK,
        fontSizePx: 12,
        fontWeight: 600,
      });
      expect(evalRes.passes, badColor).toBe(false);
      expect(evalRes.forbiddenNeonLime, badColor).toBe(true);
    }
  });

  it("allows Spark dark-mode neon lime on dark ops surfaces", () => {
    const res = evaluateElementContrast({
      foreground: "#c5f546",
      backgroundLayers: ["rgba(197, 245, 70, 0.15)", "#141416", "#0a0b0d"],
      fallbackBackground: DARK_CANVAS_FALLBACK,
      fontSizePx: 12,
      fontWeight: 600,
    });
    expect(res.forbiddenNeonLime).toBe(false);
    expect(res.passes).toBe(true);
    // Neon lime on dark ops is well above AA (typically ~9.9–11:1 depending
    // on the translucent lime wash compositing path).
    expect(res.ratio).toBeGreaterThan(9.5);
  });

  it("allows light-mode deep forest/emerald tokens on pale-tinted badges", () => {
    for (const goodForest of ["#2b4c08", "#1f4708", "#3f5c12", "#166534"]) {
      const res = evaluateElementContrast({
        foreground: goodForest,
        backgroundLayers: ["rgba(63, 92, 18, 0.11)", "#ffffff"],
        fallbackBackground: LIGHT_CANVAS_FALLBACK,
        fontSizePx: 12,
        fontWeight: 600,
      });
      expect(res.forbiddenNeonLime, goodForest).toBe(false);
      expect(res.passes, goodForest).toBe(true);
      expect(res.ratio, goodForest).toBeGreaterThan(6);
    }
  });

  it("exempts disabled controls from ratio check while still flagging neon-lime on light", () => {
    const disabledMuted = evaluateElementContrast({
      foreground: "rgba(20, 22, 15, 0.4)",
      backgroundLayers: ["#ffffff"],
      fallbackBackground: LIGHT_CANVAS_FALLBACK,
      fontSizePx: 12,
      fontWeight: 600,
      isDisabled: true,
    });
    expect(disabledMuted.passes).toBe(true);

    const disabledNeon = evaluateElementContrast({
      foreground: "#c5f546",
      backgroundLayers: ["#ffffff"],
      fallbackBackground: LIGHT_CANVAS_FALLBACK,
      fontSizePx: 12,
      fontWeight: 600,
      isDisabled: true,
    });
    expect(disabledNeon.passes).toBe(false);
    expect(disabledNeon.forbiddenNeonLime).toBe(true);
  });
});
