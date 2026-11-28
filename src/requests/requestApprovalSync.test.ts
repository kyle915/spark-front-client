import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyRequestDecisionToStore,
  notifyRequestApprovalChanged,
  REQUEST_APPROVAL_STORAGE_KEY,
  subscribeRequestApprovalChanged,
} from "./requestApprovalSync";

type FakeRecord = {
  id: string;
  type: string;
  values: Record<string, unknown>;
  links: Record<string, FakeRecord>;
  setValue: (val: unknown, key: string) => void;
  setLinkedRecord: (rec: FakeRecord, key: string) => void;
};

function makeFakeStore(records: Record<string, FakeRecord>) {
  const create = (id: string, type: string): FakeRecord => {
    const rec: FakeRecord = {
      id,
      type,
      values: {},
      links: {},
      setValue(val, key) {
        this.values[key] = val;
      },
      setLinkedRecord(linked, key) {
        this.links[key] = linked;
      },
    };
    records[id] = rec;
    return rec;
  };
  return {
    get: (id: string) => records[id] ?? null,
    create,
  };
}

function installWindowStub() {
  const listeners = new Map<string, Set<(ev: Event) => void>>();
  const storage = new Map<string, string>();
  const fakeWindow = {
    addEventListener(type: string, fn: (ev: Event) => void) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(fn);
    },
    removeEventListener(type: string, fn: (ev: Event) => void) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(ev: { type: string; [key: string]: unknown }) {
      const set = listeners.get(ev.type);
      if (set) {
        for (const fn of [...set]) fn(ev as unknown as Event);
      }
      return true;
    },
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, String(v));
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
      clear: () => {
        storage.clear();
      },
    },
  };
  vi.stubGlobal("window", fakeWindow);
  return { fakeWindow, storage };
}

describe("requestApprovalSync", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("updates only targeted Request records without mutating the shared pending status node", () => {
    const pendingStatus: FakeRecord = {
      id: "RequestStatusNode:pending",
      type: "RequestStatusNode",
      values: { slug: "pending", name: "Pending" },
      links: {},
      setValue(val, key) {
        this.values[key] = val;
      },
      setLinkedRecord(linked, key) {
        this.links[key] = linked;
      },
    };
    const reqA: FakeRecord = {
      id: "RequestNode:1",
      type: "RequestNode",
      values: {},
      links: { status: pendingStatus },
      setValue(val, key) {
        this.values[key] = val;
      },
      setLinkedRecord(linked, key) {
        this.links[key] = linked;
      },
    };
    const reqB: FakeRecord = {
      id: "RequestNode:2",
      type: "RequestNode",
      values: {},
      links: { status: pendingStatus },
      setValue(val, key) {
        this.values[key] = val;
      },
      setLinkedRecord(linked, key) {
        this.links[key] = linked;
      },
    };
    const records: Record<string, FakeRecord> = {
      [pendingStatus.id]: pendingStatus,
      [reqA.id]: reqA,
      [reqB.id]: reqB,
    };
    const store = makeFakeStore(records);

    applyRequestDecisionToStore(
      store as unknown as Parameters<typeof applyRequestDecisionToStore>[0],
      ["RequestNode:1"],
      "approved",
      { updatedAt: "2026-11-27T12:00:00Z" },
    );

    // Shared pending status node is completely untouched.
    expect(pendingStatus.values.slug).toBe("pending");
    expect(reqB.links.status.values.slug).toBe("pending");

    // Target request now points to a synthetic client-local approved status.
    expect(reqA.links.status.id).toBe("client:request-status:approved");
    expect(reqA.links.status.values.slug).toBe("approved");
    expect(reqA.links.status.values.name).toBe("Approved");
    expect(reqA.values.updatedAt).toBe("2026-11-27T12:00:00Z");
  });

  it("writes declineReason when declining a request", () => {
    const req: FakeRecord = {
      id: "RequestNode:9",
      type: "RequestNode",
      values: {},
      links: {},
      setValue(val, key) {
        this.values[key] = val;
      },
      setLinkedRecord(linked, key) {
        this.links[key] = linked;
      },
    };
    const store = makeFakeStore({ [req.id]: req });

    applyRequestDecisionToStore(
      store as unknown as Parameters<typeof applyRequestDecisionToStore>[0],
      ["RequestNode:9"],
      "declined",
      { declineReason: "  Budget frozen for Q4  " },
    );

    expect(req.links.status.values.slug).toBe("declined");
    expect(req.links.status.values.name).toBe("Declined");
    expect(req.values.declineReason).toBe("Budget frozen for Q4");
  });

  it("notifies same-tab subscribers while respecting ignoreSource and matchUuid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T10:00:00Z"));
    installWindowStub();

    const allCb = vi.fn();
    const ignoredCb = vi.fn();
    const matchCb = vi.fn();
    const otherCb = vi.fn();

    const unsub1 = subscribeRequestApprovalChanged(allCb);
    const unsub2 = subscribeRequestApprovalChanged(ignoredCb, {
      ignoreSource: "approvals-queue",
    });
    const unsub3 = subscribeRequestApprovalChanged(matchCb, {
      matchUuid: "uuid-1",
    });
    const unsub4 = subscribeRequestApprovalChanged(otherCb, {
      matchUuid: "uuid-2",
    });

    vi.advanceTimersByTime(50);
    notifyRequestApprovalChanged({
      ids: ["RequestNode:1"],
      uuids: ["uuid-1"],
      decision: "approved",
      source: "approvals-queue",
    });

    expect(allCb).toHaveBeenCalledTimes(1);
    expect(ignoredCb).not.toHaveBeenCalled();
    expect(matchCb).toHaveBeenCalledTimes(1);
    expect(otherCb).not.toHaveBeenCalled();

    unsub1();
    unsub2();
    unsub3();
    unsub4();
  });

  it("reacts to cross-tab storage events and ignores duplicate timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T10:00:00Z"));
    const { fakeWindow } = installWindowStub();

    const cb = vi.fn();
    const unsub = subscribeRequestApprovalChanged(cb);

    const payload = JSON.stringify({
      ids: ["RequestNode:42"],
      uuids: ["uuid-42"],
      decision: "declined",
      at: Date.now() + 100,
      source: "request-detail",
    });
    fakeWindow.localStorage.setItem(REQUEST_APPROVAL_STORAGE_KEY, payload);
    fakeWindow.dispatchEvent({
      type: "storage",
      key: REQUEST_APPROVAL_STORAGE_KEY,
      newValue: payload,
    });

    expect(cb).toHaveBeenCalledTimes(1);

    // Focusing after already handling the same timestamp should not double-fire.
    fakeWindow.dispatchEvent({ type: "focus" });
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
  });
});
