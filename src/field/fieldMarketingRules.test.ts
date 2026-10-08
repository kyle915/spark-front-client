import { describe, expect, it } from "vitest";
import { planInput, emptyPlanForm } from "./fieldMarketingForm";
import { TIME_OPTIONS, deleteConfirmCopy, isBooked, rowStatus } from "./fieldMarketingRules";
import type { FmEvent } from "./fieldMarketingTypes";

function row(overrides: Partial<FmEvent> = {}): FmEvent {
  return {
    id: "plan-1",
    market: "houston",
    marketLabel: "Houston",
    managerName: "Victoria Quintana",
    activity: "event_activation",
    activityLabel: "Event activation / sponsorship",
    name: "Montrose block party",
    startsOn: "2026-10-24",
    days: 1,
    address: "1500 Westheimer Rd, Houston, TX",
    notes: "",
    samplingFormat: "",
    samplingLabel: "",
    supportType: "",
    supportLabel: "",
    supportOther: "",
    skuNames: [],
    needsFieldSupport: true,
    ambassadorCount: 2,
    supportTimes: "",
    startTime: "",
    endTime: "",
    supportScope: "",
    plannedFullCans: 0,
    plannedPourSamples: 0,
    plannedEmails: 0,
    loggedFullCans: null,
    loggedPourSamples: null,
    loggedEmails: null,
    loggedDays: null,
    loggedCases: null,
    status: "planned",
    requestCode: null,
    requestUuid: null,
    requestCancelled: false,
    canBook: true,
    deleteEffect: "remove",
    deletedAt: null,
    deletedByName: "",
    deleteCancelledRequest: false,
    resultsCounted: 0,
    resultsPending: 0,
    ...overrides,
  };
}

describe("field marketing time picker", () => {
  it("lists every half hour from 12:00 AM through 11:30 PM", () => {
    expect(TIME_OPTIONS).toHaveLength(48);
    expect(TIME_OPTIONS[0]).toEqual({ value: "00:00", label: "12:00 AM" });
    expect(TIME_OPTIONS[1]).toEqual({ value: "00:30", label: "12:30 AM" });
    expect(TIME_OPTIONS[24]).toEqual({ value: "12:00", label: "12:00 PM" });
    expect(TIME_OPTIONS[47]).toEqual({ value: "23:30", label: "11:30 PM" });
  });
});

describe("delete confirm copy", () => {
  it("names the request a future booking cancels", () => {
    const copy = deleteConfirmCopy(
      row({
        status: "submitted",
        requestCode: "REQ-AB12",
        requestUuid: "u",
        deleteEffect: "cancel_request",
      }),
    );
    expect(copy.body).toContain("This also cancels REQ-AB12");
    expect(copy.confirmLabel).toBe("Delete + cancel REQ-AB12");
  });

  it("says the request and recap stay for past work", () => {
    const copy = deleteConfirmCopy(
      row({ status: "submitted", requestCode: "REQ-AB12", deleteEffect: "keep_request" }),
    );
    expect(copy.body).toContain("the request and recap stay");
    expect(copy.body).toContain("Only the plan is removed");
  });

  it("keeps drafts simple", () => {
    expect(deleteConfirmCopy(row()).body).toContain("The draft comes off the board");
  });
});

describe("row status", () => {
  it("flags a cancelled request instead of claiming it's booked", () => {
    const cancelled = row({ status: "submitted", requestCode: "REQ-AB12", requestCancelled: true });
    expect(isBooked(cancelled)).toBe(false);
    expect(rowStatus(cancelled)).toBe("REQ-AB12 cancelled");
    expect(rowStatus(row({ status: "submitted", requestCode: "REQ-AB12", requestUuid: "u" }))).toBe(
      "Ignite · REQ-AB12",
    );
  });
});

describe("plan input", () => {
  it("sends start/end for staffed tactics and clears them elsewhere", () => {
    const staffed = planInput({ ...emptyPlanForm, startTime: "22:00", endTime: "01:30" });
    expect(staffed.startTime).toBe("22:00");
    expect(staffed.endTime).toBe("01:30");
    const seeding = planInput({
      ...emptyPlanForm,
      activity: "product_seeding",
      startTime: "22:00",
      endTime: "01:30",
    });
    expect(seeding.startTime).toBe("");
    expect(seeding.endTime).toBe("");
  });
});
