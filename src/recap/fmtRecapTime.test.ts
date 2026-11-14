import { describe, expect, it } from "vitest";
import { fmtRecapTime } from "./fmtRecapTime";

describe("fmtRecapTime", () => {
  it("reads the time of day from a zone-less ISO string", () => {
    expect(fmtRecapTime("2026-05-30T14:00:00")).toBe("2 PM");
    expect(fmtRecapTime("2026-05-30T09:30:00")).toBe("9:30 AM");
    expect(fmtRecapTime("2026-05-30 18:45:00")).toBe("6:45 PM");
  });

  it("does not read the date as the hour", () => {
    expect(fmtRecapTime("2026-05-30T10:00:00")).toBe("10 AM");
    expect(fmtRecapTime("2026-05-30T16:00:00")).toBe("4 PM");
  });

  it("still handles a bare HH:MM or HH:MM:SS", () => {
    expect(fmtRecapTime("14:00")).toBe("2 PM");
    expect(fmtRecapTime("09:05:00")).toBe("9:05 AM");
  });

  it("handles midnight and noon", () => {
    expect(fmtRecapTime("2026-05-30T00:00:00")).toBe("12 AM");
    expect(fmtRecapTime("2026-05-30T12:15:00")).toBe("12:15 PM");
  });

  it("returns an empty string for missing or unreadable input", () => {
    expect(fmtRecapTime(null)).toBe("");
    expect(fmtRecapTime(undefined)).toBe("");
    expect(fmtRecapTime("")).toBe("");
    expect(fmtRecapTime("not a time")).toBe("");
  });
});
