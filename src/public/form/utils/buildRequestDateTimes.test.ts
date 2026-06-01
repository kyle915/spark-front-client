import { describe, it, expect } from "vitest";
import { buildRequestDateTimes } from "./buildPayload";

/**
 * B4 regression: the public Express form used to post a NAIVE timestamp
 * (`2026-06-15T11:00:00`, no offset). The backend (USE_TZ, TIME_ZONE=UTC)
 * then stored 11:00 as 11:00 *UTC* and reads it back in the venue's zone,
 * shifting an 11a Pacific start to ~8a. The fix bakes the timezone's
 * DST-aware offset (for the event date) into every timestamp.
 *
 * These cases also pin the #166 trap: we must NOT use a single static
 * `offset` integer for a zone that observes DST — the offset depends on
 * the date. We give the helper BOTH the PST and PDT rows and assert it
 * picks the right one per date.
 */

// Mirrors the public timezone dropdown shape (PublicTimeZone), including
// the display label `name` and raw `code` that resolveTimezoneIdByDate
// keys off to pick the STD vs DST sibling.
const PACIFIC_STD = {
  id: "tz-pst",
  name: "Pacific-PST (UTC-08:00)",
  code: "PST",
  offset: -480,
};
const PACIFIC_DST = {
  id: "tz-pdt",
  name: "Pacific-PDT (UTC-07:00)",
  code: "PDT",
  offset: -420,
};
const EASTERN_STD = {
  id: "tz-est",
  name: "Eastern-EST (UTC-05:00)",
  code: "EST",
  offset: -300,
};
const EASTERN_DST = {
  id: "tz-edt",
  name: "Eastern-EDT (UTC-04:00)",
  code: "EDT",
  offset: -240,
};
const ARIZONA = {
  id: "tz-mst-az",
  name: "Arizona-MST (UTC-07:00)",
  code: "MST",
  offset: -420,
};
const ZONES = [PACIFIC_STD, PACIFIC_DST, EASTERN_STD, EASTERN_DST, ARIZONA];

describe("buildRequestDateTimes (DST-aware express/wizard payload offsets)", () => {
  // The shared helper emits `HH:MM` (no seconds) with an offset suffix —
  // byte-identical to what the wizard form's buildPayload already posts
  // and the backend already accepts. The load-bearing invariant is that
  // the OFFSET is present and date-correct (vs the old naive `...T11:00:00`).

  it("bakes the PDT offset for a summer Pacific date (the reported 11a case)", () => {
    // June 15 is inside DST → Pacific is PDT (UTC-07:00). An 11a start
    // must serialize as 11:00-07:00 (== 18:00 UTC), NOT a naive 11:00.
    const out = buildRequestDateTimes(ZONES, "tz-pst", "2026-06-15", "11:00", "16:00");
    expect(out.startTime).toBe("2026-06-15T11:00-07:00");
    expect(out.endTime).toBe("2026-06-15T16:00-07:00");
    expect(out.date).toBe("2026-06-15T00:00-07:00");
    // Round-trips back to 11:00 in venue-local time (the UTC instant is
    // 18:00Z; shifting by -07:00 yields 11:00).
    expect(new Date(out.startTime).getUTCHours()).toBe(18);
  });

  it("bakes the PST offset for a winter Pacific date (the #166 trap)", () => {
    // Jan 15 is outside DST → Pacific is PST (UTC-08:00). Even though the
    // user may have had PDT selected, resolution by date must swap to PST
    // so we don't under-shift.
    const out = buildRequestDateTimes(ZONES, "tz-pdt", "2026-01-15", "11:00", "16:00");
    expect(out.startTime).toBe("2026-01-15T11:00-08:00");
    expect(out.endTime).toBe("2026-01-15T16:00-08:00");
    expect(new Date(out.startTime).getUTCHours()).toBe(19);
  });

  it("resolves the same correct instant regardless of which Pacific variant was picked", () => {
    // Picking PST or PDT for a summer date must both land on PDT.
    const fromStd = buildRequestDateTimes(ZONES, "tz-pst", "2026-07-04", "09:30", "12:00");
    const fromDst = buildRequestDateTimes(ZONES, "tz-pdt", "2026-07-04", "09:30", "12:00");
    expect(fromStd.startTime).toBe("2026-07-04T09:30-07:00");
    expect(fromDst.startTime).toBe(fromStd.startTime);
  });

  it("handles Eastern DST correctly", () => {
    const summer = buildRequestDateTimes(ZONES, "tz-est", "2026-06-15", "11:00", "16:00");
    expect(summer.startTime).toBe("2026-06-15T11:00-04:00"); // EDT
    const winter = buildRequestDateTimes(ZONES, "tz-edt", "2026-12-15", "11:00", "16:00");
    expect(winter.startTime).toBe("2026-12-15T11:00-05:00"); // EST
  });

  it("keeps Arizona on MST year-round (no DST)", () => {
    const summer = buildRequestDateTimes(ZONES, "tz-mst-az", "2026-06-15", "11:00", "16:00");
    const winter = buildRequestDateTimes(ZONES, "tz-mst-az", "2026-12-15", "11:00", "16:00");
    expect(summer.startTime).toBe("2026-06-15T11:00-07:00");
    expect(winter.startTime).toBe("2026-12-15T11:00-07:00");
  });

  it("returns empty strings when date is missing", () => {
    const out = buildRequestDateTimes(ZONES, "tz-pst", "", "11:00", "16:00");
    expect(out).toEqual({ date: "", startTime: "", endTime: "" });
  });
});
