import { describe, expect, it } from "vitest";
import { conversionFigure } from "./conversionTile";

describe("conversion tile", () => {
  it("shows a finite rate when people were sampled", () => {
    expect(conversionFigure(24, 100, 24)).toBe("24%");
    expect(conversionFigure(0, 100, 0)).toBe("0%");
    expect(conversionFigure(0, 100, null)).toBe("0%");
  });

  it("stays blank when nothing was sampled", () => {
    expect(conversionFigure(0, 0, null)).toBe("—");
    expect(conversionFigure(4, 0, null)).toBe("—");
  });
});
