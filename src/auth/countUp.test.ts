import { describe, expect, it } from "vitest";
import { countUpText } from "./countUp";

describe("countUpText", () => {
  it("starts at zero and lands exactly on the figure", () => {
    expect(countUpText("257K+", 0)).toBe("0K+");
    expect(countUpText("257K+", 1)).toBe("257K+");
    expect(countUpText("48 hr", 1)).toBe("48 hr");
  });

  it("only ever moves the number, and never overshoots", () => {
    for (const p of [0.1, 0.4, 0.8, 0.99]) {
      const shown = countUpText("257K+", p);
      expect(shown.endsWith("K+")).toBe(true);
      expect(Number.parseInt(shown, 10)).toBeLessThanOrEqual(257);
    }
    expect(countUpText("50", 2)).toBe("50");
  });

  it("leaves text without a number alone", () => {
    expect(countUpText("Nationwide", 0.3)).toBe("Nationwide");
  });
});
