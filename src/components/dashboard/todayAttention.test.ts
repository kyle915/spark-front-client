import { describe, expect, it } from "vitest";
import {
  attentionRows,
  shiftTime,
  startsTodayRows,
  type BoardAssignee,
  type BoardShift,
} from "./todayAttention";

const ba = (over: Partial<BoardAssignee> = {}): BoardAssignee => ({
  ambassadorUuid: "ba-1",
  name: "Dana R",
  status: "upcoming",
  clockInAt: null,
  clockOutAt: null,
  pendingApproval: false,
  ...over,
});

const shift = (over: Partial<BoardShift> = {}): BoardShift => ({
  eventUuid: "ev-1",
  eventName: "Hollywood Bowl",
  brandName: "Mark Anthony Brands",
  store: "",
  startTime: "16:00",
  endTime: "21:00",
  assigned: [ba()],
  ...over,
});

describe("shiftTime", () => {
  it("reads a bare time and a venue-local datetime the same way", () => {
    expect(shiftTime("16:00")).toBe("4 PM");
    expect(shiftTime("2026-10-30T09:30:00")).toBe("9:30 AM");
    expect(shiftTime("")).toBe("");
  });
});

describe("startsTodayRows", () => {
  it("orders by start time and names the ambassador's state", () => {
    const rows = startsTodayRows(
      [
        shift({ eventUuid: "late", startTime: "17:30", store: "Total Wine" }),
        shift({
          eventUuid: "early",
          startTime: "09:00",
          assigned: [ba({ status: "clocked_in" })],
        }),
      ],
      { showBrand: false },
    );
    expect(rows.map((r) => r.key)).toEqual(["early", "late"]);
    expect(rows[0]).toMatchObject({
      title: "Hollywood Bowl",
      detail: "Dana R · clocked in",
      time: "9 AM",
      flagged: false,
      to: "/event/view/early",
    });
    expect(rows[1].title).toBe("Total Wine");
  });

  it("flags a shift with nobody booked and one with a no-show", () => {
    const rows = startsTodayRows(
      [
        shift({ eventUuid: "empty", assigned: [] }),
        shift({
          eventUuid: "team",
          startTime: "18:00",
          assigned: [
            ba({ status: "clocked_in" }),
            ba({ ambassadorUuid: "ba-2", status: "no_show" }),
          ],
        }),
      ],
      { showBrand: true },
    );
    expect(rows[0]).toMatchObject({
      detail: "Mark Anthony Brands · No ambassador booked",
      flagged: true,
    });
    expect(rows[1]).toMatchObject({
      detail: "Mark Anthony Brands · 2 ambassadors · 1 clocked in · 1 no-show",
      flagged: true,
    });
  });
});

describe("attentionRows", () => {
  const none = { today: [], yesterday: [], staleRequests: 0, unscheduledRequests: 0 };

  it("is empty when nothing needs anyone", () => {
    expect(
      attentionRows({
        ...none,
        today: [shift({ assigned: [ba({ status: "clocked_in" })] })],
        yesterday: [
          shift({
            assigned: [
              ba({
                status: "clocked_out",
                clockInAt: "2026-10-30T23:00:00+00:00",
                clockOutAt: "2026-10-31T04:03:00+00:00",
              }),
            ],
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("puts yesterday's open punch first, then today's problems, then queues", () => {
    const rows = attentionRows({
      today: [
        shift({ eventUuid: "ns", assigned: [ba({ status: "no_show" })] }),
        shift({ eventUuid: "empty", store: "Binny's", assigned: [] }),
        shift({
          eventUuid: "wu",
          assigned: [ba({ ambassadorUuid: "ba-9", name: "", pendingApproval: true })],
        }),
      ],
      yesterday: [
        shift({
          eventUuid: "y",
          assigned: [ba({ clockInAt: "2026-10-30T23:00:46+00:00" })],
        }),
      ],
      staleRequests: 3,
      unscheduledRequests: 1,
    });
    expect(rows.map((r) => r.key)).toEqual([
      "open:y:ba-1",
      "noshow:ns:ba-1",
      "unbooked:empty",
      "walkup:wu:ba-9",
      "stale-requests",
      "unscheduled-requests",
    ]);
    expect(rows[0].reason).toMatch(/^No clock-out · in .+ yesterday$/);
    expect(rows[0].to).toBe("/timesheet");
    expect(rows[1]).toMatchObject({ subject: "Dana R", reason: "No-show · due 4 PM" });
    expect(rows[2]).toMatchObject({
      subject: "Binny's",
      reason: "No ambassador booked · starts 4 PM",
      to: "/event/view/empty",
    });
    expect(rows[3]).toMatchObject({
      subject: "Unnamed ambassador",
      reason: "Walk-up waiting for approval",
    });
    expect(rows[4]).toMatchObject({
      subject: "3 requests",
      reason: "Waiting more than 24 hours",
    });
    expect(rows[5].subject).toBe("1 request in the next 7 days");
  });
});
