import { describe, expect, it } from "vitest";
import {
  CHECK_IN_SOMEWHERE_ELSE,
  eventCalendarDate,
  isLeftoverCheckinSession,
  isStaleWalkupSession,
  LEFTOVER_BANNER_BODY,
  LEFTOVER_PRIMARY_CTA,
  LEFTOVER_SECONDARY_CTA,
  walkupDayKind,
} from "@/components/pages/checkin/leftoverCheckin";
import { supportsStandingSecondShift } from "@/components/pages/checkin/secondShift";

describe("leftoverCheckin", () => {
  it("detects leftover sessions by calendar date", () => {
    expect(isLeftoverCheckinSession("2026-08-20T12:00:00Z", "2026-08-23")).toBe(
      true,
    );
    expect(isLeftoverCheckinSession("2026-08-23", "2026-08-23")).toBe(false);
  });

  it("classifies walk-up day kind for leftover vs same-day", () => {
    expect(walkupDayKind("2026-08-20T12:00:00Z", "2026-08-23")).toBe(
      "leftover_prior_day",
    );
    expect(walkupDayKind("2026-08-23", "2026-08-23")).toBe("same_day");
    expect(walkupDayKind(null, "2026-08-23")).toBe("unknown");
  });

  it("flags stale walk-up when token exists on wrong day", () => {
    expect(
      isStaleWalkupSession(true, "tenant", "2026-08-20", "2026-08-23"),
    ).toBe(true);
    expect(
      isStaleWalkupSession(false, "tenant", "2026-08-20", "2026-08-23"),
    ).toBe(false);
    expect(
      isStaleWalkupSession(true, "event", "2026-08-20", "2026-08-23"),
    ).toBe(false);
  });

  it("parses event calendar date", () => {
    expect(eventCalendarDate("2026-08-20T12:00:00Z")).toBe("2026-08-20");
  });

  it("uses outcome-first CTA copy (not clear/delete language)", () => {
    expect(LEFTOVER_PRIMARY_CTA).toBe("Start today's shift");
    expect(LEFTOVER_SECONDARY_CTA).toBe("Stay on that day");
    expect(LEFTOVER_BANNER_BODY.toLowerCase()).toContain("stay on the record");
    expect(LEFTOVER_PRIMARY_CTA.toLowerCase()).not.toContain("clear");
    expect(CHECK_IN_SOMEWHERE_ELSE.toLowerCase()).not.toContain("log another");
  });

  it("never offers second-shift UI on a leftover prior-day session", () => {
    const feelFree = {
      name: "Feel Free",
      requestUrlName: "bl00-feel-free",
    };
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: feelFree,
        eventDate: "2026-08-20T12:00:00Z",
        today: "2026-08-23",
      }),
    ).toBe(false);
    expect(
      supportsStandingSecondShift({
        mode: "tenant",
        brand: feelFree,
        eventDate: "2026-08-23T12:00:00Z",
        today: "2026-08-23",
      }),
    ).toBe(true);
    const day = walkupDayKind("2026-08-20", "2026-08-23");
    const second = supportsStandingSecondShift({
      mode: "tenant",
      brand: feelFree,
      eventDate: "2026-08-20",
      today: "2026-08-23",
    });
    expect(day === "leftover_prior_day" && second).toBe(false);
  });
});
