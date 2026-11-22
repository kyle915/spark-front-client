/**
 * Shared transport-agnostic offline punch queue primitives.
 *
 * Used by both walk-up check-in (`/checkin/:code` via `offlineClock.ts`) and
 * standalone public time-clock links (`/clock/:token` via `PublicClock.tsx`)
 * so punches tapped inside dead-zone warehouses or steel-roof venues are held
 * locally with their exact client tap timestamp (`clientClockedInAt` /
 * `clientClockedOutAt`) and flushed idempotently on reconnect.
 */
import type { ClockProfile, GpsReading, GpsStatus } from "@/public/clock/clockDevice";
import { minutesBetween } from "@/public/clock/clockDevice";

export const CLOCKED_IN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const CLOCKED_IN_FUTURE_SKEW_MS = 2 * 60 * 1000;
export const CLOCK_FETCH_TIMEOUT_MS = 15_000;
export const CLOCK_RETRY_DELAYS_MS = [4_000, 10_000, 25_000, 60_000] as const;

export function clockRetryDelayMs(attempt: number): number {
  const idx = Math.max(0, Math.min(CLOCK_RETRY_DELAYS_MS.length - 1, Math.floor(attempt)));
  return CLOCK_RETRY_DELAYS_MS[idx]!;
}

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type ClockFlushResult = "none" | "flushed" | "retry" | "already" | "rejected";

export type LostPunch = { v: 1; kind: "in" | "out"; at: string; lostAt: number };

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

const fallbackByStorage = new WeakMap<object, Map<string, string>>();

function memoryFallbackFor(storage: StorageLike): Map<string, string> {
  let map = fallbackByStorage.get(storage);
  if (!map) {
    map = new Map<string, string>();
    fallbackByStorage.set(storage, map);
  }
  return map;
}

function safeStorageGet(storage: StorageLike, key: string): string | null {
  try {
    const raw = storage.getItem(key);
    if (raw !== null) return raw;
  } catch {
    /* private mode / restricted storage */
  }
  return memoryFallbackFor(storage).get(key) ?? null;
}

/**
 * Write to `storage` with an automatic per-storage in-memory fallback when
 * `setItem` throws (`QuotaExceededError` or private browsing). Returns `true`
 * when durably persisted to `storage`, or `false` when held in memory only.
 */
function safeStorageSet(storage: StorageLike, key: string, value: string): boolean {
  const mem = memoryFallbackFor(storage);
  try {
    storage.setItem(key, value);
    mem.delete(key);
    return storage !== memoryStorage;
  } catch {
    mem.set(key, value);
    return false;
  }
}

function safeStorageRemove(storage: StorageLike, key: string): void {
  memoryFallbackFor(storage).delete(key);
  try {
    storage.removeItem(key);
  } catch {
    /* disposable */
  }
}

export function livePunchStorage(): StorageLike {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    /* Safari private mode throws on reading localStorage */
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

export const isPermanentClockReject = (status: number): boolean =>
  status === 400 ||
  status === 401 ||
  status === 403 ||
  status === 409 ||
  status === 410 ||
  status === 422;

const inflightClock = new Map<string, Promise<ClockFlushResult>>();
export function singleFlightClockFlush(
  key: string,
  run: () => Promise<ClockFlushResult>,
): Promise<ClockFlushResult> {
  const existing = inflightClock.get(key);
  if (existing) return existing;
  const p = run().finally(() => inflightClock.delete(key));
  inflightClock.set(key, p);
  return p;
}

export async function timedFetchJson<T = Record<string, unknown>>(
  url: string,
  init: RequestInit,
  timeoutMs: number = CLOCK_FETCH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Standalone `/clock/:token` offline punch queue
// ---------------------------------------------------------------------------

export type PublicClockSessionSnapshot = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  market: string;
  address: string;
  timezone: string;
  clockInAt: string;
  clockInGps: GpsStatus;
  clockOutAt: string | null;
  clockOutGps: GpsStatus | null;
  durationMinutes: number | null;
};

export type PendingPublicClockIn = {
  v: 1;
  id: string;
  token: string;
  profile: ClockProfile;
  gps: GpsReading["gps"];
  gpsStatus: GpsStatus;
  timezone: string | null;
  clientClockedInAt: string;
  queuedAt: number;
  memoryOnly?: boolean;
};

export type PendingPublicClockOut = {
  v: 1;
  id: string;
  token: string;
  sessionToken?: string | null;
  email?: string | null;
  gps: GpsReading["gps"];
  gpsStatus: GpsStatus;
  clientClockedOutAt: string;
  queuedAt: number;
  memoryOnly?: boolean;
};

export const publicClockInQueueKey = (token: string) =>
  `@spark.publicClock.pendingIn/${token}`;
export const publicClockOutQueueKey = (token: string) =>
  `@spark.publicClock.pendingOut/${token}`;
export const publicClockLostKey = (token: string) =>
  `@spark.publicClock.lostPunch/${token}`;
export const publicClockCachedLinkKey = (token: string) =>
  `@spark.publicClock.ctx/${token}`;

export function readPendingPublicClockIn(
  token: string,
  storage: StorageLike = livePunchStorage(),
): PendingPublicClockIn | null {
  if (!token) return null;
  try {
    const raw = safeStorageGet(storage, publicClockInQueueKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPublicClockIn;
    if (!parsed || parsed.v !== 1 || parsed.token !== token) return null;
    if (!parsed.id || !parsed.clientClockedInAt || !parsed.profile?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPublicClockIn(
  token: string,
  storage: StorageLike = livePunchStorage(),
): void {
  if (!token) return;
  safeStorageRemove(storage, publicClockInQueueKey(token));
}

export function enqueuePublicClockIn(
  args: {
    token: string;
    id?: string;
    profile: ClockProfile;
    gps: GpsReading["gps"];
    gpsStatus: GpsStatus;
    timezone: string | null;
    clientClockedInAt?: string;
    nowMs?: number;
  },
  storage: StorageLike = livePunchStorage(),
): PendingPublicClockIn {
  const existing = readPendingPublicClockIn(args.token, storage);
  if (
    existing &&
    existing.profile.email.trim().toLowerCase() ===
      args.profile.email.trim().toLowerCase()
  ) {
    return existing;
  }
  const nowMs = args.nowMs ?? Date.now();
  const parsed = parseClientClockedInAt(
    args.clientClockedInAt ?? new Date(nowMs).toISOString(),
    nowMs,
  );
  const clientClockedInAt = parsed.ok ? parsed.iso : new Date(nowMs).toISOString();
  const pending: PendingPublicClockIn = {
    v: 1,
    id: args.id || newIdempotencyKey(),
    token: args.token,
    profile: { ...args.profile },
    gps: args.gps,
    gpsStatus: args.gpsStatus,
    timezone: args.timezone,
    clientClockedInAt,
    queuedAt: nowMs,
  };
  const key = publicClockInQueueKey(args.token);
  const durable = safeStorageSet(storage, key, JSON.stringify(pending));
  if (!durable) {
    const memEntry: PendingPublicClockIn = { ...pending, memoryOnly: true };
    memoryFallbackFor(storage).set(key, JSON.stringify(memEntry));
    return memEntry;
  }
  return pending;
}

export function readPendingPublicClockOut(
  token: string,
  storage: StorageLike = livePunchStorage(),
): PendingPublicClockOut | null {
  if (!token) return null;
  try {
    const raw = safeStorageGet(storage, publicClockOutQueueKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPublicClockOut;
    if (!parsed || parsed.v !== 1 || parsed.token !== token) return null;
    if (!parsed.id || !parsed.clientClockedOutAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPublicClockOut(
  token: string,
  storage: StorageLike = livePunchStorage(),
): void {
  if (!token) return;
  safeStorageRemove(storage, publicClockOutQueueKey(token));
}

export function enqueuePublicClockOut(
  args: {
    token: string;
    id?: string;
    sessionToken?: string | null;
    email?: string | null;
    gps: GpsReading["gps"];
    gpsStatus: GpsStatus;
    clientClockedOutAt?: string;
    nowMs?: number;
  },
  storage: StorageLike = livePunchStorage(),
): PendingPublicClockOut {
  const existing = readPendingPublicClockOut(args.token, storage);
  if (existing) return existing;
  const nowMs = args.nowMs ?? Date.now();
  const parsed = parseClientClockedInAt(
    args.clientClockedOutAt ?? new Date(nowMs).toISOString(),
    nowMs,
  );
  const clientClockedOutAt = parsed.ok ? parsed.iso : new Date(nowMs).toISOString();
  const pending: PendingPublicClockOut = {
    v: 1,
    id: args.id || newIdempotencyKey(),
    token: args.token,
    ...(args.sessionToken ? { sessionToken: args.sessionToken } : {}),
    ...(args.email ? { email: args.email } : {}),
    gps: args.gps,
    gpsStatus: args.gpsStatus,
    clientClockedOutAt,
    queuedAt: nowMs,
  };
  const key = publicClockOutQueueKey(args.token);
  const durable = safeStorageSet(storage, key, JSON.stringify(pending));
  if (!durable) {
    const memEntry: PendingPublicClockOut = { ...pending, memoryOnly: true };
    memoryFallbackFor(storage).set(key, JSON.stringify(memEntry));
    return memEntry;
  }
  return pending;
}

export function readPublicClockLostPunch(
  token: string,
  storage: StorageLike = livePunchStorage(),
): LostPunch | null {
  if (!token) return null;
  try {
    const raw = safeStorageGet(storage, publicClockLostKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LostPunch;
    return parsed?.v === 1 && (parsed.kind === "in" || parsed.kind === "out")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function writePublicClockLostPunch(
  token: string,
  punch: { kind: "in" | "out"; at: string },
  storage: StorageLike = livePunchStorage(),
): void {
  if (!token) return;
  safeStorageSet(
    storage,
    publicClockLostKey(token),
    JSON.stringify({ v: 1, ...punch, lostAt: Date.now() } satisfies LostPunch),
  );
}

export function clearPublicClockLostPunch(
  token: string,
  storage: StorageLike = livePunchStorage(),
): void {
  if (!token) return;
  safeStorageRemove(storage, publicClockLostKey(token));
}

export function readCachedPublicClockLink<T>(
  token: string,
  storage: StorageLike = livePunchStorage(),
): T | null {
  if (!token) return null;
  try {
    const raw = safeStorageGet(storage, publicClockCachedLinkKey(token));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCachedPublicClockLink(
  token: string,
  payload: unknown,
  storage: StorageLike = livePunchStorage(),
): void {
  if (!token) return;
  safeStorageSet(storage, publicClockCachedLinkKey(token), JSON.stringify(payload));
}

export function provisionalSessionFromQueuedIn(
  pending: PendingPublicClockIn,
  fallbackTimezone: string = "America/New_York",
): PublicClockSessionSnapshot {
  return {
    id: `queued-${pending.id}`,
    firstName: pending.profile.firstName.trim() || "Ambassador",
    lastName: pending.profile.lastName.trim(),
    email: pending.profile.email.trim().toLowerCase(),
    market: pending.profile.market.trim(),
    address: pending.profile.address.trim(),
    timezone: pending.timezone || fallbackTimezone,
    clockInAt: pending.clientClockedInAt,
    clockInGps: pending.gpsStatus,
    clockOutAt: null,
    clockOutGps: null,
    durationMinutes: null,
  };
}

export function provisionalClosedSession(
  openSession: PublicClockSessionSnapshot,
  pendingOut: PendingPublicClockOut,
): PublicClockSessionSnapshot {
  return {
    ...openSession,
    clockOutAt: pendingOut.clientClockedOutAt,
    clockOutGps: pendingOut.gpsStatus,
    durationMinutes: minutesBetween(openSession.clockInAt, pendingOut.clientClockedOutAt),
  };
}

export type RejectedClockOutView<TSession extends PublicClockSessionSnapshot = PublicClockSessionSnapshot> =
  | { kind: "in"; session: TSession }
  | { kind: "conflict"; session: TSession };

/**
 * Restore the open-shift view after a queued clock-out is permanently rejected
 * so the worker never sees a false "CLOCKED OUT" confirmation screen.
 */
export function restoreSessionAfterRejectedClockOut<
  TSession extends PublicClockSessionSnapshot,
>(
  provisionalClosed: TSession,
  hasDeviceSessionToken: boolean,
): RejectedClockOutView<TSession> {
  const reopened: TSession = {
    ...provisionalClosed,
    clockOutAt: null,
    clockOutGps: null,
    durationMinutes: null,
  };
  if (hasDeviceSessionToken || reopened.id.startsWith("queued-")) {
    return { kind: "in", session: reopened };
  }
  return { kind: "conflict", session: reopened };
}

export async function flushPendingPublicClockIn(
  args: {
    token: string;
    postIn: (body: Record<string, unknown>) => Promise<{
      ok: boolean;
      status: number;
      sessionToken?: string | null;
      session?: PublicClockSessionSnapshot | null;
      openSession?: PublicClockSessionSnapshot | null;
      alreadyIn?: boolean;
    }>;
    onSession?: (result: {
      sessionToken: string | null;
      session: PublicClockSessionSnapshot | null;
      conflictSession?: PublicClockSessionSnapshot | null;
    }) => void;
  },
  storage: StorageLike = livePunchStorage(),
): Promise<ClockFlushResult> {
  return singleFlightClockFlush(`pub-in:${args.token}`, async () => {
    const pending = readPendingPublicClockIn(args.token, storage);
    if (!pending) return "none";
    try {
      const res = await args.postIn({
        ...pending.profile,
        gps: pending.gps,
        gpsStatus: pending.gpsStatus,
        timezone: pending.timezone,
        clientClockedInAt: pending.clientClockedInAt,
        idempotencyKey: pending.id,
      });
      if (res.ok || res.alreadyIn) {
        clearPendingPublicClockIn(args.token, storage);
        args.onSession?.({
          sessionToken: res.sessionToken ?? null,
          session: res.session ?? null,
        });
        return res.alreadyIn ? "already" : "flushed";
      }
      if (isOfflineClockFailure({ status: res.status })) return "retry";
      if (res.status === 409 && res.openSession) {
        clearPendingPublicClockIn(args.token, storage);
        writePublicClockLostPunch(
          args.token,
          { kind: "in", at: pending.clientClockedInAt },
          storage,
        );
        args.onSession?.({
          sessionToken: null,
          session: null,
          conflictSession: res.openSession,
        });
        return "rejected";
      }
      if (isPermanentClockReject(res.status)) {
        writePublicClockLostPunch(
          args.token,
          { kind: "in", at: pending.clientClockedInAt },
          storage,
        );
        clearPendingPublicClockIn(args.token, storage);
        return "rejected";
      }
      return "retry";
    } catch (error) {
      if (isOfflineClockFailure({ error })) return "retry";
      return "retry";
    }
  });
}

export async function flushPendingPublicClockOut(
  args: {
    token: string;
    latestSessionToken?: string | null;
    postOut: (body: Record<string, unknown>) => Promise<{
      ok: boolean;
      status: number;
      session?: PublicClockSessionSnapshot | null;
      alreadyOut?: boolean;
    }>;
    onClosed?: (session: PublicClockSessionSnapshot | null) => void;
  },
  storage: StorageLike = livePunchStorage(),
): Promise<ClockFlushResult> {
  return singleFlightClockFlush(`pub-out:${args.token}`, async () => {
    // Never send clock-out while clock-in for the same shift is still unsent on this phone.
    if (readPendingPublicClockIn(args.token, storage)) return "retry";
    const pending = readPendingPublicClockOut(args.token, storage);
    if (!pending) return "none";
    const effectiveToken = args.latestSessionToken || pending.sessionToken || null;
    const body: Record<string, unknown> = {
      gps: pending.gps,
      gpsStatus: pending.gpsStatus,
      clientClockedOutAt: pending.clientClockedOutAt,
      idempotencyKey: pending.id,
      ...(effectiveToken ? { sessionToken: effectiveToken } : {}),
      ...(pending.email ? { email: pending.email } : {}),
    };
    try {
      const res = await args.postOut(body);
      const treatedAsAlreadyOut =
        Boolean(res.alreadyOut) || (res.status === 409 && Boolean(res.session));
      if (res.ok || treatedAsAlreadyOut) {
        clearPendingPublicClockOut(args.token, storage);
        args.onClosed?.(res.session ?? null);
        return treatedAsAlreadyOut ? "already" : "flushed";
      }
      if (isOfflineClockFailure({ status: res.status })) return "retry";
      if (isPermanentClockReject(res.status) || res.status === 404) {
        writePublicClockLostPunch(
          args.token,
          { kind: "out", at: pending.clientClockedOutAt },
          storage,
        );
        clearPendingPublicClockOut(args.token, storage);
        return "rejected";
      }
      return "retry";
    } catch (error) {
      if (isOfflineClockFailure({ error })) return "retry";
      return "retry";
    }
  });
}
