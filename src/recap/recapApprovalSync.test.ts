import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RECAP_APPROVAL_EVENT,
  RECAP_APPROVAL_STORAGE_KEY,
  applyRecapApprovalToStore,
  notifyRecapApprovalChanged,
  subscribeRecapApprovalChanged,
} from "./recapApprovalSync";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applyRecapApprovalToStore", () => {
  it("updates approved, approvedAt, and clears archivedAt on matching Relay store records", () => {
    const records = new Map<string, Record<string, unknown>>([
      [
        "CustomRecap:42",
        { approved: false, approvedAt: null, archivedAt: "2026-11-20T00:00:00Z" },
      ],
      ["Recap:99", { approved: false, approvedAt: null, archivedAt: null }],
    ]);

    const fakeStore = {
      get: (id: string) => {
        const row = records.get(id);
        if (!row) return null;
        return {
          setValue: (val: unknown, field: string) => {
            row[field] = val;
          },
        };
      },
    };

    applyRecapApprovalToStore(
      fakeStore as unknown as Parameters<typeof applyRecapApprovalToStore>[0],
      ["CustomRecap:42", "Recap:99", "Missing:1"],
      true,
      "2026-11-27T18:00:00Z",
    );

    expect(records.get("CustomRecap:42")).toEqual({
      approved: true,
      approvedAt: "2026-11-27T18:00:00Z",
      archivedAt: null,
    });
    expect(records.get("Recap:99")).toEqual({
      approved: true,
      approvedAt: "2026-11-27T18:00:00Z",
      archivedAt: null,
    });

    // Un-approving clears approved & approvedAt
    applyRecapApprovalToStore(
      fakeStore as unknown as Parameters<typeof applyRecapApprovalToStore>[0],
      ["Recap:99"],
      false,
    );
    expect(records.get("Recap:99")).toEqual({
      approved: false,
      approvedAt: null,
      archivedAt: null,
    });
  });
});

describe("notifyRecapApprovalChanged & subscribeRecapApprovalChanged", () => {
  it("broadcasts approval updates across listeners and respects ignoreSource + matchUuid", () => {
    const listeners = new Map<string, Set<(ev: Event) => void>>();
    const storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => storage.get(`s:${k}`) ?? null,
      setItem: (k: string, v: string) => storage.set(`s:${k}`, v),
      removeItem: (k: string) => storage.delete(`s:${k}`),
    });
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: (ev: Event) => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(fn);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, fn: (ev: Event) => void) => {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent: (ev: Event) => {
        for (const fn of listeners.get(ev.type) ?? []) fn(ev);
        return true;
      },
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
      },
    });

    let allCalls = 0;
    let sameSourceCalls = 0;
    let matchedUuidCalls = 0;
    let otherUuidCalls = 0;

    const unsub1 = subscribeRecapApprovalChanged(() => {
      allCalls += 1;
    });
    const unsub2 = subscribeRecapApprovalChanged(
      () => {
        sameSourceCalls += 1;
      },
      { ignoreSource: "recaps-list" },
    );
    const unsub3 = subscribeRecapApprovalChanged(
      () => {
        matchedUuidCalls += 1;
      },
      { matchUuid: "u-123" },
    );
    const unsub4 = subscribeRecapApprovalChanged(
      () => {
        otherUuidCalls += 1;
      },
      { matchUuid: "u-999" },
    );

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 100);

    const detail = notifyRecapApprovalChanged({
      ids: ["CustomRecap:1"],
      uuids: ["u-123"],
      approved: true,
      source: "recaps-list",
    });

    expect(detail.approved).toBe(true);
    expect(storage.has(RECAP_APPROVAL_STORAGE_KEY)).toBe(true);
    expect(allCalls).toBe(1);
    expect(sameSourceCalls).toBe(0);
    expect(matchedUuidCalls).toBe(1);
    expect(otherUuidCalls).toBe(0);

    // Cross-tab storage event still triggers ignoreSource listener!
    vi.setSystemTime(Date.now() + 100);
    const crossTab = JSON.stringify({
      ids: ["CustomRecap:2"],
      uuids: ["u-999"],
      approved: true,
      at: Date.now(),
      source: "recaps-list",
    });
    for (const fn of listeners.get("storage") ?? []) {
      fn({ key: RECAP_APPROVAL_STORAGE_KEY, newValue: crossTab } as StorageEvent);
    }
    expect(allCalls).toBe(2);
    expect(sameSourceCalls).toBe(1);
    expect(otherUuidCalls).toBe(1);
    expect(RECAP_APPROVAL_EVENT).toBe("spark:recap-approval-changed");

    unsub1();
    unsub2();
    unsub3();
    unsub4();
    vi.useRealTimers();
  });
});
