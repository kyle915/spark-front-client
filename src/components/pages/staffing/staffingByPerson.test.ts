import { describe, expect, it } from "vitest";
import {
  byPersonRows,
  staffingFooter,
  UNASSIGNED_KEY,
  type BoardShiftLike,
} from "./staffingByPerson";

const shift = (over: Partial<BoardShiftLike> & { eventUuid: string }): BoardShiftLike => ({
  brandName: "Famus Energy",
  date: "2026-11-13T12:00:00+00:00",
  isStaffed: true,
  assigned: [],
  ...over,
});

const person = (uuid: string, name: string, isApproved = true) => ({
  ambassadorUuid: uuid,
  name,
  isApproved,
});

describe("byPersonRows", () => {
  it("gathers open shifts first, then people by name, a shift per booked person", () => {
    const { rows, counts } = byPersonRows([
      shift({ eventUuid: "open", isStaffed: false }),
      shift({
        eventUuid: "pair",
        assigned: [person("b", "Zoe Park"), person("a", "Ana Diaz", false)],
      }),
      shift({
        eventUuid: "solo",
        date: "2026-11-14T12:00:00+00:00",
        assigned: [person("a", "Ana Diaz")],
      }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Needs someone", "Ana Diaz", "Zoe Park"]);
    expect(rows[0]).toMatchObject({ key: UNASSIGNED_KEY, unassigned: true, total: 1 });
    const ana = rows[1];
    expect(ana.total).toBe(2);
    expect(ana.byDay.get("2026-11-13")?.map((s) => s.eventUuid)).toEqual(["pair"]);
    expect(ana.byDay.get("2026-11-14")?.map((s) => s.eventUuid)).toEqual(["solo"]);
    expect([...ana.pending]).toEqual(["pair"]);
    expect([...rows[2].pending]).toEqual([]);
    expect(counts).toEqual({ unstaffed: 1, staffed: 2, people: 2 });
  });

  it("keeps a part-staffed shift in both the open row and the person's row", () => {
    const { rows, counts } = byPersonRows([
      shift({ eventUuid: "half", isStaffed: false, assigned: [person("a", "Ana Diaz")] }),
    ]);
    expect(rows.map((r) => r.key)).toEqual([UNASSIGNED_KEY, "a"]);
    expect(counts).toEqual({ unstaffed: 1, staffed: 0, people: 1 });
  });

  it("has no open row when everything is staffed, and skips undated shifts", () => {
    const { rows } = byPersonRows([
      shift({ eventUuid: "ok", assigned: [person("a", "")] }),
      shift({ eventUuid: "undated", date: null, assigned: [person("a", "")] }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Unnamed ambassador", total: 1 });
  });
});

describe("staffingFooter", () => {
  it("reads as a sentence", () => {
    expect(staffingFooter({ unstaffed: 325, staffed: 57, people: 23 })).toBe(
      "325 shifts need someone · 57 staffed · 23 people booked",
    );
    expect(staffingFooter({ unstaffed: 1, staffed: 0, people: 1 })).toBe(
      "1 shift needs someone · 0 staffed · 1 person booked",
    );
    expect(staffingFooter({ unstaffed: 0, staffed: 8, people: 3 })).toBe(
      "Every shift is staffed · 8 staffed · 3 people booked",
    );
  });
});
