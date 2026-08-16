import { describe, expect, it } from "vitest";
import {
  clearLiveWalkupCode,
  readLiveWalkupCode,
  walkupLiveKey,
  writeLiveWalkupCode,
} from "./walkupLiveCode";
import type { StorageLike } from "@/components/pages/checkin/offlineClock";

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

const EVENT = "evt-walkup-1";

describe("walkup live code persist", () => {
  it("reloads a generated code so Generate is not shown again", () => {
    const storage = new MemoryStorage();
    expect(readLiveWalkupCode(EVENT, storage)).toBeNull();
    writeLiveWalkupCode(EVENT, { code: "FF-YMMK3Q", expiresAt: "2026-12-01T00:00:00.000Z" }, storage);
    expect(readLiveWalkupCode(EVENT, storage)).toEqual({
      code: "FF-YMMK3Q",
      expiresAt: "2026-12-01T00:00:00.000Z",
    });
    expect(storage.getItem(walkupLiveKey(EVENT))).toContain("FF-YMMK3Q");
  });

  it("clears on revoke so the next visit can generate", () => {
    const storage = new MemoryStorage();
    writeLiveWalkupCode(EVENT, { code: "TW-1", expiresAt: null }, storage);
    clearLiveWalkupCode(EVENT, storage);
    expect(readLiveWalkupCode(EVENT, storage)).toBeNull();
  });
});
