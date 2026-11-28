import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("TrackerSavedViews light/dark theme polish", () => {
  it("uses Spark light/dark surface tokens with zero hardcoded dark hex styles", () => {
    const src = readFileSync(resolve(__dirname, "./TrackerSavedViews.tsx"), "utf8");
    expect(src).toContain("var(--spark-surface)");
    expect(src).toContain("var(--spark-surface-2)");
    expect(src).toContain("var(--spark-text)");
    expect(src).toContain("var(--spark-border)");
    expect(src).toContain("var(--spark-elev-2)");
    expect(src).toContain("right-0");
    expect(src).toContain('e.key === "Escape"');
    expect(src).toContain("mousedown");

    expect(src).not.toContain("#11150f");
    expect(src).not.toContain("#1f2418");
    expect(src).not.toContain('color: "#fff"');
    expect(src).not.toContain("rgba(0,0,0,0.55)");
  });
});
