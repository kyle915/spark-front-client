import { describe, expect, it } from "vitest";
import { coBrandBlocker, coBrandsPayload } from "./coBrandPayload";
import { coActivationLabel } from "@/recap/coActivationLabel";

describe("coBrandsPayload", () => {
  it("sends an empty list when the activation is single-brand", () => {
    expect(coBrandsPayload(false, { "2": ["p1"] })).toEqual([]);
  });

  it("sends each picked brand with its own SKUs", () => {
    expect(coBrandsPayload(true, { "2": ["p1", "p2"], "3": ["p9"] })).toEqual([
      { tenantId: "2", productIds: ["p1", "p2"] },
      { tenantId: "3", productIds: ["p9"] },
    ]);
  });
});

describe("coBrandBlocker", () => {
  it("asks the multi-brand question first", () => {
    expect(coBrandBlocker(null, {})).toBe("Multi-brand");
  });

  it("needs a brand and SKUs for every picked brand", () => {
    expect(coBrandBlocker(false, {})).toBe("");
    expect(coBrandBlocker(true, {})).toBe("Brands");
    expect(coBrandBlocker(true, { "2": [] })).toBe("Brand SKUs");
    expect(coBrandBlocker(true, { "2": ["p1"] })).toBe("");
  });
});

describe("coActivationLabel", () => {
  it("names the other brands only", () => {
    expect(coActivationLabel(["FAMUS Energy"])).toBe("Co-activation with FAMUS Energy");
    expect(coActivationLabel(["FAMUS Energy", "Alcohol Armor"])).toBe(
      "Co-activation with FAMUS Energy & Alcohol Armor",
    );
    expect(coActivationLabel([])).toBe("");
    expect(coActivationLabel(null)).toBe("");
  });
});
