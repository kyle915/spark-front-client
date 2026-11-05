import { describe, expect, it } from "vitest";
import { showsMissingRecaps } from "./missingRecaps";

describe("showsMissingRecaps", () => {
  it("is off for Famus Energy", () => {
    expect(showsMissingRecaps("famus-energy")).toBe(false);
    expect(showsMissingRecaps(null, "famus-energy")).toBe(false);
    expect(showsMissingRecaps("FAMUS-ENERGY")).toBe(false);
  });

  it("stays on for other tenants", () => {
    expect(showsMissingRecaps("liquid-death")).toBe(true);
    expect(showsMissingRecaps("keee-torch-thc")).toBe(true);
    expect(showsMissingRecaps("wook-water")).toBe(true);
    expect(showsMissingRecaps(null, null)).toBe(true);
  });
});
