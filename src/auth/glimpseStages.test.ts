import { describe, expect, it } from "vitest";
import { GLIMPSE_ROWS, glimpseLabel, glimpseStages } from "./glimpseStages";

describe("sign-in glimpse", () => {
  it("starts with every shift booked", () => {
    expect(glimpseStages(0)).toEqual(["booked", "booked", "booked"]);
  });

  it("moves one row at a time and never backwards within a cycle", () => {
    const rank = { booked: 0, on_clock: 1, recapped: 2 } as const;
    let prev = glimpseStages(0);
    for (let tick = 1; tick <= 6; tick += 1) {
      const next = glimpseStages(tick);
      const changed = next.filter((s, i) => s !== prev[i]).length;
      expect(changed).toBe(1);
      next.forEach((s, i) => expect(rank[s]).toBeGreaterThanOrEqual(rank[prev[i]]));
      prev = next;
    }
    expect(prev).toEqual(["recapped", "recapped", "recapped"]);
  });

  it("holds the finished board, then starts over", () => {
    expect(glimpseStages(8)).toEqual(["recapped", "recapped", "recapped"]);
    expect(glimpseStages(9)).toEqual(["booked", "booked", "booked"]);
  });

  it("labels each stage in plain words", () => {
    const row = GLIMPSE_ROWS[0];
    expect(glimpseLabel("booked", row)).toBe("Starts 2:00 PM");
    expect(glimpseLabel("on_clock", row)).toBe("On the clock");
    expect(glimpseLabel("recapped", row)).toBe("Recap in · 84 sampled");
  });
});
