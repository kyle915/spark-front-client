import { describe, expect, it } from "vitest";
import {
  canAttemptOpenPunchResume,
  hasLookupPhone,
  lookupShiftsByPhone,
  resumeOpenShift,
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
    phone: "(305) 555-0142",
  };

  it("checks the server with only a saved phone — no local punch evidence needed", () => {
    // Annjolie (Torch): reopened TH-2HRV3D with no token, no cache, no
    // pending clock. The server still knows she's on the clock.
    expect(canAttemptOpenPunchResume(base)).toBe(true);
  });

  it("skips when there is nothing to look up or nothing to fix", () => {
    expect(canAttemptOpenPunchResume({ ...base, phone: "" })).toBe(false);
    expect(canAttemptOpenPunchResume({ ...base, phone: "555-0142" })).toBe(false);
    expect(canAttemptOpenPunchResume({ ...base, hasLiveSession: true })).toBe(false);
    expect(canAttemptOpenPunchResume({ ...base, mode: "event" })).toBe(false);
    expect(canAttemptOpenPunchResume({ ...base, recapOnly: true })).toBe(false);
  });

  it("stays quiet right after Start over / new shift", () => {
    expect(canAttemptOpenPunchResume({ ...base, suppressed: true })).toBe(false);
  });
});

describe("hasLookupPhone", () => {
  it("needs a full number", () => {
    expect(hasLookupPhone("305-555-0142")).toBe(true);
    expect(hasLookupPhone("+1 (305) 555-0142")).toBe(true);
    expect(hasLookupPhone("305555")).toBe(false);
    expect(hasLookupPhone(null)).toBe(false);
  });
});

type Call = { url: string; body: Record<string, unknown> };

const fakeFetch = (status: number, payload: unknown, calls: Call[]) =>
  (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body || "{}")) });
    return new Response(JSON.stringify(payload), { status });
  }) as (input: string, init?: RequestInit) => Promise<Response>;

const OPEN = {
  eventDate: "2026-10-03",
  name: "10/3/2026 - 11000 S Red Road, Pinecrest, FL 33156 (HER Bazar market place)",
  address: "11000 S Red Road, Pinecrest, FL 33156",
  clockInAt: "2026-10-03T13:31:00Z",
};

describe("lookupShiftsByPhone", () => {
  it("returns the open shift for today's date", async () => {
    const calls: Call[] = [];
    const out = await lookupShiftsByPhone({
      origin: "https://api.test",
      code: "TH-2HRV3D",
      phone: "3055550142",
      eventDate: "2026-10-03",
      fetchImpl: fakeFetch(200, { shifts: [], openShift: OPEN }, calls),
    });
    expect(out.openShift).toEqual(OPEN);
    expect(calls[0].url).toBe("https://api.test/api/public/checkin/TH-2HRV3D/unfiled-recaps");
    expect(calls[0].body).toMatchObject({ phone: "3055550142", eventDate: "2026-10-03" });
  });

  it("treats older APIs (no openShift) and network failures as nothing open", async () => {
    const calls: Call[] = [];
    expect(
      (
        await lookupShiftsByPhone({
          origin: "",
          code: "TH-2HRV3D",
          phone: "3055550142",
          eventDate: "2026-10-03",
          fetchImpl: fakeFetch(200, { shifts: [] }, calls),
        })
      ).openShift,
    ).toBeNull();
    expect(
      await lookupShiftsByPhone({
        origin: "",
        code: "TH-2HRV3D",
        phone: "3055550142",
        eventDate: "2026-10-03",
        fetchImpl: async () => {
          throw new TypeError("offline");
        },
      }),
    ).toEqual({ shifts: [], openShift: null });
  });
});

describe("resumeOpenShift", () => {
  it("asks for resumeOnly so it can never start a second shift", async () => {
    const calls: Call[] = [];
    const out = await resumeOpenShift({
      origin: "",
      code: "TH-2HRV3D",
      phone: "3055550142",
      eventDate: "2026-10-03",
      fetchImpl: fakeFetch(200, { sessionToken: "tok", session: {} }, calls),
    });
    expect(out?.sessionToken).toBe("tok");
    expect(calls[0].url).toBe("/api/public/checkin/TH-2HRV3D/identify");
    expect(calls[0].body).toMatchObject({ resumeOnly: true, phone: "3055550142" });
    expect(calls[0].body).not.toHaveProperty("address");
    expect(calls[0].body).not.toHaveProperty("eventTypeId");
  });

  it("returns null when the API has no open shift", async () => {
    const out = await resumeOpenShift({
      origin: "",
      code: "TH-2HRV3D",
      phone: "3055550142",
      eventDate: "2026-10-03",
      fetchImpl: fakeFetch(404, { error: "no_open_shift" }, []),
    });
    expect(out).toBeNull();
  });
});
