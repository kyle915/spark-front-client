import { describe, expect, it } from "vitest";
import { eventCalendarDate, isLeftoverCheckinSession } from "./leftoverCheckin";

describe("eventCalendarDate", () => {
  it("reads the civil date off noon-UTC Event.date", () => {
    expect(eventCalendarDate("2026-08-15T12:00:00+00:00")).toBe("2026-08-15");
    expect(eventCalendarDate("2026-08-15")).toBe("2026-08-15");
  });

  it("returns null for blank input", () => {
    expect(eventCalendarDate(null)).toBeNull();
    expect(eventCalendarDate("")).toBeNull();
  });
});

describe("isLeftoverCheckinSession", () => {
  it("is true when the restored event is a different calendar day", () => {
    expect(isLeftoverCheckinSession("2026-08-15T12:00:00Z", "2026-08-19")).toBe(true);
  });

  it("is false when the event is today", () => {
    expect(isLeftoverCheckinSession("2026-08-19T12:00:00Z", "2026-08-19")).toBe(false);
  });

  it("is false without an event date", () => {
    expect(isLeftoverCheckinSession(null, "2026-08-19")).toBe(false);
  });
});
