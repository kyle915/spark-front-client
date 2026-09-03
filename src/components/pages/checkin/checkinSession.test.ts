import { describe, expect, it } from "vitest";
import {
  canAttemptOpenPunchResume,
  shouldDropSessionToken,
  shouldKeepCachedSession,
} from "@/components/pages/checkin/checkinSession";
import { isLeftoverCheckinSession } from "@/components/pages/checkin/leftoverCheckin";

describe("shouldDropSessionToken", () => {
  it("keeps the token when the API omits sessionError (legacy / soft miss)", () => {
    expect(
      shouldDropSessionToken({
        mode: "tenant",
        hasToken: true,
        hasSession: false,
        sessionError: null,
      }),
    ).toBe(false);
  });

  it("drops only when the API names a dead bearer", () => {
    expect(
      shouldDropSessionToken({
        mode: "tenant",
        hasToken: true,
        hasSession: false,
        sessionError: "expired",
      }),
    ).toBe(true);
    expect(
      shouldDropSessionToken({
        mode: "tenant",
        hasToken: true,
        hasSession: false,
        sessionError: "bad_session",
      }),
    ).toBe(true);
  });

  it("never drops when a session payload is present", () => {
    expect(
      shouldDropSessionToken({
        mode: "tenant",
        hasToken: true,
        hasSession: true,
        sessionError: "expired",
      }),
    ).toBe(false);
  });

  it("applies to every standing tenant code (not Feel Free only)", () => {
    // Soft miss on LD / Torch / Brew Dr must keep the bearer — same as FF.
    for (const _code of ["LD-ABC123", "TH-2HRV3D", "BD-AQRACD", "FF-YMMK3Q"]) {
      expect(
        shouldDropSessionToken({
          mode: "tenant",
          hasToken: true,
          hasSession: false,
          sessionError: null,
        }),
      ).toBe(false);
    }
  });
});

describe("shouldKeepCachedSession", () => {
  it("keeps same-day cached clock state over a bare tenant landing", () => {
    expect(
      shouldKeepCachedSession({
        incomingHasSession: false,
        cachedHasSession: true,
        cachedEventDate: "2026-08-28T12:00:00Z",
        today: "2026-08-28",
        isLeftover: isLeftoverCheckinSession,
      }),
    ).toBe(true);
  });

  it("does not keep a leftover-day cache (wrong day must stay visible)", () => {
    expect(
      shouldKeepCachedSession({
        incomingHasSession: false,
        cachedHasSession: true,
        cachedEventDate: "2026-08-27T12:00:00Z",
        today: "2026-08-28",
        isLeftover: isLeftoverCheckinSession,
      }),
    ).toBe(false);
  });
});

describe("canAttemptOpenPunchResume", () => {
  const base = {
    mode: "tenant" as const,
    recapOnly: false,
    hasLiveSession: false,
    firstName: "Joy",
    phone: "5550100",
    place: "100 Main St",
    hasToken: true,
    hasPendingClock: false,
    cachedClockedIn: false,
  };

  it("resumes on address-mode standing links (LD / Torch / Brew Dr)", () => {
    expect(canAttemptOpenPunchResume(base)).toBe(true);
    expect(
      canAttemptOpenPunchResume({
        ...base,
        place: "Total Wine & More, Austin",
        hasToken: false,
        cachedClockedIn: true,
      }),
    ).toBe(true);
  });

  it("resumes on market-mode standing links (Feel Free)", () => {
    expect(
      canAttemptOpenPunchResume({
        ...base,
        place: "Tampa / St. Pete, FL",
        hasToken: false,
        hasPendingClock: true,
      }),
    ).toBe(true);
  });

  it("does not resume without evidence or identity", () => {
    expect(
      canAttemptOpenPunchResume({
        ...base,
        hasToken: false,
        hasPendingClock: false,
        cachedClockedIn: false,
      }),
    ).toBe(false);
    expect(
      canAttemptOpenPunchResume({
        ...base,
        place: "",
        hasToken: false,
        hasPendingClock: false,
        cachedClockedIn: false,
      }),
    ).toBe(false);
    expect(canAttemptOpenPunchResume({ ...base, phone: "" })).toBe(false);
    expect(
      canAttemptOpenPunchResume({ ...base, hasLiveSession: true }),
    ).toBe(false);
    expect(canAttemptOpenPunchResume({ ...base, mode: "event" })).toBe(false);
  });

  it("Product Seeding can resume without a saved place when punch evidence exists", () => {
    expect(canAttemptOpenPunchResume({ ...base, place: "" })).toBe(true);
  });
});
