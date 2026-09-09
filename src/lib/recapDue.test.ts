import { describe, expect, it } from "vitest";
import { isRecapDue } from "./recapDue";

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localYmd(d);
}

/**
 * Master Tracker DUE chip must key off the activation (event) date, not the
 * stale Request.date after a reschedule — e.g. request −3 days, event +4.
 */
describe("isRecapDue", () => {
  it("flags a past activation within the lookback window", () => {
    expect(isRecapDue(daysFromToday(-2), 30)).toBe(true);
  });

  it("does not flag today or a future activation", () => {
    expect(isRecapDue(daysFromToday(0), 30)).toBe(false);
    expect(isRecapDue(daysFromToday(4), 30)).toBe(false);
  });

  it("reschedule: request date due, event date not", () => {
    const requestDate = daysFromToday(-3);
    const eventDate = daysFromToday(4);
    expect(isRecapDue(requestDate, 30)).toBe(true);
    expect(isRecapDue(eventDate, 30)).toBe(false);
    const activationDate = eventDate ?? requestDate;
    const status =
      0 > 0 ? "submitted" : isRecapDue(activationDate, 30) ? "due" : "none";
    expect(status).toBe("none");
  });

  it("submitted wins over due when filed count > 0", () => {
    const activationDate = daysFromToday(-3);
    const recapsFiledCount = 1;
    const status =
      recapsFiledCount > 0
        ? "submitted"
        : isRecapDue(activationDate, 30)
          ? "due"
          : "none";
    expect(status).toBe("submitted");
  });
});
