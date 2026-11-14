import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, auth } = vi.hoisted(() => ({
  refresh: vi.fn(() => Promise.resolve(undefined)),
  auth: { token: "t" as string | null, tenantId: "VGVuYW50OjE=" as string | null },
}));
vi.mock("@/hooks/useSidebarCounts", () => ({ refreshSidebarCounts: refresh }));
vi.mock("@/store/authStore", () => ({ useAuthStore: { getState: () => auth } }));

import type { IEnvironment } from "relay-runtime";
import {
  __resetCountsRefresh,
  isSettledMutation,
  scheduleCountsRefresh,
} from "./countsRefresh";

const env = {} as IEnvironment;

describe("isSettledMutation", () => {
  it("is true only for a mutation that came back without errors", () => {
    expect(isSettledMutation({ operationKind: "mutation" }, { data: {} })).toBe(true);
    expect(isSettledMutation({ operationKind: "mutation" }, { data: {}, errors: [] } as never)).toBe(true);
    expect(isSettledMutation({ operationKind: "query" }, { data: {} })).toBe(false);
    expect(
      isSettledMutation({ operationKind: "mutation" }, { errors: [{ message: "no" }] } as never),
    ).toBe(false);
    expect(isSettledMutation({ operationKind: "mutation" }, null)).toBe(false);
  });
});

describe("scheduleCountsRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    auth.token = "t";
    __resetCountsRefresh();
  });
  afterEach(() => vi.useRealTimers());

  it("turns a burst of changes into one read, for the current brand", () => {
    scheduleCountsRefresh(env);
    scheduleCountsRefresh(env);
    scheduleCountsRefresh(env);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(env, "VGVuYW50OjE=");
  });

  it("does nothing when signed out", () => {
    auth.token = null;
    scheduleCountsRefresh(env, 0);
    vi.advanceTimersByTime(10);
    expect(refresh).not.toHaveBeenCalled();
  });
});
