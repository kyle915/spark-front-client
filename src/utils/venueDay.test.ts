import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  fmtTimeInZone,
  instantToZoneInput,
  opsTodayIso,
  venueDayOf,
  ymdInZone,
  zoneInputToIso,
} from "./venueDay";

describe("ops today", () => {
  it("is the Pacific day, not the UTC day, in the evening", () => {
    // 7:30 PM PST Nov 16 = 03:30 UTC Nov 17.
    const evening = new Date("2026-11-17T03:30:00Z");
    expect(evening.toISOString().slice(0, 10)).toBe("2026-11-17");
    expect(opsTodayIso(evening)).toBe("2026-11-16");
  });

  it("reads a day in any named zone", () => {
    const t = new Date("2026-11-17T03:30:00Z");
    expect(ymdInZone(t, "America/New_York")).toBe("2026-11-16");
    expect(ymdInZone(t, "Europe/Berlin")).toBe("2026-11-17");
  });
});

describe("addDaysIso", () => {
  it("crosses months and years", () => {
    expect(addDaysIso("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysIso("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDaysIso("2026-11-16", 7)).toBe("2026-11-23");
  });
});

describe("venueDayOf", () => {
  it("prefers the server's venue day", () => {
    expect(
      venueDayOf({ localDate: "2026-11-16", startTime: "2026-11-17T01:00:00", date: null }),
    ).toBe("2026-11-16");
  });

  it("reads a venue wall-clock string literally, whatever the browser zone", () => {
    // An evening shift: the string is the venue's clock. new Date() would
    // re-read it in the viewer's zone; this must not.
    expect(venueDayOf({ startTime: "2026-11-16T19:00:00" })).toBe("2026-11-16");
    expect(venueDayOf({ date: "2026-11-16T23:30:00" })).toBe("2026-11-16");
    expect(venueDayOf({})).toBeNull();
  });
});

describe("clock times at the venue", () => {
  // A BA in Atlanta clocked out at 9:00 PM Eastern on Nov 16 = 02:00 UTC Nov 17.
  const clockOut = "2026-11-17T02:00:00+00:00";

  it("shows the venue's clock, not the admin's", () => {
    expect(fmtTimeInZone(clockOut, "America/New_York")).toBe("9:00 PM");
    expect(fmtTimeInZone(clockOut, "America/Los_Angeles")).toBe("6:00 PM");
  });

  it("seeds the editor with the venue's clock", () => {
    expect(instantToZoneInput(clockOut, "America/New_York")).toBe("2026-11-16T21:00");
  });

  it("an admin typing 9:00 PM for an East Coast shift stores 9:00 PM Eastern", () => {
    // Read in a Pacific browser this used to become 05:00 UTC: three paid
    // hours too many.
    expect(zoneInputToIso("2026-11-16T21:00", "America/New_York")).toBe(
      "2026-11-17T02:00:00.000Z",
    );
  });

  it("round-trips across a DST change", () => {
    for (const [local, tz] of [
      ["2026-03-08T01:30", "America/New_York"], // just before spring forward
      ["2026-03-08T03:30", "America/New_York"], // just after
      ["2026-11-01T00:30", "America/Chicago"], // before fall back
      ["2026-11-01T03:00", "America/Chicago"], // after
      ["2026-07-04T12:00", "America/Phoenix"], // no DST
    ] as const) {
      const iso = zoneInputToIso(local, tz);
      expect(iso).not.toBeNull();
      expect(instantToZoneInput(iso, tz)).toBe(local);
    }
  });

  it("summer and winter Eastern differ by the real offset", () => {
    expect(zoneInputToIso("2026-07-15T10:00", "America/New_York")).toBe(
      "2026-07-15T14:00:00.000Z",
    );
    expect(zoneInputToIso("2026-01-15T10:00", "America/New_York")).toBe(
      "2026-01-15T15:00:00.000Z",
    );
  });

  it("rejects text that is not a date and time", () => {
    expect(zoneInputToIso("", "America/New_York")).toBeNull();
    expect(zoneInputToIso("tomorrow", "America/New_York")).toBeNull();
  });
});
