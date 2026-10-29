import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("light-paper selected Sample format / SKU chips", () => {
  const css = readFileSync(join(root, "src/index.css"), "utf8");
  const view = readFileSync(join(root, "src/recap/RecapCustomView.tsx"), "utf8");
  const checkin = readFileSync(
    join(root, "src/components/pages/checkin/SparkCheckin.tsx"),
    "utf8",
  );
  const fieldRows = readFileSync(
    join(root, "src/recap/RecapFieldRows.tsx"),
    "utf8",
  );

  it("styles choice chips with the same green selected fill as program chips", () => {
    expect(css).toContain(".recap-choice-chip");
    expect(css).toContain(".recap-option-chip.is-selected");
    expect(css).toMatch(
      /\.recap-choice-chip,\s*\n\.recap-option-chip\.is-selected\s*\{[\s\S]*?background:\s*#d9efb8/,
    );
    expect(css).toContain("color: #1f3d0a");
    expect(css).not.toMatch(
      /\.recap-choice-chip\s*\{[\s\S]*?background:\s*#ffffff/,
    );
  });

  it("toggles edit-mode options with recap-option-chip, not washed spark-lime", () => {
    expect(view).toContain("recap-option-chip");
    expect(view).toContain("is-selected");
    expect(view).not.toMatch(
      /style=\{isOn \? limeBtn : ghostBtn\}/,
    );
  });

  it("uses green selected classes on walk-up multiselect chips", () => {
    expect(checkin).toContain("recap-option-chip");
    expect(checkin).toContain("is-selected");
    expect(checkin).not.toMatch(
      /background:\s*on\s*\?\s*accent\s*:\s*"transparent"/,
    );
  });

  it("keeps RecapChoiceChip on the green paper class", () => {
    expect(fieldRows).toContain('className="recap-choice-chip"');
  });
});
