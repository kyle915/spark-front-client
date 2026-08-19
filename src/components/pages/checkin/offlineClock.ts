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

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const pendingClockKey = (code: string) => `@spark.checkin.pendingClock/${code}`;
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

export function isOfflineClockFailure(input: {
  error?: unknown;
  status?: number;
  timedOut?: boolean;
}): boolean {
  if (input.timedOut) return true;
  if (input.error != null) {
    const name = input.error instanceof Error ? input.error.name : "";
    if (name === "AbortError") return true;
    return true;
  }
  const status = input.status;
  if (status == null) return false;
  return status === 0 || status === 408 || status === 502 || status === 503 || status === 504;
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

export type ClockFlushResult = "none" | "flushed" | "retry" | "already";

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
    if (res.ok || res.alreadyIn || res.status === 409) {
      clearPendingClock(args.code, storage);
      return res.alreadyIn ? "already" : "flushed";
    }
    if (isOfflineClockFailure({ status: res.status })) return "retry";
    // Auth / validation — don't loop forever, but keep the row so a BA
    // can still see the time they meant.
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
