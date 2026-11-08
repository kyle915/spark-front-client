import { describe, expect, it } from "vitest";
import { showsMissingRecaps } from "./missingRecaps";

describe("showsMissingRecaps", () => {
  it("is on for Famus Energy after Matching gate lift", () => {
    expect(showsMissingRecaps("famus-energy")).toBe(true);
    expect(showsMissingRecaps(null, "famus-energy")).toBe(true);
    expect(showsMissingRecaps("FAMUS-ENERGY")).toBe(true);
  });

  it("stays on for other tenants", () => {
    expect(showsMissingRecaps("liquid-death")).toBe(true);
    expect(showsMissingRecaps("keee-torch-thc")).toBe(true);
    expect(showsMissingRecaps("wook-water")).toBe(true);
    expect(showsMissingRecaps(null, null)).toBe(true);
  });
});
