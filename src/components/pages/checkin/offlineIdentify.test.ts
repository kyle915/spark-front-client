import { describe, expect, it } from "vitest";
import { writeCachedContext, type StorageLike } from "./offlineClock";
import {
  IDENTIFY_OFFLINE_NO_CACHE,
  IDENTIFY_OFFLINE_QUEUED,
  clearPendingIdentify,
  flushPendingIdentify,
  hasCachedCheckinContext,
  identifyOfflineMessage,
  readPendingIdentify,
  shouldQueueOfflineIdentify,
  writePendingIdentify,
} from "./offlineIdentify";

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const BODY = { firstName: "Alicia", lastName: "Ng", phone: "3125550100" };

describe("offline identify", () => {
  it("keeps the honest message until this code has loaded once", () => {
    const storage = new MemoryStorage();
    expect(hasCachedCheckinContext("LD-TNBJ8K", storage)).toBe(false);
    expect(shouldQueueOfflineIdentify(false)).toBe(false);
    expect(identifyOfflineMessage(false)).toBe(IDENTIFY_OFFLINE_NO_CACHE);
  });

  it("queues the identify body when a previous context is cached and does not invent a session", () => {
    const storage = new MemoryStorage();
    writeCachedContext("LD-TNBJ8K", { brand: { name: "Liquid Death" } }, storage);
    expect(hasCachedCheckinContext("LD-TNBJ8K", storage)).toBe(true);
    expect(identifyOfflineMessage(true)).toBe(IDENTIFY_OFFLINE_QUEUED);
    const row = writePendingIdentify("LD-TNBJ8K", BODY, storage, 1_700_000_000_000);
    expect(readPendingIdentify("LD-TNBJ8K", storage)).toEqual(row);
    expect(JSON.stringify(row)).not.toContain("sessionToken");
  });

  it("flushes to the real identify endpoint and only then returns a token", async () => {
    const storage = new MemoryStorage();
    writePendingIdentify("FF-YMMK3Q", BODY, storage);
    const calls: Array<{ url: string; body: string }> = [];
    const result = await flushPendingIdentify({
      code: "FF-YMMK3Q",
      origin: "https://api.example",
      storage,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: String(init?.body ?? "") });
        return new Response(JSON.stringify({ sessionToken: "tok-1" }), { status: 200 });
      },
    });
    expect(result).toEqual({ status: "flushed", sessionToken: "tok-1" });
    expect(calls[0].url).toBe("https://api.example/api/public/checkin/FF-YMMK3Q/identify");
    expect(JSON.parse(calls[0].body)).toEqual(BODY);
    expect(readPendingIdentify("FF-YMMK3Q", storage)).toBeNull();
  });

  it("keeps the row when the network is still dead", async () => {
    const storage = new MemoryStorage();
    writePendingIdentify("TH-2HRV3D", BODY, storage);
    const result = await flushPendingIdentify({
      code: "TH-2HRV3D",
      origin: "https://api.example",
      storage,
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(result.status).toBe("retry");
    expect(readPendingIdentify("TH-2HRV3D", storage)?.body).toEqual(BODY);
    clearPendingIdentify("TH-2HRV3D", storage);
    expect(readPendingIdentify("TH-2HRV3D", storage)).toBeNull();
  });
});
