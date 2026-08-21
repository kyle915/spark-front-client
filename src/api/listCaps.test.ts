import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function src(rel: string) {
  return readFileSync(join(here, rel), "utf8");
}

describe("list fetch caps (no silent truncation)", () => {
  it("tenant switcher asks for 500 tenants (API max)", () => {
    expect(src("./queries/TenantQuery.ts")).toContain("first: 500");
    expect(src("./queries/TenantCheckinCodeQuery.ts")).toContain("first: 500");
  });

  it("account map pin fetch uses the API ceiling of 2000", () => {
    expect(src("../components/pages/map/SparkAccountMap.tsx")).toContain(
      "first: 2000",
    );
  });

  it("sidebar badges do not download the 2000-request list", () => {
    expect(src("../hooks/useSidebarCounts.ts")).not.toContain("first: 2000");
    expect(src("./queries/SidebarCountsQuery.ts")).toContain(
      "sidebarRequestCounts",
    );
  });

  it("recap product pickers request 1000 SKUs", () => {
    expect(src("../recap/RecapCustomView.tsx")).toContain("first: 1000");
    expect(src("../recap/SparkRecapCreate.tsx")).toContain("first: 1000");
  });
});
