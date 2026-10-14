import { describe, expect, it } from "vitest";
import { retailerMatchesSearch, retailerOptionLabel } from "./retailerOptionLabel";

describe("retailerMatchesSearch", () => {
  const shell = { name: "Shell", address: "3815 Carter Rd, Owensboro, KY 42301" };

  it("matches every word across name and address", () => {
    expect(retailerMatchesSearch(shell, "shell owensboro")).toBe(true);
    expect(retailerMatchesSearch(shell, "  Carter  ")).toBe(true);
  });

  it("rejects when any word is missing", () => {
    expect(retailerMatchesSearch(shell, "shell bluffton")).toBe(false);
    expect(retailerMatchesSearch({ name: "Kroger", address: null }, "kroger 42301")).toBe(false);
  });
});

describe("retailerOptionLabel", () => {
  it("adds the address so same-name stores are distinguishable", () => {
    expect(
      retailerOptionLabel({ name: "Shell", address: "3815 Carter Rd, Owensboro, KY 42301" }),
    ).toBe("Shell · 3815 Carter Rd, Owensboro, KY 42301");
  });

  it("keeps national banners without an address as just the name", () => {
    expect(retailerOptionLabel({ name: "Total Wine", address: null })).toBe("Total Wine");
    expect(retailerOptionLabel({ name: "Kroger", address: "  " })).toBe("Kroger");
  });

  it("does not repeat an address already in the name", () => {
    expect(
      retailerOptionLabel({ name: "BP - 12 Main St", address: "12 Main St" }),
    ).toBe("BP - 12 Main St");
  });
});
