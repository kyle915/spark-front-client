import type { CoverageClass } from "./accountCoverage";

/**
 * Pin artwork as SVG text. Maps that use the shared map style draw pins as
 * image markers, and the same text is used inline in lists and legends, so a
 * mark looks the same everywhere it appears.
 *
 * Colours are fixed, not theme tokens: they sit on map tiles, and every mark
 * carries its own white edge and dark keyline so it reads on the light and
 * the dark map alike.
 */
export const PIN_INK = "#14160f";
const KEYLINE = "rgba(20,22,15,0.7)";

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function svg(size: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28" aria-hidden="true" focusable="false">${body}</svg>`;
}

/**
 * Coverage differs in shape as well as colour, so it reads without colour:
 *  - never visited: a hollow ring (nothing there yet), in the attention hue
 *  - sampled (1 visit): a solid disc
 *  - repeat (2+ visits): a solid disc with a second ring inside
 */
export const COVERAGE_MARK: Record<
  CoverageClass,
  { label: string; color: string }
> = {
  never_visited: { label: "Never visited", color: "#c8501a" },
  sampled: { label: "Sampled, 1 visit", color: "#00795c" },
  repeat: { label: "Repeat, 2+ visits", color: "#1f5fa8" },
};

export function coveragePinSvg(cls: CoverageClass, size = 22): string {
  const { color } = COVERAGE_MARK[cls];
  if (cls === "never_visited") {
    return svg(
      size,
      `<circle cx="14" cy="14" r="9.5" fill="none" stroke="${KEYLINE}" stroke-width="6.5"/>` +
        `<circle cx="14" cy="14" r="9.5" fill="#ffffff" stroke="${color}" stroke-width="4"/>`,
    );
  }
  const inner =
    cls === "repeat"
      ? `<circle cx="14" cy="14" r="4.6" fill="none" stroke="#ffffff" stroke-width="2"/>`
      : "";
  return svg(
    size,
    `<circle cx="14" cy="14" r="10" fill="none" stroke="${KEYLINE}" stroke-width="4.5"/>` +
      `<circle cx="14" cy="14" r="10" fill="${color}" stroke="#ffffff" stroke-width="2"/>` +
      inner,
  );
}

/** A group of pins too close to tell apart at this zoom. The count is drawn
 *  by the map as the marker's label, so it uses the app's own typeface. */
export function clusterSvg(size: number): string {
  return svg(
    size,
    `<circle cx="14" cy="14" r="11.5" fill="${PIN_INK}" stroke="#ffffff" stroke-width="2"/>`,
  );
}

/** Bigger discs for bigger groups, in three steps. */
export function clusterSize(count: number): number {
  if (count >= 100) return 44;
  if (count >= 10) return 38;
  return 32;
}

/** A person's phone on the Today map. */
export function phoneDotSvg(size = 14): string {
  return svg(
    size,
    `<circle cx="14" cy="14" r="11" fill="none" stroke="${KEYLINE}" stroke-width="3"/>` +
      `<circle cx="14" cy="14" r="10" fill="#1f7fc0" stroke="#ffffff" stroke-width="4"/>`,
  );
}
