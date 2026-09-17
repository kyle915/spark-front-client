import { describe, expect, it } from "vitest";
import {
  ABSURD_PCT_THRESHOLD,
  computePeriodDelta,
  formatPeriodDeltaLabel,
  periodDeltaIsNegative,
  periodDeltaNote,
} from "./periodDelta";

describe("computePeriodDelta", () => {
  it("returns normal up / down / flat percentages", () => {
    expect(computePeriodDelta(112, 100)).toEqual({ kind: "up", pct: 12 });
    expect(computePeriodDelta(92, 100)).toEqual({ kind: "down", pct: -8 });
    expect(computePeriodDelta(100, 100)).toEqual({ kind: "flat", pct: 0 });
  });

  it("labels a zero-base start as New, not a %", () => {
    expect(computePeriodDelta(50, 0)).toEqual({ kind: "new" });
    expect(computePeriodDelta(0, 0)).toEqual({ kind: "none" });
  });

  it("suppresses absurd MoM like 2886% off a sparse prior", () => {
    // 5 → 149 ≈ 2880% — classic bulk-import / collection-change swing
    const d = computePeriodDelta(149, 5);
    expect(d.kind).toBe("sparse");
    if (d.kind === "sparse") {
      expect(d.label).toBe("n/a");
      expect(d.note).toMatch(/sparse|collection/i);
    }
  });

  it("caps wild swings off a solid prior instead of printing 3481%", () => {
    // 100 → 3581 = +3481% — prior is large enough to compute, but absurd
    const d = computePeriodDelta(3581, 100);
    expect(d.kind).toBe("large");
    if (d.kind === "large") {
      expect(d.direction).toBe("up");
      expect(d.cappedPct).toBe(ABSURD_PCT_THRESHOLD);
      expect(d.rawPct).toBe(3481);
      expect(d.note).toMatch(/new collection|organic growth/i);
    }
  });

  it("keeps steep but plausible downs as normal percentages", () => {
    // Count KPIs can't fall more than 100% to zero — so the absurd-cap is
    // an upside / collection-change gate, not a down gate.
    expect(computePeriodDelta(10, 1000)).toEqual({ kind: "down", pct: -99 });
    expect(computePeriodDelta(0, 100)).toEqual({ kind: "down", pct: -100 });
  });

  it("keeps a healthy 2x move as a normal percentage", () => {
    expect(computePeriodDelta(200, 100)).toEqual({ kind: "up", pct: 100 });
    expect(computePeriodDelta(400, 100)).toEqual({ kind: "up", pct: 300 });
    // exactly at the threshold stays normal; only *above* 500% is capped
    expect(computePeriodDelta(600, 100)).toEqual({ kind: "up", pct: 500 });
  });
});

describe("periodDeltaNote", () => {
  it("only footnotes sparse / large deltas", () => {
    expect(periodDeltaNote({ kind: "up", pct: 12 })).toBeNull();
    expect(periodDeltaNote({ kind: "new" })).toBeNull();
    expect(
      periodDeltaNote({
        kind: "sparse",
        label: "n/a",
        note: "n/a — base period sparse / collection changed",
      }),
    ).toMatch(/sparse/);
  });
});

describe("formatPeriodDeltaLabel", () => {
  it("formats honest chips", () => {
    expect(formatPeriodDeltaLabel({ kind: "up", pct: 12 })).toBe("↑ 12%");
    expect(formatPeriodDeltaLabel({ kind: "down", pct: -8 })).toBe("↓ 8%");
    expect(formatPeriodDeltaLabel({ kind: "new" })).toBe("New");
    expect(
      formatPeriodDeltaLabel({
        kind: "large",
        direction: "up",
        cappedPct: 500,
        rawPct: 900,
        note: "x",
      }),
    ).toBe("↑ >500%");
    expect(periodDeltaIsNegative({ kind: "down", pct: -3 })).toBe(true);
    expect(periodDeltaIsNegative({ kind: "up", pct: 3 })).toBe(false);
  });
});
