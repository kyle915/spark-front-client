import { PIN_INK } from "@/shared/map/markerIcons";
import { STATUS_META, type EventStatus, type PinGlyph, type PinShape } from "./todayMap";

/**
 * The status mark as SVG text. One drawing for the map marker (an image),
 * the legend, the list rows and the cards.
 */
function shape(kind: PinShape, attrs: string): string {
  if (kind === "diamond") {
    return `<polygon points="14,3 25,14 14,25 3,14" stroke-linejoin="round" ${attrs}/>`;
  }
  if (kind === "square") {
    return `<rect x="5" y="5" width="18" height="18" rx="3" ${attrs}/>`;
  }
  return `<circle cx="14" cy="14" r="9.5" ${attrs}/>`;
}

function glyph(kind: PinGlyph, ink: string): string {
  switch (kind) {
    case "cross":
      return `<path d="M10.5 10.5l7 7M17.5 10.5l-7 7"/>`;
    case "bang":
      return `<path d="M14 8.5v6"/><circle cx="14" cy="18.6" r="1.2" fill="${ink}" stroke="none"/>`;
    case "play":
      return `<path d="M11.8 9.8l6.4 4.2-6.4 4.2z" fill="${ink}" stroke="none"/>`;
    case "check":
      return `<path d="M9.6 14.4l3 3 5.8-6.6"/>`;
    case "dash":
      return `<path d="M10 14h8"/>`;
    case "dot":
      return `<circle cx="14" cy="14" r="2.6" fill="${ink}" stroke="none"/>`;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function statusPinSvg(status: EventStatus, size = 28): string {
  const meta = STATUS_META[status];
  const ring = meta.shape === "ring";
  // Amber and the hollow ring are light fills; everything else takes white.
  const ink = ring || status === "late" ? PIN_INK : "#ffffff";
  const body = ring
    ? shape(meta.shape, `fill="none" stroke="#ffffff" stroke-width="5"`) +
      shape(meta.shape, `fill="#ffffff" stroke="${PIN_INK}" stroke-width="2.5"`)
    : shape(meta.shape, `fill="none" stroke="rgba(20,22,15,0.7)" stroke-width="4.5"`) +
      shape(meta.shape, `fill="${meta.color}" stroke="#ffffff" stroke-width="2"`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28" aria-hidden="true" focusable="false" style="display:block">` +
    body +
    `<g stroke="${ink}" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
    glyph(meta.glyph, ink) +
    `</g></svg>`
  );
}
