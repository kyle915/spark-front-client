import { describe, expect, it } from "vitest";
import {
  RECAPS_PAGE_SIZE,
  unifiedRecapsPageVariables,
} from "./unifiedRecapsFetch";

describe("unifiedRecapsPageVariables", () => {
  it("keeps legacy and custom on the same page window", () => {
    const page1 = unifiedRecapsPageVariables(null);
    expect(page1.legacy).toEqual(page1.custom);
    expect(page1.legacy.first).toBe(RECAPS_PAGE_SIZE);
    expect(page1.legacy.after).toBeNull();

    const page2 = unifiedRecapsPageVariables("cursor-abc");
    expect(page2.legacy.after).toBe("cursor-abc");
    expect(page2.custom.after).toBe("cursor-abc");
  });
});
