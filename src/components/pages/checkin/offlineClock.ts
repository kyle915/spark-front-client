/**
 * Offline clock-in queue for walk-up `/checkin/:code`.
 *
 * A BA in a stockroom with no bars still tapped Clock in. That tap is the
 * time they meant. We keep it on this device (same localStorage family as
 * the recap draft) and flush when the phone is back online. The API gets
 * `clockedInAt` so a 5pm sync still records 3pm.
 */

export const CLOCKED_IN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const CLOCKED_IN_FUTURE_SKEW_MS = 2 * 60 * 1000;
export const CLOCK_FETCH_TIMEOUT_MS = 15_000;

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

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const pendingClockKey = (code: string) => `@spark.checkin.pendingClock/${code}`;
export const pendingClockOutKey = (code: string) =>
  `@spark.checkin.pendingClockOut/${code}`;
export const cachedContextKey = (code: string) => `@spark.checkin.ctx/${code}`;

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
    /* Safari private mode throws on even *reading* localStorage */
  }
  return memoryStorage;
}

export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* older webviews */
  }
  return `clk_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function parseClientClockedInAt(
  raw: unknown,
  nowMs: number = Date.now(),
): { ok: true; iso: string } | { ok: false; reason: "invalid" | "future" | "too_old" } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "invalid" };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { ok: false, reason: "invalid" };
  const t = d.getTime();
  if (t > nowMs + CLOCKED_IN_FUTURE_SKEW_MS) return { ok: false, reason: "future" };
  if (t < nowMs - CLOCKED_IN_MAX_AGE_MS) return { ok: false, reason: "too_old" };
  return { ok: true, iso: d.toISOString() };
}

export function formatSavedClockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function offlineClockBanner(iso: string): string {
  const when = formatSavedClockTime(iso);
  return when
    ? `No service — we'll clock you in when you're back online. Time saved: ${when}.`
    : "No service — we'll clock you in when you're back online.";
}

export function offlineClockOutBanner(iso: string): string {
  const when = formatSavedClockTime(iso);
  return when
    ? `No service — we'll clock you out when you're back online. Time saved: ${when}.`
    : "No service — we'll clock you out when you're back online.";
}

export function isOfflineClockFailure(input: {
  error?: unknown;
  status?: number;
  timedOut?: boolean;
}): boolean {
  if (input.timedOut) return true;
  if (input.error != null) {
    // Only real connectivity failures — not validation / rate-limit Errors.
    // Treating every Error as offline made photo uploads retry MIME/429
    // rejects three times with no useful message for the BA.
    if (input.error instanceof TypeError) return true;
    const name = input.error instanceof Error ? input.error.name : "";
    return name === "AbortError" || name === "TimeoutError" || name === "NetworkError";
  }
  const status = input.status;
  if (status == null) return false;
  return (
    status === 0 ||
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

export function readPendingClock(
  code: string,
  storage: StorageLike = liveStorage(),
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
  storage: StorageLike = liveStorage(),
): PendingClockIn | null {
  try {
    storage.setItem(pendingClockKey(pending.code), JSON.stringify(pending));
    return pending;
  } catch {
    return null;
  }
}

export function clearPendingClock(code: string, storage: StorageLike = liveStorage()): void {
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
  storage: StorageLike = liveStorage(),
): PendingClockIn {
  const existing = readPendingClock(args.code, storage);
  if (existing && existing.token === args.token) return existing;
  const nowMs = args.nowMs ?? Date.now();
  const parsed = parseClientClockedInAt(args.clockedInAt ?? new Date(nowMs).toISOString(), nowMs);
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
  storage: StorageLike = liveStorage(),
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
  storage: StorageLike = liveStorage(),
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
  storage: StorageLike = liveStorage(),
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
  storage: StorageLike = liveStorage(),
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

export async function flushPendingClockOut(
  args: {
    code: string;
    postClock: (body: Record<string, unknown>) => Promise<{
      ok: boolean;
      status: number;
      alreadyOut?: boolean;
    }>;
  },
  storage: StorageLike = liveStorage(),
): Promise<ClockFlushResult> {
  return singleFlight(`out:${args.code}`, () => flushClockOutOnce(args, storage));
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

export type ClockFlushResult = "none" | "flushed" | "retry" | "already" | "rejected";

/** The server will never accept this punch (bad/expired session, a time it
 *  refuses, a day that is over). Retrying forever just leaves the screen
 *  saying "on the clock" for hours that were never recorded. */
export const isPermanentClockReject = (status: number): boolean =>
  status === 400 || status === 401 || status === 403 || status === 409 ||
  status === 410 || status === 422;

/** A queued punch the server refused. Shown to the ambassador until they
 *  dismiss it, so the hours can be fixed by a lead instead of vanishing. */
export type LostPunch = { v: 1; kind: "in" | "out"; at: string; lostAt: number };

export const lostPunchKey = (code: string) => `@spark.checkin.lostPunch/${code}`;

export function readLostPunch(
  code: string,
  storage: StorageLike = liveStorage(),
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
  storage: StorageLike = liveStorage(),
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

export function clearLostPunch(code: string, storage: StorageLike = liveStorage()): void {
  try {
    storage.removeItem(lostPunchKey(code));
  } catch {
    /* nothing to clear */
  }
}

// One flush per link at a time. "online" and "visibilitychange" both fire
// when a phone wakes up, and two page effects listen for each — without
// this the same queued punch was posted two or three times at once.
const inflightClock = new Map<string, Promise<ClockFlushResult>>();
function singleFlight(
  key: string,
  run: () => Promise<ClockFlushResult>,
): Promise<ClockFlushResult> {
  const existing = inflightClock.get(key);
  if (existing) return existing;
  const p = run().finally(() => inflightClock.delete(key));
  inflightClock.set(key, p);
  return p;
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
  storage: StorageLike = liveStorage(),
): Promise<ClockFlushResult> {
  return singleFlight(`in:${args.code}`, () => flushClockInOnce(args, storage));
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
      // Never accepted, never will be: stop pretending they are on the
      // clock, and keep the time they tapped where they can read it out.
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
  storage: StorageLike = liveStorage(),
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
  storage: StorageLike = liveStorage(),
): void {
  try {
    storage.setItem(cachedContextKey(code), JSON.stringify(ctx));
  } catch {
    /* private mode / quota */
  }
}

export function clearCachedContext(code: string, storage: StorageLike = liveStorage()): void {
  try {
    storage.removeItem(cachedContextKey(code));
  } catch {
    /* disposable */
  }
}
