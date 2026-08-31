import { describe, expect, it } from "vitest";
import type { StorageLike } from "./offlineClock";
import {
  clearPendingMileage,
  enqueueMileage,
  flushPendingMileage,
  offlineMileageBanner,
  pendingMileageKey,
  provisionalClaimFromPending,
  readPendingMileage,
} from "./offlineMileage";

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

const STOP_A = {
  name: "Whole Foods",
  address: "525 N Lamar",
  lat: 30.271,
  lng: -97.753,
};
const STOP_B = {
  name: "HEB",
  address: "1000 E 41st",
  lat: 30.3,
  lng: -97.72,
};
const STORAGE = {
  market: "Austin, TX",
  address: "6330 Harold Ct",
  lat: 30.267,
  lng: -97.671,
};

describe("offlineMileage", () => {
  it("banner copy is stable", () => {
    expect(offlineMileageBanner()).toMatch(/sync when you're back online/i);
  });

  it("enqueues and reads a provisional claim", () => {
    const storage = new MemoryStorage();
    const pending = enqueueMileage(
      {
        code: "FF",
        token: "tok",
        startedFromStorage: true,
        stops: [STOP_A],
        storageMarket: "Austin, TX",
        storage: STORAGE,
      },
      storage,
    );
    expect(pending.provisionalMiles).toBeGreaterThan(0);
    expect(readPendingMileage("FF", storage)?.id).toBe(pending.id);
    expect(storage.getItem(pendingMileageKey("FF"))).toBeTruthy();
    const claim = provisionalClaimFromPending(pending);
    expect(claim.completed).toBe(true);
    expect(claim.routeSource).toBe("offline_estimate");
    expect(claim.payableMiles).toBe(pending.provisionalMiles);
  });

  it("waive queues 0 miles", () => {
    const storage = new MemoryStorage();
    const pending = enqueueMileage(
      {
        code: "FF",
        token: "tok",
        startedFromStorage: false,
        stops: [],
        noMileage: true,
      },
      storage,
    );
    expect(pending.provisionalMiles).toBe(0);
    expect(provisionalClaimFromPending(pending).routeSource).toBe("waived");
  });

  it("flush clears on success", async () => {
    const storage = new MemoryStorage();
    enqueueMileage(
      {
        code: "FF",
        token: "tok",
        startedFromStorage: false,
        stops: [STOP_A, STOP_B],
      },
      storage,
    );
    const result = await flushPendingMileage(
      {
        code: "FF",
        postMileage: async () => ({ ok: true, status: 200, claim: null }),
      },
      storage,
    );
    expect(result).toBe("flushed");
    expect(readPendingMileage("FF", storage)).toBeNull();
  });

  it("flush retries on gateway failure", async () => {
    const storage = new MemoryStorage();
    enqueueMileage(
      {
        code: "FF",
        token: "tok",
        startedFromStorage: false,
        stops: [STOP_A, STOP_B],
      },
      storage,
    );
    const result = await flushPendingMileage(
      {
        code: "FF",
        postMileage: async () => ({ ok: false, status: 503 }),
      },
      storage,
    );
    expect(result).toBe("retry");
    expect(readPendingMileage("FF", storage)).not.toBeNull();
  });

  it("clear removes the row", () => {
    const storage = new MemoryStorage();
    enqueueMileage(
      {
        code: "FF",
        token: "tok",
        startedFromStorage: false,
        stops: [STOP_A, STOP_B],
      },
      storage,
    );
    clearPendingMileage("FF", storage);
    expect(readPendingMileage("FF", storage)).toBeNull();
  });
});
