import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTER,
  dayLabel,
  filterChips,
  filterFromServer,
  freeLabel,
  isEmptyFilter,
  matchReasons,
  toFilterInput,
  withoutChip,
} from "./staffingSearch";

const read = filterFromServer({
  retailer: "Total Wine",
  city: "Houston",
  state: null,
  brand: null,
  dateFrom: "2026-11-21",
  dateTo: "2026-11-21",
  minShifts: 1,
  mustBeFree: true,
});

describe("filter chips", () => {
  it("shows how the question was read", () => {
    expect(filterChips(read).map((c) => c.text)).toEqual([
      "Store: Total Wine",
      "City: Houston",
      "Free on: Sat 21 Nov",
    ]);
  });

  it("names a range, a plain day, a state and a shift minimum", () => {
    const chips = filterChips({
      ...EMPTY_FILTER,
      state: "tx",
      brand: "Liquid Death",
      dateFrom: "2026-11-21",
      dateTo: "2026-11-22",
      minShifts: 3,
    });
    expect(chips.map((c) => c.text)).toEqual([
      "State: TX",
      "Brand: Liquid Death",
      "Day: Sat 21 Nov to Sun 22 Nov",
      "At least 3 shifts worked",
    ]);
  });

  it("removing the day also drops must-be-free", () => {
    const next = withoutChip(read, "date");
    expect(next.dateFrom).toBe("");
    expect(next.mustBeFree).toBe(false);
    expect(filterChips(next).map((c) => c.key)).toEqual(["retailer", "city"]);
    expect(withoutChip(read, "retailer").retailer).toBe("");
  });
});

describe("filter input", () => {
  it("sends blanks as null and one day as both ends", () => {
    expect(
      toFilterInput({ ...EMPTY_FILTER, retailer: "  Kroger ", dateFrom: "2026-11-21", mustBeFree: true }),
    ).toEqual({
      retailer: "Kroger",
      city: null,
      state: null,
      brand: null,
      dateFrom: "2026-11-21",
      dateTo: "2026-11-21",
      minShifts: null,
      mustBeFree: true,
    });
  });

  it("ignores must-be-free and bad dates when there is no real day", () => {
    const input = toFilterInput({ ...EMPTY_FILTER, dateFrom: "Saturday", mustBeFree: true });
    expect(input.dateFrom).toBeNull();
    expect(input.mustBeFree).toBe(false);
  });

  it("knows an empty filter", () => {
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true);
    expect(isEmptyFilter({ ...EMPTY_FILTER, city: " " })).toBe(true);
    expect(isEmptyFilter({ ...EMPTY_FILTER, city: "Houston" })).toBe(false);
    expect(isEmptyFilter(filterFromServer(null))).toBe(true);
  });
});

describe("day label", () => {
  it("reads the calendar day without a zone shift", () => {
    expect(dayLabel("2026-11-21")).toBe("Sat 21 Nov");
    expect(dayLabel("2026-01-01T00:00:00+00:00")).toBe("Thu 1 Jan");
    expect(dayLabel("")).toBe("");
    expect(dayLabel(null)).toBe("");
    expect(dayLabel("soon")).toBe("");
  });
});

describe("match reasons", () => {
  const base = {
    shiftsWorked: 2,
    stores: ["Total Wine & More"],
    cities: ["Houston"],
    lastShiftDate: "2026-11-06",
    isFree: true,
    availability: null,
    conflicts: [],
  };

  it("says what they worked and when they last worked", () => {
    expect(matchReasons(base)).toEqual([
      "Clocked in to 2 shifts · Total Wine & More · Houston",
      "Last clocked in Fri 6 Nov",
    ]);
    expect(freeLabel(base)).toBe("Free");
  });

  it("lists a booking and an unconfirmed invite on the asked day", () => {
    const lines = matchReasons({
      ...base,
      shiftsWorked: 1,
      isFree: false,
      availability: "not_listed",
      conflicts: [
        {
          eventName: "Saturday demo",
          brandName: "Feel Free",
          store: "Kroger",
          date: "2026-11-21",
          startLocal: "2026-11-21T16:00:00",
          isApproved: true,
        },
        {
          eventName: "Pop-up",
          brandName: "",
          store: null,
          date: "2026-11-21",
          startLocal: null,
          isApproved: false,
        },
      ],
    });
    expect(lines).toEqual([
      "Clocked in to 1 shift · Total Wine & More · Houston",
      "Last clocked in Fri 6 Nov",
      "Booked Sat 21 Nov 4:00 PM: Kroger, Feel Free",
      "Invited, not confirmed Sat 21 Nov: Pop-up",
      "Has not listed that day as available",
    ]);
    expect(freeLabel({ isFree: false })).toBe("Booked");
    expect(freeLabel({ isFree: null })).toBe("");
  });
});
