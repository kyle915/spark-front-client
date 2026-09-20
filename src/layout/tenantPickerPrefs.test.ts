import { afterEach, describe, expect, it } from "vitest";
import {
  clearTenantFavorites,
  clearTenantRecents,
  groupTenantsByLetter,
  loadTenantFavorites,
  loadTenantRecents,
  rememberTenantRecent,
  tenantLetter,
  tenantMatchesQuery,
  toggleTenantFavorite,
} from "./tenantPickerPrefs";

afterEach(() => {
  clearTenantRecents();
  clearTenantFavorites();
});

describe("tenantPickerPrefs", () => {
  it("keeps last 5 recents and moves an existing uuid to the front", () => {
    for (let i = 0; i < 7; i += 1) {
      rememberTenantRecent(`tenant-${i}`);
    }
    rememberTenantRecent("tenant-5");
    const recents = loadTenantRecents();
    expect(recents).toHaveLength(5);
    expect(recents[0]).toBe("tenant-5");
    expect(recents).not.toContain("tenant-0");
    expect(recents).not.toContain("tenant-1");
  });

  it("pins up to 8 favorites and toggles off", () => {
    for (let i = 0; i < 10; i += 1) {
      toggleTenantFavorite(`fav-${i}`);
    }
    expect(loadTenantFavorites()).toHaveLength(8);
    expect(loadTenantFavorites()[0]).toBe("fav-9");
    toggleTenantFavorite("fav-9");
    expect(loadTenantFavorites()).not.toContain("fav-9");
  });

  it("matches name and slug", () => {
    const torch = {
      name: "Torch THC",
      tenantSlug: "keee-torch-thc",
      requestUrlName: "torch",
    };
    expect(tenantMatchesQuery(torch, "torch")).toBe(true);
    expect(tenantMatchesQuery(torch, "keee")).toBe(true);
    expect(tenantMatchesQuery(torch, "liquid")).toBe(false);
  });

  it("groups A–Z with sticky letter buckets", () => {
    expect(tenantLetter("Liquid Death")).toBe("L");
    expect(tenantLetter("123 Brand")).toBe("#");
    const groups = groupTenantsByLetter([
      { name: "Torch THC" },
      { name: "Liquid Death" },
      { name: "Kalshi" },
      { name: "Liquid Death Events" },
    ]);
    expect(groups.map((g) => g.letter)).toEqual(["K", "L", "T"]);
    expect(groups.find((g) => g.letter === "L")?.tenants).toHaveLength(2);
  });
});
