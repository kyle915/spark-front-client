import { describe, expect, it } from "vitest";
import { layoutOverlappingShifts } from "./layoutOverlappingShifts";

describe("layoutOverlappingShifts", () => {
  it("gives a lone block full width", () => {
    const out = layoutOverlappingShifts([
      { id: "a", startHour: 9, endHour: 11 },
    ]);
    expect(out).toEqual([{ id: "a", startHour: 9, endHour: 11, col: 0, cols: 1 }]);
  });

  it("packs concurrent blocks into side-by-side columns", () => {
    const out = layoutOverlappingShifts([
      { id: "a", startHour: 9, endHour: 12 },
      { id: "b", startHour: 10, endHour: 11 },
      { id: "c", startHour: 10.5, endHour: 13 },
    ]);
    expect(out.map((b) => ({ id: b.id, col: b.col, cols: b.cols }))).toEqual([
      { id: "a", col: 0, cols: 3 },
      { id: "b", col: 1, cols: 3 },
      { id: "c", col: 2, cols: 3 },
    ]);
  });

  it("reuses a column after the prior block ends", () => {
    const out = layoutOverlappingShifts([
      { id: "a", startHour: 7, endHour: 9 },
      { id: "b", startHour: 9, endHour: 11 },
      { id: "c", startHour: 8, endHour: 10 },
    ]);
    // a and b do not overlap; c overlaps both → 2 columns, b reuses a's column
    const byId = Object.fromEntries(out.map((b) => [b.id, b]));
    expect(byId.a.cols).toBe(2);
    expect(byId.b.cols).toBe(2);
    expect(byId.c.cols).toBe(2);
    expect(byId.a.col).toBe(0);
    expect(byId.c.col).toBe(1);
    expect(byId.b.col).toBe(0);
  });

  it("keeps non-overlapping clusters independent", () => {
    const out = layoutOverlappingShifts([
      { id: "morning", startHour: 7, endHour: 9 },
      { id: "afternoon", startHour: 12, endHour: 14 },
    ]);
    expect(out.every((b) => b.cols === 1 && b.col === 0)).toBe(true);
  });
});
