import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_ASK_THREAD_STORAGE_PREFIX,
  MAX_PERSISTED_ADMIN_ASK_TURNS,
  adminAskThreadKey,
  appendAdminAskTurn,
  clearAdminAskThread,
  clearAllAdminAskThreads,
  loadAdminAskThread,
  saveAdminAskThread,
  type AdminAskTurn,
} from "./adminAskThreadStorage";

function installSessionStorageStub(opts?: { maxBytes?: number }) {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      if (opts?.maxBytes != null && value.length > opts.maxBytes) {
        throw new Error("QuotaExceededError");
      }
      map.set(key, String(value));
    },
  };
  vi.stubGlobal("window", { sessionStorage: storage });
  return { map, storage };
}

function makeTurn(i: number, overrides: Partial<AdminAskTurn> = {}): AdminAskTurn {
  return {
    id: `turn-${i}`,
    question: `Question ${i}`,
    ok: true,
    answer: `Answer ${i}`,
    thoughtFor: 2,
    ...overrides,
  };
}

describe("adminAskThreadStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds isolated keys per tenant and scope (tenant, recap, event)", () => {
    expect(adminAskThreadKey({ tenantId: "t-1", scope: "tenant" })).toBe(
      `${ADMIN_ASK_THREAD_STORAGE_PREFIX}t-1:tenant`,
    );
    expect(
      adminAskThreadKey({ tenantId: "t-1", scope: "recap", recapId: "r-9" }),
    ).toBe(`${ADMIN_ASK_THREAD_STORAGE_PREFIX}t-1:recap:r-9`);
    expect(
      adminAskThreadKey({ tenantId: "t-1", scope: "event", eventId: "e-4" }),
    ).toBe(`${ADMIN_ASK_THREAD_STORAGE_PREFIX}t-1:event:e-4`);
    expect(adminAskThreadKey({ tenantId: "", scope: "tenant" })).toBeNull();
    expect(
      adminAskThreadKey({ tenantId: "t-1", scope: "recap", recapId: null }),
    ).toBeNull();
  });

  it("persists and restores threads per brand without cross-brand leakage", () => {
    installSessionStorageStub();
    const keyA = adminAskThreadKey({ tenantId: "brand-a", scope: "tenant" });
    const keyB = adminAskThreadKey({ tenantId: "brand-b", scope: "tenant" });

    const turnWithChart = makeTurn(1, {
      chart: {
        type: "bar",
        title: "Units sold by market",
        labels: ["CA", "TX"],
        series: [{ label: "Units", data: [120, 88] }],
      },
    });
    saveAdminAskThread(keyA, [turnWithChart]);
    saveAdminAskThread(keyB, [makeTurn(2)]);

    expect(loadAdminAskThread(keyA)).toEqual([turnWithChart]);
    expect(loadAdminAskThread(keyB)).toEqual([makeTurn(2)]);

    clearAdminAskThread(keyA);
    expect(loadAdminAskThread(keyA)).toEqual([]);
    expect(loadAdminAskThread(keyB)).toEqual([makeTurn(2)]);
  });

  it("appends turns idempotently and enforces MAX_PERSISTED_ADMIN_ASK_TURNS", () => {
    installSessionStorageStub();
    const key = adminAskThreadKey({ tenantId: "brand-a", scope: "tenant" });

    const turns = Array.from({ length: MAX_PERSISTED_ADMIN_ASK_TURNS + 5 }, (_, i) =>
      makeTurn(i + 1),
    );
    saveAdminAskThread(key, turns);
    const loaded = loadAdminAskThread(key);
    expect(loaded).toHaveLength(MAX_PERSISTED_ADMIN_ASK_TURNS);
    expect(loaded[0].id).toBe("turn-6");

    // Duplicate append is a no-op; new turn appends and stays capped.
    const latest = loaded[loaded.length - 1];
    expect(appendAdminAskTurn(key, latest)).toHaveLength(
      MAX_PERSISTED_ADMIN_ASK_TURNS,
    );
    const next = appendAdminAskTurn(key, makeTurn(999));
    expect(next).toHaveLength(MAX_PERSISTED_ADMIN_ASK_TURNS);
    expect(next[next.length - 1].id).toBe("turn-999");
  });

  it("ignores malformed storage payloads and trims gracefully on quota errors", () => {
    const { map } = installSessionStorageStub({ maxBytes: 400 });
    const key = adminAskThreadKey({ tenantId: "brand-a", scope: "tenant" })!;

    map.set(key, "{not valid json");
    expect(loadAdminAskThread(key)).toEqual([]);

    map.set(key, JSON.stringify([{ bogus: true }, makeTurn(7)]));
    expect(loadAdminAskThread(key)).toEqual([makeTurn(7)]);

    // Oversized write trims oldest turns until it fits under quota.
    const bigTurns = Array.from({ length: 12 }, (_, i) =>
      makeTurn(i + 1, { answer: "x".repeat(80) }),
    );
    saveAdminAskThread(key, bigTurns);
    const saved = loadAdminAskThread(key);
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.length).toBeLessThan(bigTurns.length);
    expect(saved[saved.length - 1].id).toBe("turn-12");
  });

  it("clears only Ask Spark thread keys on clearAllAdminAskThreads", () => {
    const { map } = installSessionStorageStub();
    map.set("unrelated.key", "keep-me");
    saveAdminAskThread(
      adminAskThreadKey({ tenantId: "brand-a", scope: "tenant" }),
      [makeTurn(1)],
    );
    saveAdminAskThread(
      adminAskThreadKey({ tenantId: "brand-b", scope: "recap", recapId: "r-1" }),
      [makeTurn(2)],
    );

    clearAllAdminAskThreads();

    expect(map.get("unrelated.key")).toBe("keep-me");
    expect(
      loadAdminAskThread(
        adminAskThreadKey({ tenantId: "brand-a", scope: "tenant" }),
      ),
    ).toEqual([]);
    expect(
      loadAdminAskThread(
        adminAskThreadKey({ tenantId: "brand-b", scope: "recap", recapId: "r-1" }),
      ),
    ).toEqual([]);
  });
});
