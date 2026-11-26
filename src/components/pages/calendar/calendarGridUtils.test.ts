import { describe, it, expect } from "vitest";
import {
  computeCalendarHourBounds,
  buildScheduleHref,
  calendarQueryWindow,
  stepCalendarAnchor,
  monthGridDays,
  ymdOf,
} from "./calendarGridUtils";

describe("computeCalendarHourBounds", () => {
  it("returns defaults when shifts is empty", () => {
    const { hourStart, hourEnd } = computeCalendarHourBounds([]);
    expect(hourStart).toBe(7);
    expect(hourEnd).toBe(23);
  });

  it("expands to accommodate early-morning shift", () => {
    const { hourStart, hourEnd } = computeCalendarHourBounds([
      { startHour: 5.5, endHour: 9 },
    ]);
    expect(hourStart).toBe(5);
    expect(hourEnd).toBe(23);
  });

  it("expands to accommodate late-night shift", () => {
    const { hourStart, hourEnd } = computeCalendarHourBounds([
      { startHour: 20, endHour: 23.5 },
    ]);
    expect(hourStart).toBe(7);
    expect(hourEnd).toBe(24);
  });

  it("caps hourEnd at 24", () => {
    const { hourEnd } = computeCalendarHourBounds([{ startHour: 23, endHour: 25 }]);
    expect(hourEnd).toBe(24);
  });

  it("caps hourStart at 0", () => {
    const { hourStart } = computeCalendarHourBounds([{ startHour: -1, endHour: 8 }]);
    expect(hourStart).toBe(0);
  });
});

describe("buildScheduleHref", () => {
  it("builds href with date only when no hour given", () => {
    const day = new Date(2026, 4, 29); // May 29
    const href = buildScheduleHref(day);
    expect(href).toContain("date=2026-05-29");
    expect(href).not.toContain("startTime");
  });

  it("includes startTime and endTime +3h when hour given", () => {
    const day = new Date(2026, 4, 29);
    const href = buildScheduleHref(day, 10);
    expect(href).toContain("startTime=10%3A00");
    expect(href).toContain("endTime=13%3A00");
  });

  it("clamps endTime to 23:00 for late-day slots", () => {
    const day = new Date(2026, 4, 29);
    const href = buildScheduleHref(day, 22);
    expect(href).toContain("endTime=23%3A00");
  });
});

describe("stepCalendarAnchor", () => {
  const anchor = new Date(2026, 4, 29); // May 29

  it("steps by 1 day in day view", () => {
    const next = stepCalendarAnchor(anchor, "day", 1);
    expect(ymdOf(next)).toBe("2026-05-30");
  });

  it("steps by 7 days in week view", () => {
    const next = stepCalendarAnchor(anchor, "week", 1);
    expect(ymdOf(next)).toBe("2026-06-05");
  });

  it("steps by 1 month in month view", () => {
    const next = stepCalendarAnchor(anchor, "month", 1);
    expect(next.getMonth()).toBe(5); // June
    expect(next.getFullYear()).toBe(2026);
  });

  it("steps backward in month view", () => {
    const next = stepCalendarAnchor(anchor, "month", -1);
    expect(next.getMonth()).toBe(3); // April
  });

  it("clamps to last day when stepping to shorter month", () => {
    const march31 = new Date(2026, 2, 31);
    const next = stepCalendarAnchor(march31, "month", 1); // April has 30 days
    expect(next.getMonth()).toBe(3); // April
    expect(next.getDate()).toBe(30);
  });
});

describe("monthGridDays", () => {
  it("starts on Monday for a month beginning on Wednesday", () => {
    // May 2026: starts on Friday
    const anchor = new Date(2026, 4, 1);
    const days = monthGridDays(anchor);
    // first day in grid should be Monday (day=1)
    expect(days[0].getDay()).toBe(1);
  });

  it("last grid day has day=0 (Sunday)", () => {
    const anchor = new Date(2026, 4, 1);
    const days = monthGridDays(anchor);
    expect(days[days.length - 1].getDay()).toBe(0);
  });

  it("contains all days of the month", () => {
    const anchor = new Date(2026, 4, 1);
    const days = monthGridDays(anchor);
    const inMonth = days.filter((d) => d.getMonth() === 4);
    expect(inMonth.length).toBe(31); // May has 31 days
  });
});

describe("calendarQueryWindow", () => {
  const anchor = new Date(2026, 4, 29);

  it("day view returns 1 visible day", () => {
    const { visibleDays } = calendarQueryWindow(anchor, "day");
    expect(visibleDays.length).toBe(1);
  });

  it("week view returns 7 visible days", () => {
    const { visibleDays } = calendarQueryWindow(anchor, "week");
    expect(visibleDays.length).toBe(7);
  });

  it("startDate is 1 day before first visible day", () => {
    const { visibleDays, startDate } = calendarQueryWindow(anchor, "day");
    const expectedStart = new Date(visibleDays[0]);
    expectedStart.setDate(expectedStart.getDate() - 1);
    expect(startDate).toBe(ymdOf(expectedStart));
  });
});
