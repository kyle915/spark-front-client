import { describe, expect, it } from "vitest";
import { groupRecommendations, insightLabel, insightStatusLine, visibleInsights } from "./storeInsights";

const item = (code: string, isDraft = false, id = code) => ({ id, code, isDraft });

describe("store insights", () => {
  it("never shows a draft to a brand user", () => {
    const items = [item("top_store"), item("low_sales", true)];
    expect(visibleInsights(items, true).map((i) => i.code)).toEqual(["top_store"]);
    expect(visibleInsights(items, false)).toHaveLength(2);
  });

  it("groups go back and fix, no product before low sales", () => {
    const { goBack, fix } = groupRecommendations([
      item("low_sales", false, "a"),
      item("top_store", false, "b"),
      item("repeat_no_product", false, "c"),
      item("top_store", false, "d"),
      item("something_new", false, "e"),
    ]);
    expect(goBack.map((i) => i.id)).toEqual(["b", "d"]);
    expect(fix.map((i) => i.id)).toEqual(["c", "a"]);
  });

  it("labels codes and statuses in sentence case", () => {
    expect(insightLabel("no_product_week")).toBe("Product missing");
    expect(insightLabel("unknown")).toBe("Finding");
    expect(insightStatusLine({ status: "published", reviewedByName: "Sam Staff" })).toBe("Published by Sam Staff");
    expect(insightStatusLine({ status: "draft" })).toBe("Draft");
  });
});
