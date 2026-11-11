/**
 * Offline identify for walk-up `/checkin/:code`.
 *
 * Clock-in, recap submit, and mileage already queue. Identify did not:
 * a dead network on the first "who's working" tap died with "No service"
 * even when this phone had already loaded the link.
 *
 * A previous successful context (localStorage, written after a good GET)
 * means we know the link is real. Queue the same POST and send it when
 * the phone is back. Never mint a session on the device — the API is the
 * only thing that starts a check-in. If this code has never loaded, keep
 * the honest offline message.
 */

import { isOfflineClockFailure, readCachedContext, type StorageLike } from "./offlineClock";
import { timedFetch, type FetchLike } from "./timedFetch";

export const IDENTIFY_OFFLINE_NO_CACHE =
  "No service. Stay on this page and tap again when you have a bar.";

export const IDENTIFY_OFFLINE_QUEUED =
  "No service — your check-in is saved on this phone and will send when you're back online.";

export type PendingIdentify = {
  v: 1;
  code: string;
  body: Record<string, unknown>;
  queuedAt: number;
};

export type IdentifyFlushResult = {
  status: "idle" | "flushed" | "retry" | "rejected";
  sessionToken?: string;
  message?: string;
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

export const pendingIdentifyKey = (code: string) => `@spark.checkin.pendingIdentify/${code}`;

export function shouldQueueOfflineIdentify(hasCachedContext: boolean): boolean {
  return hasCachedContext;
}

export function identifyOfflineMessage(hasCachedContext: boolean): string {
  return shouldQueueOfflineIdentify(hasCachedContext)
    ? IDENTIFY_OFFLINE_QUEUED
    : IDENTIFY_OFFLINE_NO_CACHE;
}

export function hasCachedCheckinContext(
  code: string,
  storage: StorageLike = liveStorage(),
): boolean {
  return readCachedContext(code, storage) != null;
}

export function readPendingIdentify(
  code: string,
  storage: StorageLike = liveStorage(),
): PendingIdentify | null {
  if (!code) return null;
  try {
    const raw = storage.getItem(pendingIdentifyKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingIdentify;
    if (parsed?.v !== 1 || parsed.code !== code || !parsed.body || typeof parsed.body !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingIdentify(
  code: string,
  body: Record<string, unknown>,
  storage: StorageLike = liveStorage(),
  nowMs: number = Date.now(),
): PendingIdentify {
  const row: PendingIdentify = { v: 1, code, body, queuedAt: nowMs };
  storage.setItem(pendingIdentifyKey(code), JSON.stringify(row));
  return row;
}

export function clearPendingIdentify(code: string, storage: StorageLike = liveStorage()): void {
  try {
    storage.removeItem(pendingIdentifyKey(code));
  } catch {
    /* disposable */
  }
}


/**
 * Replay one queued identify. Success is a real session token from the API.
 * A still-dead network keeps the row. A validation reject drops it so we
 * don't replay a body the server already refused.
 */
export async function flushPendingIdentify(args: {
  code: string;
  origin: string;
  fetchImpl?: FetchLike;
  storage?: StorageLike;
}): Promise<IdentifyFlushResult> {
  const storage = args.storage ?? liveStorage();
  const pending = readPendingIdentify(args.code, storage);
  if (!pending) return { status: "idle" };
  const doFetch = args.fetchImpl ?? timedFetch;
  try {
    const res = await doFetch(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/identify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.body),
      },
    );
    let json: { sessionToken?: string; message?: string } = {};
    try {
      json = (await res.json()) as { sessionToken?: string; message?: string };
    } catch {
      json = {};
    }
    if (res.ok && json.sessionToken) {
      clearPendingIdentify(args.code, storage);
      return { status: "flushed", sessionToken: json.sessionToken };
    }
    if (isOfflineClockFailure({ status: res.status })) return { status: "retry" };
    if (!res.ok) {
      clearPendingIdentify(args.code, storage);
      return {
        status: "rejected",
        message: json.message || "Couldn't start your check-in.",
      };
    }
    return { status: "retry" };
  } catch (error) {
    if (isOfflineClockFailure({ error })) return { status: "retry" };
    return { status: "retry" };
  }
}
