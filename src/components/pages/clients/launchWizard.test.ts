import { describe, expect, it } from "vitest";
import {
  countCatalogCsv,
  deriveCodePrefix,
  slugifyBrand,
  validateLabelSwaps,
  validateSlug,
} from "./launchWizard";

describe("launch wizard validation", () => {
  it("derives a plain exact slug, never an ighn- prefix", () => {
    expect(slugifyBrand("Drink Lyft")).toBe("drink-lyft");
    expect(slugifyBrand("LYT")).toBe("lyt");
  });

  it("rejects loose or malformed slugs", () => {
    expect(validateSlug("drink-lyft")).toBeNull();
    expect(validateSlug("Drink Lyft")).not.toBeNull();
    expect(validateSlug("drink--lyft")).not.toBeNull();
    expect(validateSlug("")).not.toBeNull();
  });

  it("counts catalog rows and validates swaps", () => {
    expect(countCatalogCsv("name,sku\nA,1\nB,2\n")).toBe(2);
    expect(countCatalogCsv("")).toBe(0);
    expect(validateLabelSwaps("Liquid Death=Acme")).toBeNull();
    expect(validateLabelSwaps("Liquid Death")).not.toBeNull();
  });

  it("derives a readable code prefix", () => {
    expect(deriveCodePrefix("drink-lyft", "Drink Lyft")).toBe("DL");
    expect(deriveCodePrefix("acme", "Acme")).toBe("AC");
  });
});
