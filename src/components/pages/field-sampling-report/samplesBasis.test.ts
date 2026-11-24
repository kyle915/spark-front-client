import { describe, expect, it } from "vitest";
import { samplesBasisLabels } from "./samplesBasis";

describe("samplesBasisLabels", () => {
  it("labels unit totals as samples with no caveat", () => {
    expect(samplesBasisLabels("units")).toEqual({
      total: "Samples (window)",
      perHour: "Samples / hour",
      note: null,
    });
  });

  it("never calls a consumers count samples", () => {
    const l = samplesBasisLabels("consumers");
    expect(l.total).toBe("Consumers sampled (window)");
    expect(l.perHour).toBe("Consumers / hour");
    expect(l.note).toMatch(/no per-sku counts/i);
  });
});
