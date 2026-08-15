import { describe, it, expect } from "vitest";
import { clientRecapKpis } from "./clientRecapKpis";

describe("clientRecapKpis", () => {
  it("shows ENG / SOLD / CONV / photos when both numbers exist", () => {
    expect(
      clientRecapKpis({
        engagements: 80,
        soldUnits: 12,
        unitsSampled: 40,
        photoCount: 9,
      }),
    ).toEqual([
      { label: "Engagements", value: "80" },
      { label: "Sold", value: "12" },
      { label: "Conv", value: "15%" },
      { label: "Photos", value: "9" },
    ]);
  });

  it("falls back to sampled when sold is missing — never a fake conv", () => {
    expect(
      clientRecapKpis({
        engagements: 80,
        soldUnits: null,
        unitsSampled: 40,
        photoCount: 3,
      }),
    ).toEqual([
      { label: "Engagements", value: "80" },
      { label: "Sampled", value: "40" },
      { label: "Photos", value: "3" },
    ]);
  });

  it("skips conv when engagements are zero", () => {
    const labels = clientRecapKpis({
      engagements: 0,
      soldUnits: 4,
      unitsSampled: 0,
      photoCount: 2,
    }).map((k) => k.label);
    expect(labels).toEqual(["Engagements", "Sold", "Photos"]);
  });
});
