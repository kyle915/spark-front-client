import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("collapsed sidebar icon rail", () => {
  const sidebar = read("src/layout/SparkSidebar.tsx");
  const css = read("src/index.css");

  it("uses the spark glyph when collapsed and the wordmark when expanded", () => {
    expect(sidebar).toContain('className="spark-sidebar-glyph"');
    expect(sidebar).toContain('src="/legal/spark-logo.png"');
    expect(sidebar).not.toContain('width: iconRail ? "2.4rem"');
    expect(sidebar).toContain("aria-label={label}");
  });

  it("keeps a 4.5rem rail with 36px targets, a lime active chip, and a portaled tip", () => {
    expect(css).toContain(".spark-sidebar.is-collapsed {\n  width: 4.5rem;");
    expect(css).toContain("width: 36px;");
    expect(css).toContain("height: 36px;");
    expect(css).toContain("rgba(197, 245, 70, 0.16)");
    expect(css).toContain(".spark-rail-tip");
    expect(css).toContain("JetBrains Mono");
    expect(css).toContain(".spark-rail-dot");
    expect(sidebar).toContain("spark-rail-section");
    expect(sidebar).toContain("spark-sidebar-footer");
    expect(sidebar).toContain("<RailTip");
  });
});
