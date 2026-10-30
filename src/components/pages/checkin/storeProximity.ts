/**
 * BA store proximity confirmation for walk-up check-in.
 *
 * When the phone has a GPS fix and the selected store can be located, a pick
 * farther than {@link STORE_PROXIMITY_CONFIRM_MILES} needs an explicit
 * "use this store anyway" before identify accepts it. Missing GPS or store
 * coords skip the check so clock-in is never blocked by geo gaps.
 */

export type LatLng = { lat: number; lng: number };

/** Confirm when the selected store is about this far (or farther) from GPS. */
export const STORE_PROXIMITY_CONFIRM_MILES = 0.75;

/** Soft early warning band (optional UI); confirm still uses the threshold above. */
export const STORE_PROXIMITY_SOFT_WARN_MILES = 0.5;

const EARTH_MI = 3958.7613;

export function haversineMiles(a: LatLng, b: LatLng): number {
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

export function isFiniteLatLng(point: LatLng | null | undefined): point is LatLng {
  return (
    point != null &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    !(point.lat === 0 && point.lng === 0)
  );
}

/** Round for BA copy: "0.8" / "1.2" / "3" (no noisy thousandths). */
export function formatMilesForConfirm(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "?";
  if (miles < 10) return miles.toFixed(1).replace(/\.0$/, "");
  return String(Math.round(miles));
}

export function proximityConfirmCopy(opts: {
  miles: number;
  storeLabel: string;
}): string {
  const label = opts.storeLabel.trim() || "this store";
  return `You're about ${formatMilesForConfirm(opts.miles)} miles from ${label}. Use this store anyway?`;
}

export type ProximityDecision =
  | { action: "allow"; reason: "no_gps" | "no_store_coords" | "trusted" | "already_confirmed" | "nearby" }
  | { action: "confirm"; miles: number; softWarn: boolean };

/**
 * Decide whether a store pick needs confirmation.
 *
 * `trustedKey` is the normalized address accepted from "Use my current
 * location" (nearest / snapped match) — changing away from it can confirm;
 * keeping it never nags.
 */
export function decideStoreProximity(opts: {
  gps: LatLng | null | undefined;
  store: LatLng | null | undefined;
  storeKey: string;
  trustedKey: string | null | undefined;
  confirmedKey: string | null | undefined;
  confirmMiles?: number;
  softWarnMiles?: number;
}): ProximityDecision {
  const confirmAt = opts.confirmMiles ?? STORE_PROXIMITY_CONFIRM_MILES;
  const softAt = opts.softWarnMiles ?? STORE_PROXIMITY_SOFT_WARN_MILES;
  const key = opts.storeKey.trim();

  if (!isFiniteLatLng(opts.gps)) return { action: "allow", reason: "no_gps" };
  if (!isFiniteLatLng(opts.store)) return { action: "allow", reason: "no_store_coords" };
  if (key && opts.trustedKey && key === opts.trustedKey) {
    return { action: "allow", reason: "trusted" };
  }
  if (key && opts.confirmedKey && key === opts.confirmedKey) {
    return { action: "allow", reason: "already_confirmed" };
  }

  const miles = haversineMiles(opts.gps, opts.store);
  if (miles <= confirmAt) return { action: "allow", reason: "nearby" };
  return {
    action: "confirm",
    miles,
    softWarn: miles > softAt,
  };
}

const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";

/** Best-effort forward geocode for a store address. Never throws. */
export async function geocodeStoreAddress(
  address: string,
  signal?: AbortSignal,
): Promise<LatLng | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const params = new URLSearchParams({
      q,
      limit: "1",
      lang: "en",
    });
    const res = await fetch(`${PHOTON_ENDPOINT}?${params.toString()}`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: unknown[] } }>;
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    const lng = Number(coords?.[0]);
    const lat = Number(coords?.[1]);
    const point = { lat, lng };
    return isFiniteLatLng(point) ? point : null;
  } catch {
    return null;
  }
}

/** Optional identify payload fields (API may ignore; useful in request logs). */
export function proximityIdentifyFields(opts: {
  miles: number | null;
  confirmedDespiteDistance: boolean;
}): Record<string, unknown> {
  if (opts.miles == null || !Number.isFinite(opts.miles)) return {};
  return {
    storeProximityMiles: Math.round(opts.miles * 100) / 100,
    storeProximityConfirmed: opts.confirmedDespiteDistance,
  };
}
