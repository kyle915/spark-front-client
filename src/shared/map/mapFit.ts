/**
 * Where a map's camera should sit to show a set of points. Shared by the
 * Today map and the Account Map; free of React and of the Maps library.
 */
export type LatLng = { lat: number; lng: number };

/** One pin, or several within a few metres of each other. */
export const SINGLE_PIN_ZOOM = 12;
export const US_DEFAULT = { center: { lat: 39.5, lng: -98.35 }, zoom: 4 } as const;

export function isPlottable(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export type FitTarget =
  | { kind: "none" }
  | { kind: "single"; center: LatLng; zoom: number }
  | { kind: "bounds"; north: number; south: number; east: number; west: number };

/** Roughly 150 m: pins this close are one place as far as zoom goes. */
const SAME_PLACE_DEG = 0.0015;

/** Where the camera should sit to show every point. */
export function fitTarget(points: ReadonlyArray<LatLng>): FitTarget {
  const pts = points.filter((p) => isPlottable(p.lat, p.lng));
  if (pts.length === 0) return { kind: "none" };
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const p of pts) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  if (north - south < SAME_PLACE_DEG && east - west < SAME_PLACE_DEG) {
    return {
      kind: "single",
      center: { lat: (north + south) / 2, lng: (east + west) / 2 },
      zoom: SINGLE_PIN_ZOOM,
    };
  }
  return { kind: "bounds", north, south, east, west };
}

/** Space around the pins when the camera fits them. */
export const FIT_PADDING = { top: 56, right: 56, bottom: 56, left: 56 };

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A Google Maps link that opens directions to a point. */
export function directionsUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}
