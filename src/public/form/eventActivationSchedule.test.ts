import { describe, expect, it } from "vitest";
import {
  BA_COUNT_MAX,
  blankVisitSlot,
  clampBaCount,
  displayBaCount,
  isEventMultiDateTenant,
  showsBaCountSelector,
  showsEventActivationSchedule,
  showsLegacyBulkDates,
  visitSlotIssues,
  visitSlotsForSubmit,
  type VisitSlot,
} from "./eventActivationSchedule";

const row = (
  date: string,
  startTime = "12:00",
  endTime = "16:00",
): VisitSlot => ({ date, startTime, endTime });

describe("event activation multi-date tenants", () => {
  it("matches only Wook, FAMUS, and Alcohol Armor", () => {
    expect(isEventMultiDateTenant("wook-water")).toBe(true);
    expect(isEventMultiDateTenant("famus-energy")).toBe(true);
    expect(isEventMultiDateTenant("alcohol-armor")).toBe(true);
    expect(isEventMultiDateTenant(" FAMUS-ENERGY ")).toBe(true);
    expect(isEventMultiDateTenant("keee-torch-thc")).toBe(false);
    expect(isEventMultiDateTenant("ld")).toBe(false);
    expect(isEventMultiDateTenant(null, undefined, "")).toBe(false);
  });

  it("shows the date repeater only for Event Activation", () => {
    expect(showsEventActivationSchedule("Event Activation", "wook-water")).toBe(
      true,
    );
    expect(showsEventActivationSchedule("Retail Sampling", "wook-water")).toBe(
      false,
    );
    expect(
      showsEventActivationSchedule("Event Activation", "keee-torch-thc"),
    ).toBe(false);
    expect(showsEventActivationSchedule("On-Premise", "famus-energy")).toBe(
      false,
    );
  });

  it("keeps the legacy bulk control for every other tenant", () => {
    expect(showsLegacyBulkDates("keee-torch-thc")).toBe(true);
    expect(showsLegacyBulkDates("wook-water")).toBe(false);
    expect(showsBaCountSelector("Retail Sampling", "alcohol-armor")).toBe(
      false,
    );
    expect(showsBaCountSelector("Event Activation", "alcohol-armor")).toBe(
      true,
    );
    expect(showsBaCountSelector("Retail Sampling", "ld")).toBe(true);
  });
});

describe("visit slots", () => {
  it("drops extra rows that have no date", () => {
    const slots = [
      row("2026-11-01", "18:00", "22:00"),
      blankVisitSlot(row("", "18:00", "22:00")),
      row("2026-11-02", "10:00", "14:00"),
    ];
    expect(visitSlotsForSubmit(slots)).toEqual([
      row("2026-11-01", "18:00", "22:00"),
      row("2026-11-02", "10:00", "14:00"),
    ]);
    expect(visitSlotIssues(slots)).toBeNull();
  });

  it("requires the first row", () => {
    expect(visitSlotIssues([blankVisitSlot()])).toBe(
      "Each date needs a visit date, start time, and end time.",
    );
  });

  it("requires start and end once a date is set", () => {
    expect(visitSlotIssues([row("2026-11-01", "", "16:00")])).toBe(
      "Each date needs a visit date, start time, and end time.",
    );
  });

  it("allows an end time before the start (overnight)", () => {
    expect(visitSlotIssues([row("2026-11-01", "22:00", "01:30")])).toBeNull();
  });
});

describe("BA count", () => {
  it("clamps to 1–20", () => {
    expect(clampBaCount(0)).toBe(1);
    expect(clampBaCount(1)).toBe(1);
    expect(clampBaCount(20)).toBe(BA_COUNT_MAX);
    expect(clampBaCount(21)).toBe(20);
    expect(clampBaCount(Number.NaN)).toBe(1);
  });

  it("prefers the stored field and falls back to the notes line", () => {
    expect(displayBaCount(4, "BA count: 2")).toBe("4");
    expect(displayBaCount(null, "Notes\nBA count: 3")).toBe("3");
    expect(displayBaCount(undefined, "just notes")).toBeNull();
  });
});
