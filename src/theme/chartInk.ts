import { readAppearance } from "./appearance";

/**
 * Colours for places CSS variables cannot reach: canvas (Chart.js), SVG
 * presentation attributes and map layers. Resolved from the saved
 * appearance, so they are right at module load; switching appearance
 * reloads the page, which re-evaluates them.
 */
const light = () => readAppearance() === "light";

/** Translucent foreground "ink": white in dark mode, near-black in light. */
export const inkRgba = (alpha: number): string =>
  `rgba(${light() ? "20,22,15" : "255,255,255"},${alpha})`;

/** The quiet accent: off-white in dark mode, ink in light. */
export const accentRgba = (alpha: number): string =>
  `rgba(${light() ? "20,22,15" : "242,243,238"},${alpha})`;

export const accentHex = (): string => (light() ? "#14160f" : "#f2f3ee");

/** Text that sits on the accent colour. */
export const onAccentHex = (): string => (light() ? "#ffffff" : "#0a0d09");

/** The card surface, for strokes that separate shapes drawn on a card. */
export const surfaceHex = (): string => (light() ? "#ffffff" : "#0a0d09");
