import { describe, expect, it } from "vitest";

import { formatInstantDate } from "./formatInstantDate";

const US = { locale: "en-US" } as const;

describe("formatInstantDate", () => {
  it("shows the viewer's day for an evening submission stamped in UTC", () => {
    // 6:05 PM Pacific on the 14th is already the 15th in UTC.
    const stamp = "2026-11-15T02:05:00+00:00";
    expect(formatInstantDate(stamp, { ...US, timeZone: "America/Los_Angeles" })).toBe("11/14/2026");
    expect(formatInstantDate(stamp, { ...US, timeZone: "America/New_York" })).toBe("11/14/2026");
    expect(formatInstantDate(stamp, { ...US, timeZone: "UTC" })).toBe("11/15/2026");
  });

  it("handles Z and microseconds", () => {
    expect(
      formatInstantDate("2026-11-15T02:05:00.123456Z", { ...US, timeZone: "America/Chicago" }),
    ).toBe("11/14/2026");
  });

  it("leaves a midday stamp on the same day everywhere in the US", () => {
    const stamp = "2026-11-14T18:05:00+00:00";
    for (const timeZone of ["America/Los_Angeles", "America/New_York", "UTC"]) {
      expect(formatInstantDate(stamp, { ...US, timeZone })).toBe("11/14/2026");
    }
  });

  it("keeps a bare date as written", () => {
    expect(formatInstantDate("2026-11-14", US)).toBe("11/14/2026");
  });

  it("keeps a zone-less wall-clock value on its written day", () => {
    expect(formatInstantDate("2026-11-14T23:30:00", US)).toBe("11/14/2026");
  });

  it("returns a dash for nothing and echoes junk", () => {
    expect(formatInstantDate(null)).toBe("-");
    expect(formatInstantDate("")).toBe("-");
    expect(formatInstantDate("not a date")).toBe("not a date");
  });
});
