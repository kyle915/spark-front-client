/**
 * Account Map pin identity + camera helpers.
 *
 * Bulk import (`_ensure_retailer_account`) can hang every banner row off
 * one Retailer uuid. Grouping by that uuid collapsed Binny's Illinois
 * stores into a single pin. Name + coordinates keeps one pin per store.
 */

export function isPlottableLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function venuePinKey(name: string, lat: number, lng: number): string {
  return `${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
}

export function boundsFromPins(
  positions: Array<{ lat: number; lng: number }>,
): { north: number; south: number; east: number; west: number } | null {
  const pts = positions.filter((p) => isPlottableLatLng(p.lat, p.lng));
  if (pts.length === 0) return null;
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
  return { north, south, east, west };
}
