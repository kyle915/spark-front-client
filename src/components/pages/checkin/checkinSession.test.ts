import { describe, expect, it } from "vitest";
import {
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
