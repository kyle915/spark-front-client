import { describe, expect, it } from "vitest";
import {
  formatHours,
  parseShiftHistory,
  shiftStatusView,
  type HistoryShift,
} from "./shiftHistory";

const base: HistoryShift = {
  eventDate: "2026-11-08",
  name: "Total Wine",
  address: "1 Main St",
  clockInAt: "2026-11-08T15:00:00Z",
  clockOutAt: "2026-11-08T18:30:00Z",
  onTheClock: false,
  hours: 3.5,
  status: "pending_review",
  paidAt: null,
  recapFiled: true,
};

describe("formatHours", () => {
  it("formats hours and minutes", () => {
    expect(formatHours(3.5)).toBe("3 hr 30 min");
    expect(formatHours(2)).toBe("2 hr");
    expect(formatHours(0.75)).toBe("45 min");
  });
  it("is empty for unknown", () => {
    expect(formatHours(null)).toBe("");
    expect(formatHours(Number.NaN)).toBe("");
  });
});

describe("shiftStatusView", () => {
  it("walks the status ladder", () => {
    expect(shiftStatusView(base).label).toBe("Waiting for review");
    expect(shiftStatusView({ ...base, status: "confirmed" }).label).toBe("Confirmed");
    expect(shiftStatusView({ ...base, status: "hours_approved" }).label).toBe("Hours approved");
    const paid = shiftStatusView({ ...base, status: "paid", paidAt: "2026-11-14T12:00:00Z" });
    expect(paid.label).toBe("Paid");
    expect(paid.tone).toBe("done");
  });
  it("puts a missing recap and an open clock first", () => {
    expect(shiftStatusView({ ...base, recapFiled: false, status: "confirmed" }).label).toBe("Recap needed");
    expect(shiftStatusView({ ...base, onTheClock: true }).label).toBe("On the clock");
  });
  it("does not ask for a recap staff dismissed as not owed", () => {
    const dismissed = { ...base, recapFiled: false, recapDismissed: true };
    expect(shiftStatusView({ ...dismissed, status: "confirmed" }).label).toBe("Confirmed");
    expect(parseShiftHistory({ shifts: [{ ...dismissed }] }).shifts[0]?.recapDismissed).toBe(true);
    expect(parseShiftHistory({ shifts: [{ ...base }] }).shifts[0]?.recapDismissed).toBe(false);
  });
});

describe("parseShiftHistory", () => {
  it("survives junk", () => {
    expect(parseShiftHistory(null).shifts).toEqual([]);
    expect(parseShiftHistory({ shifts: "nope" }).shifts).toEqual([]);
  });
  it("normalises rows and unknown statuses", () => {
    const h = parseShiftHistory({
      shifts: [{ ...base, status: "weird" }, 7],
      totalHours: 3.5,
      windowDays: 60,
    });
    expect(h.shifts).toHaveLength(1);
    expect(h.shifts[0].status).toBe("pending_review");
    expect(h.totalHours).toBe(3.5);
  });
});
