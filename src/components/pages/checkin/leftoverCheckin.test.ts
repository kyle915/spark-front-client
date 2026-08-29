import { describe, expect, it } from "vitest";
import {
  CHECK_IN_SOMEWHERE_ELSE,
  eventCalendarDate,
  isLeftoverCheckinSession,
  isStaleWalkupSession,
  LEFTOVER_BANNER_BODY,
  LEFTOVER_PRIMARY_CTA,
  LEFTOVER_SECONDARY_CTA,
} from "@/components/pages/checkin/leftoverCheckin";

describe("leftoverCheckin", () => {
  it("detects leftover sessions by calendar date", () => {
    expect(isLeftoverCheckinSession("2026-08-20T12:00:00Z", "2026-08-23")).toBe(
      true,
    );
    expect(isLeftoverCheckinSession("2026-08-23", "2026-08-23")).toBe(false);
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
});
