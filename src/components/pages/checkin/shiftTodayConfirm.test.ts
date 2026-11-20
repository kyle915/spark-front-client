import { describe, expect, it } from "vitest";

import {
  formatShiftDay,
  needsShiftTodayConfirm,
  shiftTodayQuestion,
  withShiftTodayConfirmed,
} from "./shiftTodayConfirm";

describe("needsShiftTodayConfirm", () => {
  it("is the API's 400 confirm_shift_today answer only", () => {
    expect(needsShiftTodayConfirm(400, { error: "confirm_shift_today", message: "x" })).toBe(true);
    expect(needsShiftTodayConfirm(400, { error: "invalid", message: "Enter the store name." })).toBe(false);
    expect(needsShiftTodayConfirm(200, { error: "confirm_shift_today" })).toBe(false);
    expect(needsShiftTodayConfirm(400, null)).toBe(false);
  });
});

describe("shiftTodayQuestion", () => {
  it("names today with its weekday", () => {
    expect(formatShiftDay("2026-11-19")).toBe("Thursday, November 19");
    expect(shiftTodayQuestion("2026-11-19", "2026-11-19")).toBe(
      "Is your shift today, Thursday, November 19?",
    );
  });

  it("names a day picked ahead instead of calling it today", () => {
    expect(shiftTodayQuestion("2026-12-09", "2026-11-19")).toBe(
      "Is your shift on Wednesday, December 9?",
    );
  });

  it("falls back to today when the date is missing", () => {
    expect(shiftTodayQuestion("", "2026-11-19")).toBe("Is your shift today, Thursday, November 19?");
    expect(shiftTodayQuestion("", "nope")).toBe("Is your shift today?");
  });
});

it("withShiftTodayConfirmed keeps the body and adds the yes", () => {
  const body = { firstName: "Pat", eventDate: "2026-11-19" };
  expect(withShiftTodayConfirmed(body)).toEqual({ ...body, shiftIsToday: true });
  expect(body).not.toHaveProperty("shiftIsToday");
});
