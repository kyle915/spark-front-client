import { isFeelFreeWalkupBrand, type WalkupBrand } from "./samplingStops";

/**
 * Feel Free payable mileage (storage → sampling stops).
 *
 * YES → Storage → stop1 → stop2 → … (driving miles)
 * NO  → stop1 → stop2 → … only (storage excluded)
 *
 * Computed miles are written into the recap "Mileage" custom field on submit.
 */

export type PayableMileageStop = {
  name: string;
  address: string;
  placeId?: string;
  lat: number;
  lng: number;
};

export type PayableMileageClaim = {
  uuid: string;
  startedFromStorage: boolean;
  storageMarket: string;
  storageAddress: string;
  stops: PayableMileageStop[];
  payableMiles: number;
  routeSource?: string;
  shiftLabel?: string;
  completed: boolean;
};

export type StorageUnit = {
  market: string;
  address: string;
  lat?: number;
  lng?: number;
};

export type PayableMileageState = {
  enabled: boolean;
  required?: boolean;
  storageUnits: StorageUnit[];
  matchedStorage: StorageUnit | null;
  marketHint?: string;
  claim: PayableMileageClaim | null;
};

export function isMileageCustomFieldName(name: string | null | undefined): boolean {
  const n = (name || "").trim();
  if (!n) return false;
  // "Mileage", "Insert your mileage", "Miles driven", …
  if (/mileage/i.test(n)) return true;
  return /^\s*miles?\s*(driven|traveled|travelled|reimbursed)?\s*$/i.test(n);
}

/** Gate: Feel Free + server enabled payableMileage (storage units seeded). */
export function shouldCollectPayableMileage(opts: {
  brand: WalkupBrand;
  payableMileage?: PayableMileageState | null;
}): boolean {
  if (!opts.payableMileage?.enabled) return false;
  // Prefer brand check so we never surface this on Torch etc. even if mis-seeded.
  if (!isFeelFreeWalkupBrand(opts.brand) && !(opts.payableMileage.storageUnits?.length > 0)) {
    return false;
  }
  return true;
}

/** True when a completed claim exists for this filing.

``forceNew`` always needs a fresh itinerary. Otherwise match ``shiftLabel``
via ``claimForShiftLabel`` so Edit doesn't treat morning miles as done for
Second / Third shift.
*/
export function payableMileageComplete(
  state: PayableMileageState | null | undefined,
  opts?: { forceNew?: boolean; shiftLabel?: string | null },
): boolean {
  if (opts?.forceNew) return false;
  const claim = claimForShiftLabel(state?.claim, opts?.shiftLabel);
  return Boolean(claim?.completed);
}

const EARTH_MI = 3958.7613;

function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Offline provisional total — same waypoints as the server, straight-line. */
export function estimatePayableMilesHaversine(opts: {
  startedFromStorage: boolean;
  storage: StorageUnit | null | undefined;
  stops: PayableMileageStop[];
}): number {
  const points: { lat: number; lng: number }[] = [];
  if (
    opts.startedFromStorage &&
    opts.storage &&
    Number.isFinite(opts.storage.lat) &&
    Number.isFinite(opts.storage.lng)
  ) {
    points.push({ lat: opts.storage.lat as number, lng: opts.storage.lng as number });
  }
  for (const s of opts.stops) {
    if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
      points.push({ lat: s.lat, lng: s.lng });
    }
  }
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMiles(points[i - 1], points[i]);
  }
  return Math.round(total * 100) / 100;
}

export function formatPayableMiles(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles)) return "—";
  return `${Number(miles).toFixed(2)} mi`;
}

/** Prefer a claim that matches this shift label; ignore a prior shift's claim.

When ``want`` is empty, returns the claim as-is (first-shift unlabeled). Callers
filing another shift should pass forceNew and blank the draft instead of
relying on this helper alone.
*/
export function claimForShiftLabel(
  claim: PayableMileageClaim | null | undefined,
  shiftLabel?: string | null,
): PayableMileageClaim | null {
  if (!claim) return null;
  const want = (shiftLabel || "").trim();
  const got = (claim.shiftLabel || "").trim();
  if (want && want !== got) return null;
  return claim;
}

export function validatePayableMileageDraft(opts: {
  startedFromStorage: boolean | null;
  stops: PayableMileageStop[];
}): string | null {
  if (opts.startedFromStorage === null) {
    return "Did you start at the storage unit?";
  }
  if (opts.startedFromStorage && opts.stops.length < 1) {
    return "Add each place you sampled after leaving storage.";
  }
  if (!opts.startedFromStorage && opts.stops.length < 2) {
    return "Add at least two sampling locations so we can measure miles between them.";
  }
  for (const s of opts.stops) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) {
      return "Pick each stop from the suggestions so we have a map location.";
    }
  }
  return null;
}
