import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("collapsible 64px sidebar rail and hub consolidation", () => {
  const sidebar = read("src/layout/SparkSidebar.tsx");
  const nav = read("src/layout/MobileNavContext.tsx");

  it("supports the 64px desktop icon rail (`md:w-16`) while preserving mobile w-64 drawer", () => {
    expect(sidebar).toContain("w-64");
    expect(sidebar).toContain("md:w-16 is-collapsed");
    expect(sidebar).toContain('src="/legal/spark-logo.png"');
    expect(sidebar).toContain('alt="Spark by Ignite"');
    expect(sidebar).toContain("Collapse sidebar ([)");
    expect(sidebar).toContain("Expand sidebar ([)");
  });

  it("persists collapsed preference and binds the `[` keyboard shortcut outside inputs", () => {
    expect(nav).toContain('export const COLLAPSE_KEY = "spark-sidebar-collapsed"');
    expect(nav).toContain("localStorage.getItem(COLLAPSE_KEY)");
    expect(nav).toContain("localStorage.setItem(COLLAPSE_KEY");
    expect(nav).toContain('e.key === "["');
    expect(nav).toContain("toggleCollapsed");
  });
});
