import { describe, expect, it } from "vitest";
import {
  isProductsSampledMultiselect,
  matchProductForSampleOption,
  optionSkuName,
  productSamplesFromSelections,
} from "./productsSampledQty";

const products = [
  { id: "1", name: "Mt. Death", category: "Sparkling Water" },
  { id: "2", name: "Killer Cola", category: "Sparkling Water" },
  { id: "3", name: "Sparkling Water", category: "Mountain Water" },
  { id: "4", name: "Feastables Peanut Butter Cup", category: "Sparkling Water" },
];

describe("optionSkuName", () => {
  it("strips the LD category — name prefix", () => {
    expect(optionSkuName("Sparkling Water — Mt. Death")).toBe("Mt. Death");
  });

  it("accepts a spaced hyphen", () => {
    expect(optionSkuName("Sparkling Water - Killer Cola")).toBe("Killer Cola");
  });
});

describe("isProductsSampledMultiselect", () => {
  it("matches the LD field", () => {
    expect(
      isProductsSampledMultiselect({
        name: "Products Sampled",
        type: "multiselect",
      }),
    ).toBe(true);
  });

  it("ignores other multiselects", () => {
    expect(
      isProductsSampledMultiselect({
        name: "Had tried flavor before",
        type: "multiselect",
      }),
    ).toBe(false);
  });
});

describe("matchProductForSampleOption", () => {
  it("matches Category — Name to the catalog row", () => {
    const hit = matchProductForSampleOption(
      "Sparkling Water — Mt. Death",
      products,
    );
    expect(hit?.id).toBe("1");
  });

  it("disambiguates Sparkling Water SKU via category", () => {
    const hit = matchProductForSampleOption(
      "Mountain Water — Sparkling Water",
      products,
    );
    expect(hit?.id).toBe("3");
  });

  it("finds Feastables by label", () => {
    const hit = matchProductForSampleOption(
      "Sparkling Water — Feastables Peanut Butter Cup",
      products,
    );
    expect(hit?.id).toBe("4");
  });
});

describe("productSamplesFromSelections", () => {
  it("emits productId + quantity for selected pills with qty", () => {
    const rows = productSamplesFromSelections(
      [
        "Sparkling Water — Mt. Death",
        "Sparkling Water — Killer Cola",
        "Sparkling Water — Doctor Death",
      ],
      { "1": "12", "2": "0", "9": "99" },
      products,
      (raw) => {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      },
    );
    expect(rows).toEqual([{ productId: "1", quantity: 12 }]);
  });
});
