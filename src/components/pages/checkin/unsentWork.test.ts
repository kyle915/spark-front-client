import { describe, it, expect } from "vitest";
import {
  enqueueClockIn,
  enqueueClockOut,
  type StorageLike,
} from "./offlineClock";
import { writePendingRecap, type PendingRecap } from "./offlineRecap";
import {
  hasUnsentWork,
  readUnsentWork,
  unsentWorkMessage,
  type UnsentWork,
} from "./unsentWork";

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

const NONE: UnsentWork = {
  clockIn: false,
  clockOut: false,
  mileage: false,
  recap: false,
  rejectedRecap: false,
};

const recapRow = (extra: Partial<PendingRecap> = {}): PendingRecap => ({
  v: 1,
  id: "r1",
  code: "TW-1",
  token: "tok",
  submittedAt: "2026-08-15T22:00:00.000Z",
  queuedAt: 1,
  fieldValues: [],
  files: [],
  productSamples: [],
  totalEngagements: null,
  ...extra,
});

describe("unsentWorkMessage", () => {
  it("says nothing when nothing is waiting", () => {
    expect(unsentWorkMessage(NONE)).toBeNull();
    expect(hasUnsentWork(NONE)).toBe(false);
  });

  it("names a single queued clock-in", () => {
    expect(unsentWorkMessage({ ...NONE, clockIn: true })).toBe(
      "You have a clock-in that has not been sent yet. " +
        "Keep this page open until it sends, then switch stores.",
    );
  });

  it("names two items", () => {
    expect(unsentWorkMessage({ ...NONE, clockOut: true, recap: true })).toBe(
      "You have a clock-out and a recap that have not been sent yet. " +
        "Keep this page open until they send, then switch stores.",
    );
  });

  it("names every item", () => {
    expect(
      unsentWorkMessage(
        { clockIn: true, clockOut: true, mileage: true, recap: true, rejectedRecap: false },
        "try again",
      ),
    ).toBe(
      "You have a clock-in, a clock-out, a mileage claim and a recap that have not been sent yet. " +
        "Keep this page open until they send, then try again.",
    );
  });

  it("does not hold a BA here for a recap the server refused", () => {
    const work = { ...NONE, rejectedRecap: true };
    expect(hasUnsentWork(work)).toBe(false);
    expect(unsentWorkMessage(work)).toBeNull();
  });
});

describe("readUnsentWork", () => {
  it("is empty for a link with nothing queued", () => {
    expect(readUnsentWork("TW-1", new MemoryStorage())).toEqual(NONE);
  });

  it("sees a queued clock-in, clock-out and recap for this link only", () => {
    const storage = new MemoryStorage();
    enqueueClockIn({ code: "TW-1", token: "tok" }, storage);
    enqueueClockOut({ code: "TW-1", token: "tok" }, storage);
    writePendingRecap(recapRow(), storage);
    expect(readUnsentWork("TW-1", storage)).toEqual({
      clockIn: true,
      clockOut: true,
      mileage: false,
      recap: true,
      rejectedRecap: false,
    });
    expect(readUnsentWork("TW-2", storage)).toEqual(NONE);
  });

  it("separates a refused recap from one still sending", () => {
    const storage = new MemoryStorage();
    writePendingRecap(recapRow({ rejected: { status: 400, message: "no", at: 1 } }), storage);
    const work = readUnsentWork("TW-1", storage);
    expect(work.recap).toBe(false);
    expect(work.rejectedRecap).toBe(true);
    expect(hasUnsentWork(work)).toBe(false);
  });
});
