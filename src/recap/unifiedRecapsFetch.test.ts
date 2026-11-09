import { describe, expect, it, vi } from "vitest";
import {
  applyUnifiedRecapsPageInfo,
  fetchUnifiedRecapsFromPlan,
  fetchUnifiedRecapsPage,
  planUnifiedRecapsLoadMore,
  RECAPS_PAGE_SIZE,
  unifiedRecapsPageVariables,
} from "./unifiedRecapsFetch";

vi.mock("relay-runtime", () => ({
  fetchQuery: vi.fn((_env, _query, variables) => ({
    toPromise: async () =>
      variables && "last" in variables && variables.last
        ? { recaps: { edges: [] }, customRecaps: { edges: [] } }
        : {
            recaps: {
              pageInfo: { endCursor: "L1", hasNextPage: false },
              edges: [],
            },
            customRecaps: {
              pageInfo: { endCursor: "C1", hasNextPage: true },
              edges: [],
            },
          },
  })),
}));

vi.mock("@/api/queries/RecapsListQuery", () => ({
  RecapsListQuery: Symbol("RecapsListQuery"),
}));
vi.mock("@/api/queries/CustomRecapsListQuery", () => ({
  CustomRecapsListQuery: Symbol("CustomRecapsListQuery"),
}));

describe("unifiedRecapsPageVariables", () => {
  it("keeps legacy and custom on the same first/after window", () => {
    const page1 = unifiedRecapsPageVariables(null);
    expect(page1.legacy).toEqual({ first: RECAPS_PAGE_SIZE, after: null });
    expect(page1.custom).toEqual(page1.legacy);

    const page2 = unifiedRecapsPageVariables("cursor-abc");
    expect(page2.legacy.after).toBe("cursor-abc");
    expect(page2.custom.after).toBe("cursor-abc");
    expect(page2.legacy.first).toBe(RECAPS_PAGE_SIZE);
  });
});

describe("planUnifiedRecapsLoadMore", () => {
  it("fetches both pipelines in parallel when both have more", () => {
    const plan = planUnifiedRecapsLoadMore({
      enableLegacy: true,
      enableCustom: true,
      legacyHasMore: true,
      customHasMore: true,
      legacyAfter: "L1",
      customAfter: "C1",
    });
    expect(plan.hasMore).toBe(true);
    expect(plan.fetchLegacy).toBe(true);
    expect(plan.fetchCustom).toBe(true);
    expect(plan.legacyVars).toEqual({ first: RECAPS_PAGE_SIZE, after: "L1" });
    expect(plan.customVars).toEqual({ first: RECAPS_PAGE_SIZE, after: "C1" });
  });

  it("advances only the pipeline that still has pages", () => {
    const plan = planUnifiedRecapsLoadMore({
      enableLegacy: true,
      enableCustom: true,
      legacyHasMore: false,
      customHasMore: true,
      legacyAfter: null,
      customAfter: "C2",
    });
    expect(plan.fetchLegacy).toBe(false);
    expect(plan.fetchCustom).toBe(true);
    expect(plan.legacyVars).toBeNull();
    expect(plan.customVars?.after).toBe("C2");
  });

  it("reports hasMore false when both are exhausted", () => {
    const plan = planUnifiedRecapsLoadMore({
      enableLegacy: true,
      enableCustom: true,
      legacyHasMore: false,
      customHasMore: false,
      legacyAfter: null,
      customAfter: null,
    });
    expect(plan.hasMore).toBe(false);
  });
});

describe("applyUnifiedRecapsPageInfo", () => {
  it("updates only the pipelines that returned a page", () => {
    const next = applyUnifiedRecapsPageInfo(
      {
        enableLegacy: true,
        enableCustom: true,
        legacyHasMore: true,
        customHasMore: true,
        legacyAfter: "L0",
        customAfter: "C0",
      },
      {
        legacy: { endCursor: "L1", hasNextPage: false },
        custom: null,
      },
    );
    expect(next.legacyAfter).toBe("L1");
    expect(next.legacyHasMore).toBe(false);
    expect(next.customAfter).toBe("C0");
    expect(next.customHasMore).toBe(true);
  });
});

describe("fetchUnifiedRecapsPage", () => {
  it("skips disabled pipelines and returns both when enabled", async () => {
    const env = {} as never;
    const both = await fetchUnifiedRecapsPage(env, {
      fetchLegacy: true,
      fetchCustom: true,
      legacyVariables: { first: 50, after: null, filters: null },
      customVariables: { first: 50, after: null, filters: null },
      fetchPolicy: "network-only",
    });
    expect(both.legacy?.recaps?.pageInfo.endCursor).toBe("L1");
    expect(both.custom?.customRecaps?.pageInfo.endCursor).toBe("C1");

    const legacyOnly = await fetchUnifiedRecapsPage(env, {
      fetchLegacy: true,
      fetchCustom: false,
      legacyVariables: { first: 50, after: null, filters: null },
      customVariables: null,
    });
    expect(legacyOnly.legacy).not.toBeNull();
    expect(legacyOnly.custom).toBeNull();
  });

  it("fetchUnifiedRecapsFromPlan wires plan vars + filters", async () => {
    const plan = planUnifiedRecapsLoadMore({
      enableLegacy: true,
      enableCustom: true,
      legacyHasMore: true,
      customHasMore: true,
      legacyAfter: null,
      customAfter: null,
    });
    const page = await fetchUnifiedRecapsFromPlan({} as never, plan, {
      q: "miami",
      legacyFilters: { tenantId: "1" } as never,
      customFilters: { tenantId: "1" } as never,
    });
    expect(page.legacy).not.toBeNull();
    expect(page.custom).not.toBeNull();
  });
});
