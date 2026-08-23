import { describe, expect, it } from "vitest";
import {
  eventCalendarDate,
  isLeftoverCheckinSession,
  isStaleWalkupSession,
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
});
