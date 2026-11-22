/**
 * Offline clock-in queue for walk-up `/checkin/:code`.
 *
 * Transport-agnostic punch primitives live in `@/shared/offlinePunchQueue` so
 * both walk-up check-ins (`/checkin/:code`) and standalone time-clock links
 * (`/clock/:token`) share the same offline detection, timestamp validation,
 * idempotency keys, and single-flight reconnect flush semantics.
 */
import {
  CLOCKED_IN_FUTURE_SKEW_MS,
  CLOCKED_IN_MAX_AGE_MS,
  CLOCK_FETCH_TIMEOUT_MS,
  formatSavedClockTime,
  isOfflineClockFailure,
  isPermanentClockReject,
  livePunchStorage,
  newIdempotencyKey,
  offlineClockBanner,
  offlineClockOutBanner,
  parseClientClockedInAt,
  singleFlightClockFlush,
  type ClockFlushResult,
  type LostPunch,
  type StorageLike,
} from "@/shared/offlinePunchQueue";

export {
  CLOCKED_IN_FUTURE_SKEW_MS,
  CLOCKED_IN_MAX_AGE_MS,
  CLOCK_FETCH_TIMEOUT_MS,
  formatSavedClockTime,
  isOfflineClockFailure,
  isPermanentClockReject,
  newIdempotencyKey,
  offlineClockBanner,
  offlineClockOutBanner,
  parseClientClockedInAt,
  type ClockFlushResult,
  type LostPunch,
  type StorageLike,
};

export type PendingClockIn = {
  v: 1;
  id: string;
  code: string;
  token: string;
  clockedInAt: string;
  queuedAt: number;
  latitude?: number;
  longitude?: number;
};

export type PendingClockOut = {
  v: 1;
  id: string;
  code: string;
  token: string;
  clockedOutAt: string;
  queuedAt: number;
  latitude?: number;
  longitude?: number;
};

export const pendingClockKey = (code: string) => `@spark.checkin.pendingClock/${code}`;
export const pendingClockOutKey = (code: string) =>
  `@spark.checkin.pendingClockOut/${code}`;
export const cachedContextKey = (code: string) => `@spark.checkin.ctx/${code}`;

export function readPendingClock(
  code: string,
  storage: StorageLike = livePunchStorage(),
): PendingClockIn | null {
  if (!code) return null;
  try {
    const raw = storage.getItem(pendingClockKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingClockIn;
    if (!parsed || parsed.v !== 1 || parsed.code !== code) return null;
    if (!parsed.id || !parsed.clockedInAt || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingClock(
  pending: PendingClockIn,
  storage: StorageLike = livePunchStorage(),
): PendingClockIn | null {
  try {
    storage.setItem(pendingClockKey(pending.code), JSON.stringify(pending));
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingClock(
  code: string,
  storage: StorageLike = livePunchStorage(),
): void {
  try {
    storage.removeItem(pendingClockKey(code));
  } catch {
    /* disposable */
  }
}

export function enqueueClockIn(
  args: {
    code: string;
    token: string;
    clockedInAt?: string;
    latitude?: number;
    longitude?: number;
    nowMs?: number;
  },
  storage: StorageLike = livePunchStorage(),
): PendingClockIn {
  const existing = readPendingClock(args.code, storage);
  if (existing && existing.token === args.token) return existing;
  const nowMs = args.nowMs ?? Date.now();
  const parsed = parseClientClockedInAt(
    args.clockedInAt ?? new Date(nowMs).toISOString(),
    nowMs,
  );
  const clockedInAt = parsed.ok ? parsed.iso : new Date(nowMs).toISOString();
  const pending: PendingClockIn = {
    v: 1,
    id: newIdempotencyKey(),
    code: args.code,
    token: args.token,
    clockedInAt,
    queuedAt: nowMs,
    ...(args.latitude != null ? { latitude: args.latitude } : {}),
    ...(args.longitude != null ? { longitude: args.longitude } : {}),
  };
  writePendingClock(pending, storage);
  return pending;
}

export function readPendingClockOut(
  code: string,
  storage: StorageLike = livePunchStorage(),
): PendingClockOut | null {
  if (!code) return null;
  try {
    const raw = storage.getItem(pendingClockOutKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingClockOut;
    if (!parsed || parsed.v !== 1 || parsed.code !== code) return null;
    if (!parsed.id || !parsed.clockedOutAt || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingClockOut(
  pending: PendingClockOut,
  storage: StorageLike = livePunchStorage(),
): PendingClockOut | null {
  try {
    storage.setItem(pendingClockOutKey(pending.code), JSON.stringify(pending));
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingClockOut(
  code: string,
  storage: StorageLike = livePunchStorage(),
): void {
  try {
    storage.removeItem(pendingClockOutKey(code));
  } catch {
    /* disposable */
  }
}

export function enqueueClockOut(
  args: {
    code: string;
    token: string;
    clockedOutAt?: string;
    latitude?: number;
    longitude?: number;
    nowMs?: number;
  },
  storage: StorageLike = livePunchStorage(),
): PendingClockOut {
  const existing = readPendingClockOut(args.code, storage);
  if (existing && existing.token === args.token) return existing;
  const nowMs = args.nowMs ?? Date.now();
  const parsed = parseClientClockedInAt(
    args.clockedOutAt ?? new Date(nowMs).toISOString(),
    nowMs,
  );
  const clockedOutAt = parsed.ok ? parsed.iso : new Date(nowMs).toISOString();
  const pending: PendingClockOut = {
    v: 1,
    id: newIdempotencyKey(),
    code: args.code,
    token: args.token,
    clockedOutAt,
    queuedAt: nowMs,
    ...(args.latitude != null ? { latitude: args.latitude } : {}),
    ...(args.longitude != null ? { longitude: args.longitude } : {}),
  };
  writePendingClockOut(pending, storage);
  return pending;
}

export const lostPunchKey = (code: string) => `@spark.checkin.lostPunch/${code}`;

export function readLostPunch(
  code: string,
  storage: StorageLike = livePunchStorage(),
): LostPunch | null {
  if (!code) return null;
  try {
    const raw = storage.getItem(lostPunchKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LostPunch;
    return parsed?.v === 1 && (parsed.kind === "in" || parsed.kind === "out")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function writeLostPunch(
  code: string,
  punch: { kind: "in" | "out"; at: string },
  storage: StorageLike = livePunchStorage(),
): void {
  try {
    storage.setItem(
      lostPunchKey(code),
      JSON.stringify({ v: 1, ...punch, lostAt: Date.now() } satisfies LostPunch),
    );
  } catch {
    /* private mode — the banner just won't survive a reload */
  }
}

export function clearLostPunch(
  code: string,
  storage: StorageLike = livePunchStorage(),
): void {
  try {
    storage.removeItem(lostPunchKey(code));
  } catch {
    /* nothing to clear */
  }
}

export async function flushPendingClockOut(
  args: {
    code: string;
    postClock: (body: Record<string, unknown>) => Promise<{
      ok: boolean;
      status: number;
      alreadyOut?: boolean;
    }>;
  },
  storage: StorageLike = livePunchStorage(),
): Promise<ClockFlushResult> {
  return singleFlightClockFlush(`out:${args.code}`, () =>
    flushClockOutOnce(args, storage),
  );
}

async function flushClockOutOnce(
  args: Parameters<typeof flushPendingClockOut>[0],
  storage: StorageLike,
): Promise<ClockFlushResult> {
  const pending = readPendingClockOut(args.code, storage);
  if (!pending) return "none";
  try {
    const res = await args.postClock({
      kind: "out",
      session: pending.token,
      clockedOutAt: pending.clockedOutAt,
      occurredAt: pending.clockedOutAt,
      idempotencyKey: pending.id,
      ...(pending.latitude != null ? { latitude: pending.latitude } : {}),
      ...(pending.longitude != null ? { longitude: pending.longitude } : {}),
    });
    if (res.ok || res.alreadyOut) {
      clearPendingClockOut(args.code, storage);
      return res.alreadyOut ? "already" : "flushed";
    }
    if (isOfflineClockFailure({ status: res.status })) return "retry";
    if (isPermanentClockReject(res.status)) {
      writeLostPunch(args.code, { kind: "out", at: pending.clockedOutAt }, storage);
      clearPendingClockOut(args.code, storage);
      return "rejected";
    }
    return "retry";
  } catch (error) {
    if (isOfflineClockFailure({ error })) return "retry";
    return "retry";
  }
}

export async function flushPendingClock(
  args: {
    code: string;
    postClock: (body: Record<string, unknown>) => Promise<{
      ok: boolean;
      status: number;
      alreadyIn?: boolean;
    }>;
  },
  storage: StorageLike = livePunchStorage(),
): Promise<ClockFlushResult> {
  return singleFlightClockFlush(`in:${args.code}`, () =>
    flushClockInOnce(args, storage),
  );
}

async function flushClockInOnce(
  args: Parameters<typeof flushPendingClock>[0],
  storage: StorageLike,
): Promise<ClockFlushResult> {
  const pending = readPendingClock(args.code, storage);
  if (!pending) return "none";
  try {
    const res = await args.postClock({
      kind: "in",
      session: pending.token,
      clockedInAt: pending.clockedInAt,
      idempotencyKey: pending.id,
      ...(pending.latitude != null ? { latitude: pending.latitude } : {}),
      ...(pending.longitude != null ? { longitude: pending.longitude } : {}),
    });
    if (res.ok || res.alreadyIn) {
      clearPendingClock(args.code, storage);
      return res.alreadyIn ? "already" : "flushed";
    }
    if (isOfflineClockFailure({ status: res.status })) return "retry";
    if (isPermanentClockReject(res.status)) {
      writeLostPunch(args.code, { kind: "in", at: pending.clockedInAt }, storage);
      clearPendingClock(args.code, storage);
      return "rejected";
    }
    return "retry";
  } catch (error) {
    if (isOfflineClockFailure({ error })) return "retry";
    return "retry";
  }
}

export function readCachedContext<T>(
  code: string,
  storage: StorageLike = livePunchStorage(),
): T | null {
  if (!code) return null;
  try {
    const raw = storage.getItem(cachedContextKey(code));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCachedContext(
  code: string,
  ctx: unknown,
  storage: StorageLike = livePunchStorage(),
): void {
  try {
    storage.setItem(cachedContextKey(code), JSON.stringify(ctx));
  } catch {
    /* private mode / quota */
  }
}

export function clearCachedContext(
  code: string,
  storage: StorageLike = livePunchStorage(),
): void {
  try {
    storage.removeItem(cachedContextKey(code));
  } catch {
    /* disposable */
  }
}
