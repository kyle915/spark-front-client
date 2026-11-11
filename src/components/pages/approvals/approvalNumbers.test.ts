import { describe, expect, it } from "vitest";
import { approvalNumberParts } from "./approvalNumbers";

describe("approval row numbers", () => {
  it("shows sampled and sold when reported", () => {
    expect(approvalNumberParts({ sampled: 1240, sold: 31 })).toEqual([
      { label: "sampled", value: "1,240" },
      { label: "sold", value: "31" },
    ]);
  });

  it("omits missing and zero values rather than printing 0", () => {
    expect(approvalNumberParts({ sampled: null, sold: 0 })).toEqual([]);
    expect(approvalNumberParts({})).toEqual([]);
  });

  it("falls back to engagements only without a sampling figure", () => {
    expect(approvalNumberParts({ engaged: 80, sold: 5 })).toEqual([
      { label: "sold", value: "5" },
      { label: "engaged", value: "80" },
    ]);
    expect(approvalNumberParts({ sampled: 100, engaged: 80 })).toEqual([
      { label: "sampled", value: "100" },
    ]);
  });
});
