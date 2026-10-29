import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("recap paper selected program chip", () => {
  const view = readFileSync(join(root, "src/recap/RecapCustomView.tsx"), "utf8");
  const css = readFileSync(join(root, "src/index.css"), "utf8");

  it("marks the program title selected on the light paper", () => {
    expect(view).toContain('className="chip recap-program-chip is-selected"');
  });

  it("uses a green selected treatment scoped to recap paper", () => {
    expect(css).toContain(".recap-doc .recap-program-chip.is-selected");
    expect(css).toContain("background: #d9efb8");
    expect(css).not.toMatch(/\.spark-sidebar \.recap-program-chip/);
  });
});
