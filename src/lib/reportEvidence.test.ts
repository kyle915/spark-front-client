import { describe, expect, it } from "vitest";
import { leadThemes } from "./reportEvidence";
import type { ThemeRow } from "./feedbackThemes";

const theme = (partial: Partial<ThemeRow> & Pick<ThemeRow, "section" | "label">): ThemeRow => ({
  recapCount: 1,
  quote: "",
  ...partial,
});

describe("leadThemes", () => {
  it("keeps the largest theme in each section, in section order", () => {
    const rows = [
      theme({ section: "liked", label: "Citrus", recapCount: 4 }),
      theme({ section: "liked", label: "Cold", recapCount: 9 }),
      theme({ section: "asked", label: "Where to buy", recapCount: 2 }),
      theme({ section: "passed", label: "Price", recapCount: 3 }),
      theme({ section: "passed", label: "Sweet", recapCount: 1 }),
    ];
    expect(leadThemes(rows).map((row) => row.label)).toEqual([
      "Cold",
      "Price",
      "Where to buy",
    ]);
  });

  it("drops a section with nothing to show", () => {
    expect(leadThemes([theme({ section: "liked", label: "Citrus", recapCount: 2 })])).toEqual([
      theme({ section: "liked", label: "Citrus", recapCount: 2 }),
    ]);
    expect(leadThemes([theme({ section: "liked", label: "Nope", recapCount: 0 })])).toEqual([]);
  });
});
