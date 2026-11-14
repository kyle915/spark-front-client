import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CHECK_IN_ANOTHER_GIG_HINT,
  CHECK_IN_SOMEWHERE_ELSE,
  clearChosenShiftDate,
  clearPastRecapIntent,
  clockInForTodayLabel,
  eventCalendarDate,
  finishPriorRecapLabel,
  FORGOT_PAST_RECAP_CTA,
  FORGOT_PAST_RECAP_HINT,
  isLeftoverCheckinSession,
  isPastDayWalkupSession,
  isStaleWalkupSession,
  newDayPrimaryLabel,
  offerFinishPriorRecap,
  PAST_DAY_NO_CLOCK,
  readChosenShiftDate,
  readPastRecapIntent,
  shiftDateForFindOrCreate,
  showNewDayGate,
  START_OVER_LINK,
  walkupDayKind,
  walkupDayLabel,
  writeChosenShiftDate,
  writePastRecapIntent,
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

  it("names the clocked-out escape as another gig with plain helper copy", () => {
    expect(CHECK_IN_SOMEWHERE_ELSE).toBe("Check-in for another gig");
    expect(CHECK_IN_SOMEWHERE_ELSE.toLowerCase()).not.toContain("somewhere else");
    expect(CHECK_IN_ANOTHER_GIG_HINT).toBe("Starting a different store or event?");
  });

  it("keeps the another-gig button out of the Time Clock button row", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "SparkCheckin.tsx"), "utf8");
    const rowStart = src.indexOf('effectiveClock === "clocked_out" && !hasRecap');
    const clockedOutRow = src.slice(rowStart, src.indexOf("{queuedClock ?", rowStart));
    expect(clockedOutRow).toContain("File recap");
    expect(clockedOutRow).not.toContain("CHECK_IN_SOMEWHERE_ELSE");
    // The only render of the label is the standalone button below the card,
    // with its helper copy and the existing start-another handler.
    expect(src.match(/\{CHECK_IN_SOMEWHERE_ELSE\}/g)).toHaveLength(1);
    const standalone = src.slice(src.indexOf("{CHECK_IN_ANOTHER_GIG_HINT}"));
    expect(standalone).toContain("onClick={() => requestStartAnother()}");
    expect(standalone).toContain("{CHECK_IN_SOMEWHERE_ELSE}");
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

describe("picked past shift date", () => {
  const storage = () => {
    const bag = new Map<string, string>();
    return {
      getItem: (key: string) => bag.get(key) ?? null,
      setItem: (key: string, value: string) => {
        bag.set(key, value);
      },
      removeItem: (key: string) => {
        bag.delete(key);
      },
    };
  };

  it("sends 2026-10-16 to find-or-create and does not replace it with today", () => {
    const today = "2026-10-18";
    const picked = "2026-10-16";
    expect(shiftDateForFindOrCreate({ picked, today })).toBe("2026-10-16");
    expect(shiftDateForFindOrCreate({ picked: `${picked}T12:00:00Z`, today })).toBe(
      "2026-10-16",
    );
    expect(shiftDateForFindOrCreate({ picked: "", today })).toBe(today);

    const store = storage();
    writeChosenShiftDate("TH-2HRV3D", { date: picked, chosenOn: today }, store);
    const chosen = readChosenShiftDate("TH-2HRV3D", store);
    expect(chosen).toEqual({ date: "2026-10-16", chosenOn: "2026-10-18" });
    // Session created for the picked day must stay on that day. The new-day
    // button would clock in for today and drop Oct 16.
    expect(
      showNewDayGate({
        eventDate: "2026-10-16T12:00:00Z",
        today,
        chosen,
      }),
    ).toBe(false);
    expect(clockInForTodayLabel(today)).toBe("Clock in for Sunday, Oct 18");
    clearChosenShiftDate("TH-2HRV3D", store);
  });

  it("still leads with Clock in for today when a saved prior-day shift was not picked this visit", () => {
    expect(
      showNewDayGate({
        eventDate: "2026-10-16T12:00:00Z",
        today: "2026-10-18",
        chosen: null,
      }),
    ).toBe(true);
    expect(
      showNewDayGate({
        eventDate: "2026-10-16T12:00:00Z",
        today: "2026-10-19",
        chosen: { date: "2026-10-16", chosenOn: "2026-10-18" },
      }),
    ).toBe(true);
    expect(
      showNewDayGate({
        eventDate: "2026-10-18T12:00:00Z",
        today: "2026-10-18",
        chosen: { date: "2026-10-16", chosenOn: "2026-10-18" },
      }),
    ).toBe(false);
  });

  it("clears a remembered pick so the next visit can offer today again", () => {
    const store = storage();
    writeChosenShiftDate("TH-2HRV3D", { date: "2026-10-16", chosenOn: "2026-10-18" }, store);
    clearChosenShiftDate("TH-2HRV3D", store);
    expect(readChosenShiftDate("TH-2HRV3D", store)).toBeNull();
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

describe("forgotten past-day recap CTA", () => {
  const storage = () => {
    const bag = new Map<string, string>();
    return {
      getItem: (key: string) => bag.get(key) ?? null,
      setItem: (key: string, value: string) => {
        bag.set(key, value);
      },
      removeItem: (key: string) => {
        bag.delete(key);
      },
    };
  };

  it("names a large discoverability CTA that skips clock-in", () => {
    expect(FORGOT_PAST_RECAP_CTA.toLowerCase()).toContain("past");
    expect(FORGOT_PAST_RECAP_CTA.toLowerCase()).toContain("click here");
    expect(FORGOT_PAST_RECAP_HINT.toLowerCase()).toContain("no clock");
  });

  it("remembers past-recap intent for this visit then clears it", () => {
    const store = storage();
    expect(readPastRecapIntent("FF-YMMK3Q", store)).toBe(false);
    writePastRecapIntent("FF-YMMK3Q", store);
    expect(readPastRecapIntent("FF-YMMK3Q", store)).toBe(true);
    clearPastRecapIntent("FF-YMMK3Q", store);
    expect(readPastRecapIntent("FF-YMMK3Q", store)).toBe(false);
  });

  it("wires the CTA on the new-day gate and identify landing", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const checkin = readFileSync(join(here, "SparkCheckin.tsx"), "utf8");
    const identify = readFileSync(join(here, "IdentifyStep.tsx"), "utf8");
    expect(checkin).toContain("FORGOT_PAST_RECAP_CTA");
    expect(checkin).toContain("writePastRecapIntent(code)");
    expect(identify).toContain("FORGOT_PAST_RECAP_CTA");
    expect(identify).toContain("beginPastRecap");
    expect(identify).toContain("pastRecap");
  });
});
