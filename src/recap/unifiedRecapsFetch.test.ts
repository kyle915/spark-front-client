import { describe, expect, it } from "vitest";
import {
  applyUnifiedRecapsPageInfo,
  planUnifiedRecapsLoadMore,
  RECAPS_PAGE_SIZE,
  unifiedRecapsPageVariables,
} from "./unifiedRecapsFetch";

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
