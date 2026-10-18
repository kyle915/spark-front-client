import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("sidebar stays expanded", () => {
  const sidebar = read("src/layout/SparkSidebar.tsx");
  const topbar = read("src/layout/SparkTopbar.tsx");
  const nav = read("src/layout/MobileNavContext.tsx");

  it("keeps the w-64 wordmark and never applies the icon rail", () => {
    expect(sidebar).toContain("w-64");
    expect(sidebar).not.toContain("is-collapsed");
    expect(sidebar).not.toContain("iconRail");
    expect(sidebar).not.toContain("w-[4.5rem]");
    expect(sidebar).toContain('src="/legal/spark-logo.png"');
    expect(sidebar).toContain('alt="Spark by Ignite"');
    expect(sidebar).not.toContain("spark-sidebar-glyph");
  });

  it("has no desktop collapse control", () => {
    expect(sidebar).not.toContain("PanelLeft");
    expect(sidebar).not.toContain("Collapse sidebar");
    expect(sidebar).not.toContain("toggleCollapsed");
    expect(topbar).not.toContain("Collapse sidebar");
    expect(topbar).not.toContain("toggleCollapsed");
    expect(sidebar).toContain('aria-label="Close menu"');
    expect(topbar).toContain('aria-label="Open menu"');
  });

  it("clears the stored collapse flag and does not read it back", () => {
    expect(nav).toContain('const COLLAPSE_KEY = "spark-sidebar-collapsed"');
    expect(nav).toContain("localStorage.removeItem(COLLAPSE_KEY)");
    expect(nav).not.toContain("localStorage.getItem");
    expect(nav).not.toContain("setCollapsed");
    expect(nav).not.toContain("toggleCollapsed");
  });
});
