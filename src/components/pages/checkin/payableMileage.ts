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
  return /^\s*mileage\s*$|^\s*miles?\s*(driven|traveled|travelled|reimbursed)?\s*$/i.test(
    n,
  );
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

export function payableMileageComplete(
  state: PayableMileageState | null | undefined,
): boolean {
  return Boolean(state?.claim?.completed);
}

export function formatPayableMiles(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles)) return "—";
  return `${Number(miles).toFixed(2)} mi`;
}

/** Prefer a claim that matches this shift label; ignore a prior shift's claim. */
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
