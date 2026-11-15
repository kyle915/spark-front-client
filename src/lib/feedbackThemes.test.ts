import { describe, expect, it } from "vitest";
import { recapsLabel, themeBars, themeSections, themesBasis } from "./feedbackThemes";

const theme = (section: string, label: string, recapCount: number) => ({
  section,
  label,
  recapCount,
  quote: `${label} quote`,
});

describe("themeSections", () => {
  it("keeps the three sections in order, largest theme first", () => {
    const sections = themeSections([
      theme("asked", "Where to buy", 4),
      theme("liked", "Low sugar", 3),
      theme("passed", "Price", 6),
      theme("liked", "Citrus flavor", 9),
    ]);
    expect(sections.map((s) => s.title)).toEqual([
      "What people liked",
      "Why people passed",
      "Questions people asked",
    ]);
    expect(sections[0].themes.map((t) => t.label)).toEqual(["Citrus flavor", "Low sugar"]);
  });

  it("leaves out an empty section, an unknown one and an uncounted theme", () => {
    const sections = themeSections([
      theme("liked", "Taste", 2),
      theme("elsewhere", "Nope", 5),
      theme("passed", "Price", 0),
      theme("asked", "  ", 3),
    ]);
    expect(sections.map((s) => s.key)).toEqual(["liked"]);
  });

  it("keeps the incoming order on a tie", () => {
    const sections = themeSections([theme("liked", "B", 2), theme("liked", "A", 2)]);
    expect(sections[0].themes.map((t) => t.label)).toEqual(["B", "A"]);
  });
});

describe("themeBars", () => {
  it("ranks every theme by recaps, across sections", () => {
    expect(
      themeBars([theme("liked", "Taste", 3), theme("passed", "Price", 7), theme("asked", "Skip", 0)]),
    ).toEqual([
      { label: "Price", value: 7 },
      { label: "Taste", value: 3 },
    ]);
  });
});

describe("themesBasis", () => {
  it("says where the themes came from, in the singular when it is one", () => {
    expect(themesBasis(42, 18)).toBe(
      "Grouped by AI from 42 comments on 18 approved recaps. Each count is the recaps that mention a theme.",
    );
    expect(themesBasis(1, 1)).toContain("from 1 comment on 1 approved recap.");
    expect(themesBasis(150, 60, true)).toContain("from the most recent 150 comments");
    expect(recapsLabel(1)).toBe("1 recap");
    expect(recapsLabel(1200)).toBe("1,200 recaps");
  });
});
