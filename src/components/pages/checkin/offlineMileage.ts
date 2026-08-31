/**
 * Offline payable-mileage queue for Feel Free walk-up check-in.
 *
 * Same localStorage family as clock-in / recap queues. When the stockroom has
 * no bars, keep the itinerary (or waive), let the BA continue into the recap
 * with a provisional claim, and POST payable-mileage when back online —
 * before the offline recap flush so submit finds the claim.
 */

import {
  isOfflineClockFailure,
  newIdempotencyKey,
  type StorageLike,
} from "./offlineClock";
import type {
  PayableMileageClaim,
  PayableMileageStop,
  StorageUnit,
} from "./payableMileage";
import { estimatePayableMilesHaversine } from "./payableMileage";

export type PendingMileage = {
  v: 1;
  id: string;
  code: string;
  token: string;
  queuedAt: number;
  startedFromStorage: boolean;
  stops: PayableMileageStop[];
  storageMarket?: string;
  forceNew?: boolean;
  noMileage?: boolean;
  /** Provisional miles shown on the recap until the server responds. */
  provisionalMiles: number;
};

const memoryStore = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
  removeItem: (key) => {
    memoryStore.delete(key);
  },
};

function liveStorage(): StorageLike {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* Safari private mode */
  }
  return memoryStorage;
}

export const pendingMileageKey = (code: string) =>
  `@spark.checkin.pendingMileage/${code}`;

export function offlineMileageBanner(): string {
  return "No service — mileage is saved on this phone and will sync when you're back online.";
}

export function readPendingMileage(
  code: string,
  storage: StorageLike = liveStorage(),
): PendingMileage | null {
  if (!code) return null;
  try {
    const raw = storage.getItem(pendingMileageKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingMileage;
    if (!parsed || parsed.v !== 1 || parsed.code !== code) return null;
    if (!parsed.id || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingMileage(
  pending: PendingMileage,
  storage: StorageLike = liveStorage(),
): PendingMileage | null {
  try {
    storage.setItem(pendingMileageKey(pending.code), JSON.stringify(pending));
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingMileage(
  code: string,
  storage: StorageLike = liveStorage(),
): void {
  try {
    storage.removeItem(pendingMileageKey(code));
  } catch {
    /* disposable */
  }
}

export function enqueueMileage(
  args: {
    code: string;
    token: string;
    startedFromStorage: boolean;
    stops: PayableMileageStop[];
    storageMarket?: string;
    forceNew?: boolean;
    noMileage?: boolean;
    storage?: StorageUnit | null;
    nowMs?: number;
  },
  storage: StorageLike = liveStorage(),
): PendingMileage {
  const existing = readPendingMileage(args.code, storage);
  if (
    existing &&
    existing.token === args.token &&
    Boolean(existing.forceNew) === Boolean(args.forceNew) &&
    Boolean(existing.noMileage) === Boolean(args.noMileage)
  ) {
    return existing;
  }
  const nowMs = args.nowMs ?? Date.now();
  const provisionalMiles = args.noMileage
    ? 0
    : estimatePayableMilesHaversine({
        startedFromStorage: args.startedFromStorage,
        storage: args.storage ?? null,
        stops: args.stops,
      });
  const pending: PendingMileage = {
    v: 1,
    id: newIdempotencyKey(),
    code: args.code,
    token: args.token,
    queuedAt: nowMs,
    startedFromStorage: args.startedFromStorage,
    stops: args.stops,
    provisionalMiles,
    ...(args.storageMarket ? { storageMarket: args.storageMarket } : {}),
    ...(args.forceNew ? { forceNew: true } : {}),
    ...(args.noMileage ? { noMileage: true } : {}),
  };
  writePendingMileage(pending, storage);
  return pending;
}

/** Local claim so the BA can open the recap before the server ACKs. */
export function provisionalClaimFromPending(
  pending: PendingMileage,
): PayableMileageClaim {
  return {
    uuid: `offline-${pending.id}`,
    startedFromStorage: pending.startedFromStorage,
    storageMarket: pending.storageMarket || "",
    storageAddress: "",
    stops: pending.stops,
    payableMiles: pending.provisionalMiles,
    routeSource: pending.noMileage ? "waived" : "offline_estimate",
    shiftLabel: "",
    completed: true,
  };
}

export type MileageFlushResult = "none" | "flushed" | "retry" | "already";

export async function flushPendingMileage(
  args: {
    code: string;
    postMileage: (body: Record<string, unknown>) => Promise<{
      ok: boolean;
      status: number;
      claim?: PayableMileageClaim | null;
    }>;
  },
  storage: StorageLike = liveStorage(),
): Promise<MileageFlushResult> {
  const pending = readPendingMileage(args.code, storage);
  if (!pending) return "none";
  try {
    const res = await args.postMileage({
      session: pending.token,
      idempotencyKey: pending.id,
      startedFromStorage: pending.startedFromStorage,
      stops: pending.stops,
      ...(pending.storageMarket ? { storageMarket: pending.storageMarket } : {}),
      ...(pending.forceNew ? { forceNew: true } : {}),
      ...(pending.noMileage ? { noMileage: true } : {}),
    });
    if (res.ok || res.status === 409) {
      clearPendingMileage(args.code, storage);
      return res.status === 409 ? "already" : "flushed";
    }
    if (isOfflineClockFailure({ status: res.status })) return "retry";
    // Permanent client error — drop the queue so they aren't stuck forever.
    if (res.status >= 400 && res.status < 500) {
      clearPendingMileage(args.code, storage);
      return "already";
    }
    return "retry";
  } catch (error) {
    if (isOfflineClockFailure({ error })) return "retry";
    return "retry";
  }
}
