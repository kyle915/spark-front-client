import { describe, expect, it } from "vitest";
import { tenantDisplayName } from "./tenantDisplayName";

describe("tenantDisplayName", () => {
  it("prefers the tenant slug", () => {
    expect(tenantDisplayName("gfkv-pivot-energy-drink", "pivot-energy-drink")).toBe("Pivot Energy Drink");
  });
  it("strips the 4-char code prefix from a request-form slug", () => {
    expect(tenantDisplayName("gfkv-pivot-energy-drink")).toBe("Pivot Energy Drink");
  });
  it("upper-cases known short tokens", () => {
    expect(tenantDisplayName(null, "torch-thc")).toBe("Torch THC");
  });
  it("returns empty for nothing", () => {
    expect(tenantDisplayName(null, null)).toBe("");
  });
});
