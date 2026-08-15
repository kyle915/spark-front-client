import { describe, it, expect } from "vitest";
import {
  cachedContextKey,
  clearPendingClock,
  enqueueClockIn,
  flushPendingClock,
  formatSavedClockTime,
  isOfflineClockFailure,
  newIdempotencyKey,
  offlineClockBanner,
  parseClientClockedInAt,
  pendingClockKey,
  readCachedContext,
  readPendingClock,
  writeCachedContext,
  writePendingClock,
  type PendingClockIn,
  type StorageLike,
} from "./offlineClock";

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

const THREE_PM = "2026-08-15T15:00:00.000-07:00";
const THREE_PM_MS = new Date(THREE_PM).getTime();

describe("parseClientClockedInAt", () => {
  it("accepts the tap time a BA meant (3:00 PM)", () => {
    const got = parseClientClockedInAt(THREE_PM, THREE_PM_MS + 60_000);
    expect(got.ok).toBe(true);
    if (got.ok) expect(new Date(got.iso).getTime()).toBe(THREE_PM_MS);
  });

  it("accepts a timestamp flushed hours later, still inside 24h", () => {
    const fivePm = THREE_PM_MS + 2 * 60 * 60 * 1000;
    const got = parseClientClockedInAt(THREE_PM, fivePm);
    expect(got.ok).toBe(true);
  });

  it("rejects a future clock-in (beyond 2 minutes of skew)", () => {
    const got = parseClientClockedInAt(
      new Date(THREE_PM_MS + 10 * 60 * 1000).toISOString(),
      THREE_PM_MS,
    );
    expect(got).toEqual({ ok: false, reason: "future" });
  });

  it("rejects a stamp older than 24 hours", () => {
    const got = parseClientClockedInAt(
      THREE_PM,
      THREE_PM_MS + 25 * 60 * 60 * 1000,
    );
    expect(got).toEqual({ ok: false, reason: "too_old" });
  });

  it("rejects junk", () => {
    expect(parseClientClockedInAt("", THREE_PM_MS)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseClientClockedInAt("yesterday", THREE_PM_MS)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseClientClockedInAt(null, THREE_PM_MS)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("isOfflineClockFailure", () => {
  it("queues fetch failures, timeouts, and gateway statuses", () => {
    expect(isOfflineClockFailure({ error: new TypeError("Failed to fetch") })).toBe(
      true,
    );
    expect(isOfflineClockFailure({ error: Object.assign(new Error("aborted"), { name: "AbortError" }) })).toBe(
      true,
    );
    expect(isOfflineClockFailure({ timedOut: true })).toBe(true);
    expect(isOfflineClockFailure({ status: 0 })).toBe(true);
    expect(isOfflineClockFailure({ status: 408 })).toBe(true);
    expect(isOfflineClockFailure({ status: 502 })).toBe(true);
    expect(isOfflineClockFailure({ status: 503 })).toBe(true);
    expect(isOfflineClockFailure({ status: 504 })).toBe(true);
  });

  it("does not queue auth or validation failures", () => {
    expect(isOfflineClockFailure({ status: 400 })).toBe(false);
    expect(isOfflineClockFailure({ status: 401 })).toBe(false);
    expect(isOfflineClockFailure({ status: 403 })).toBe(false);
    expect(isOfflineClockFailure({ status: 200 })).toBe(false);
  });
});

describe("pending clock-in queue", () => {
  it("saves the tap time and an idempotency key", () => {
    const storage = new MemoryStorage();
    const pending = enqueueClockIn(
      {
        code: "FF-YMMK3Q",
        token: "sess-1",
        clockedInAt: THREE_PM,
        nowMs: THREE_PM_MS,
      },
      storage,
    );
    expect(pending.id).toBeTruthy();
    expect(pending.clockedInAt).toBe(new Date(THREE_PM).toISOString());
    expect(pending.queuedAt).toBe(THREE_PM_MS);
    expect(readPendingClock("FF-YMMK3Q", storage)?.id).toBe(pending.id);
    expect(storage.getItem(pendingClockKey("FF-YMMK3Q"))).toContain(pending.id);
  });

  it("does not mint a second punch for the same session", () => {
    const storage = new MemoryStorage();
    const first = enqueueClockIn(
      { code: "LD-1", token: "t", clockedInAt: THREE_PM, nowMs: THREE_PM_MS },
      storage,
    );
    const second = enqueueClockIn(
      {
        code: "LD-1",
        token: "t",
        clockedInAt: new Date(THREE_PM_MS + 60_000).toISOString(),
        nowMs: THREE_PM_MS + 60_000,
      },
      storage,
    );
    expect(second.id).toBe(first.id);
    expect(second.clockedInAt).toBe(first.clockedInAt);
  });

  it("formats the banner a BA with no bars sees", () => {
    const iso = new Date(THREE_PM).toISOString();
    const when = formatSavedClockTime(iso);
    expect(when).toMatch(/\d{1,2}:\d{2}/);
    expect(offlineClockBanner(iso)).toBe(
      `No service — we'll clock you in when you're back online. Time saved: ${when}.`,
    );
  });

  it("clears after a successful flush and ignores a second flush", async () => {
    const storage = new MemoryStorage();
    const pending = enqueueClockIn(
      { code: "TW-1", token: "tok", clockedInAt: THREE_PM, nowMs: THREE_PM_MS },
      storage,
    );
    const calls: Record<string, unknown>[] = [];
    const first = await flushPendingClock(
      {
        code: "TW-1",
        postClock: async (body) => {
          calls.push(body);
          return { ok: true, status: 200 };
        },
      },
      storage,
    );
    expect(first).toBe("flushed");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: "in",
      clockedInAt: pending.clockedInAt,
      idempotencyKey: pending.id,
    });
    expect(readPendingClock("TW-1", storage)).toBeNull();

    const second = await flushPendingClock(
      {
        code: "TW-1",
        postClock: async () => {
          throw new Error("must not post again");
        },
      },
      storage,
    );
    expect(second).toBe("none");
  });

  it("treats already-in as success so a double flush cannot double-clock", async () => {
    const storage = new MemoryStorage();
    enqueueClockIn(
      { code: "TW-2", token: "tok", clockedInAt: THREE_PM, nowMs: THREE_PM_MS },
      storage,
    );
    const result = await flushPendingClock(
      {
        code: "TW-2",
        postClock: async () => ({ ok: true, status: 200, alreadyIn: true }),
      },
      storage,
    );
    expect(result).toBe("already");
    expect(readPendingClock("TW-2", storage)).toBeNull();
  });

  it("keeps the pending row when the flush is still offline", async () => {
    const storage = new MemoryStorage();
    const pending = enqueueClockIn(
      { code: "TW-3", token: "tok", clockedInAt: THREE_PM, nowMs: THREE_PM_MS },
      storage,
    );
    const result = await flushPendingClock(
      {
        code: "TW-3",
        postClock: async () => {
          throw new TypeError("Failed to fetch");
        },
      },
      storage,
    );
    expect(result).toBe("retry");
    expect(readPendingClock("TW-3", storage)?.id).toBe(pending.id);
  });

  it("round-trips a pending row through JSON storage", () => {
    const storage = new MemoryStorage();
    const row: PendingClockIn = {
      v: 1,
      id: "abc",
      code: "X",
      token: "t",
      clockedInAt: new Date(THREE_PM).toISOString(),
      queuedAt: THREE_PM_MS,
    };
    writePendingClock(row, storage);
    expect(readPendingClock("X", storage)).toEqual(row);
    clearPendingClock("X", storage);
    expect(readPendingClock("X", storage)).toBeNull();
  });
});

describe("cached check-in context", () => {
  it("lets a reload keep the last good shell when fetch fails", () => {
    const storage = new MemoryStorage();
    writeCachedContext("FF-1", { brand: { name: "Feel Free" } }, storage);
    expect(storage.getItem(cachedContextKey("FF-1"))).toContain("Feel Free");
    expect(readCachedContext<{ brand: { name: string } }>("FF-1", storage)).toEqual({
      brand: { name: "Feel Free" },
    });
  });
});

describe("newIdempotencyKey", () => {
  it("returns a unique key each call", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
