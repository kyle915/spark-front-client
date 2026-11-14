import { describe, expect, it } from "vitest";
import { periodChange } from "./periodChange";

const count = (n: number) => n.toLocaleString("en-US");
const pct = (n: number) => `${n.toFixed(0)}%`;

describe("periodChange", () => {
  it("states both real numbers, up or down", () => {
    expect(
      periodChange({ current: 1445, previous: 1210, previousEvents: 9, format: count, days: 30 }),
    ).toBe("up from 1,210 in the 30 days before");
    expect(
      periodChange({ current: 8, previous: 12, previousEvents: 12, format: count, days: 30 }),
    ).toBe("down from 12 in the 30 days before");
  });

  it("calls figures that print the same level", () => {
    expect(
      periodChange({ current: 61.6, previous: 62.4, previousEvents: 5, format: pct, days: 30 }),
    ).toBe("same as the 30 days before");
  });

  it("says nothing without an earlier window to compare", () => {
    expect(
      periodChange({ current: 40, previous: 0, previousEvents: 0, format: count, days: 30 }),
    ).toBeNull();
    expect(
      periodChange({ current: 40, previous: null, previousEvents: 4, format: count, days: 30 }),
    ).toBeNull();
    expect(
      periodChange({ current: null, previous: 10, previousEvents: 4, format: count, days: 30 }),
    ).toBeNull();
  });
});
