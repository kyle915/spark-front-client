import { describe, expect, it } from "vitest";
import {
  CHECK_IN_SOMEWHERE_ELSE,
  clockInForTodayLabel,
  eventCalendarDate,
  finishPriorRecapLabel,
  isLeftoverCheckinSession,
  isPastDayWalkupSession,
  isStaleWalkupSession,
  newDayPrimaryLabel,
  offerFinishPriorRecap,
  PAST_DAY_NO_CLOCK,
  START_OVER_LINK,
  walkupDayKind,
  walkupDayLabel,
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
    expect(clockInForTodayLabel("2026-10-16")).toBe("Clock in for Friday, Oct 16");
    expect(finishPriorRecapLabel("2026-10-15T12:00:00Z")).toBe(
      "Finish Thursday's recap",
    );
    expect(walkupDayLabel("2026-10-16")).toBe("Friday, Oct 16");
    expect(newDayPrimaryLabel("2026-10-16", true)).toBe(
      "File a recap for Friday, Oct 16",
    );
    expect(clockInForTodayLabel("2026-10-16").toLowerCase()).not.toContain("clear");
    expect(CHECK_IN_SOMEWHERE_ELSE.toLowerCase()).not.toContain("log another");
  });

  it("offers Finish only for an unsubmitted prior recap", () => {
    expect(
      offerFinishPriorRecap({ hasRecap: true, clockState: "clocked_out" }),
    ).toBe(false);
    expect(
      offerFinishPriorRecap({
        hasRecap: false,
        clockState: "clocked_out",
        hasUnsubmittedWork: false,
      }),
    ).toBe(false);
    expect(
      offerFinishPriorRecap({
        hasRecap: false,
        clockState: "clocked_out",
        hasUnsubmittedWork: true,
      }),
    ).toBe(true);
    expect(
      offerFinishPriorRecap({ hasRecap: false, clockState: "clocked_in" }),
    ).toBe(true);
    expect(
      offerFinishPriorRecap({ hasRecap: false, recapOnly: true, clockState: "not_started" }),
    ).toBe(true);
    expect(
      offerFinishPriorRecap({ hasRecap: true, recapOnly: true }),
    ).toBe(false);
  });

  it("makes same-day start-over read as a new-shift reset", () => {
    expect(START_OVER_LINK.toLowerCase()).toContain("new shift");
    expect(START_OVER_LINK.toLowerCase()).not.toContain("wrong store");
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

describe("isPastDayWalkupSession", () => {
  // Weni's Saturday punch: 10:58 CT = 15:58Z on Oct 3.
  const saturday = new Date("2026-10-03T15:58:00Z");

  it("Thursday's walk-up on Saturday has no clock", () => {
    expect(isPastDayWalkupSession("2026-10-01T12:00:00Z", null, saturday)).toBe(true);
  });

  it("today keeps the clock", () => {
    expect(isPastDayWalkupSession("2026-10-03T12:00:00Z", null, saturday)).toBe(false);
  });

  it("Saturday 9pm ET (01:00Z Sunday) is still Saturday", () => {
    const lateEast = new Date("2026-10-04T01:00:00Z");
    expect(isPastDayWalkupSession("2026-10-03T12:00:00Z", null, lateEast)).toBe(false);
  });

  it("a shift that started last night can still clock in", () => {
    expect(
      isPastDayWalkupSession("2026-10-02T12:00:00Z", "2026-10-03T03:00:00Z", saturday),
    ).toBe(false);
  });

  it("yesterday's afternoon start is past by the next morning", () => {
    expect(
      isPastDayWalkupSession("2026-10-01T12:00:00Z", "2026-10-01T19:00:00Z", saturday),
    ).toBe(true);
  });

  it("no event date is not past", () => {
    expect(isPastDayWalkupSession(null, null, saturday)).toBe(false);
  });

  it("tells the BA to file the recap instead", () => {
    expect(PAST_DAY_NO_CLOCK).toMatch(/File its recap/);
  });
});
