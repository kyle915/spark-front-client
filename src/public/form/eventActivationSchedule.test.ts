import { describe, expect, it } from "vitest";
import {
  BA_COUNT_MAX,
  blankVisitSlot,
  buildQuickDatePresets,
  clampBaCount,
  computeCreateRequestBlocker,
  displayBaCount,
  isEventMultiDateTenant,
  showsBaCountSelector,
  showsEventActivationSchedule,
  showsLegacyBulkDates,
  visitSlotIssues,
  visitSlotsAfterPartialSuccess,
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

describe("computeCreateRequestBlocker & quick-date presets", () => {
  it("allows multi-date Event Activation when top-level date is empty but visitSlots are valid", () => {
    expect(
      computeCreateRequestBlocker({
        venue: "Festival Grounds",
        multiDateEvent: true,
        date: "",
        visitSlots: [
          row("2026-11-01", "12:00", "16:00"),
          row("2026-11-02", "14:00", "18:00"),
        ],
        schedulingStatus: "already_scheduled",
      }),
    ).toBeNull();
  });

  it("blocks multi-date Event Activation when visitSlots are incomplete", () => {
    expect(
      computeCreateRequestBlocker({
        venue: "Festival Grounds",
        multiDateEvent: true,
        date: "2026-11-01",
        visitSlots: [blankVisitSlot()],
        schedulingStatus: "already_scheduled",
      }),
    ).toBe("Date");
  });

  it("reports Venue, Date, Scheduling, Products, Request, and Co-brand blockers in order", () => {
    expect(
      computeCreateRequestBlocker({
        venue: "  ",
        multiDateEvent: false,
        date: "2026-11-01",
        visitSlots: [],
        schedulingStatus: "already_scheduled",
      }),
    ).toBe("Venue");

    expect(
      computeCreateRequestBlocker({
        venue: "HEB #12",
        multiDateEvent: false,
        date: "",
        visitSlots: [],
        schedulingStatus: "already_scheduled",
      }),
    ).toBe("Date");

    expect(
      computeCreateRequestBlocker({
        venue: "HEB #12",
        multiDateEvent: false,
        date: "2026-11-01",
        visitSlots: [],
        schedulingStatus: "",
      }),
    ).toBe("Scheduling");

    expect(
      computeCreateRequestBlocker({
        venue: "HEB #12",
        multiDateEvent: false,
        date: "2026-11-01",
        visitSlots: [],
        schedulingStatus: "needs_scheduling",
        showTorchNonActiveFields: true,
        nonActiveProductRequired: "",
      }),
    ).toBe("Products");

    expect(
      computeCreateRequestBlocker({
        venue: "HEB #12",
        multiDateEvent: false,
        date: "2026-11-01",
        visitSlots: [],
        schedulingStatus: "needs_scheduling",
        isTorch: true,
        torchActivationOk: false,
      }),
    ).toBe("Request");

    expect(
      computeCreateRequestBlocker({
        venue: "HEB #12",
        multiDateEvent: false,
        date: "2026-11-01",
        visitSlots: [],
        schedulingStatus: "needs_scheduling",
        coBrandMissing: "Co-brands",
      }),
    ).toBe("Co-brands");
  });

  it("builds quick-date presets including Today, Tomorrow, Fri, Sat, +7d, and +14d", () => {
    const presets = buildQuickDatePresets(new Date(2026, 9, 17, 15, 0, 0));
    expect(presets.map((p) => p.label)).toEqual([
      "TODAY",
      "TOMORROW",
      "FRI · Oct 23",
      "SAT · Oct 24",
      "+7D · Oct 24",
      "+14D · Oct 31",
    ]);
    expect(presets[0].iso).toBe("2026-10-17");
    expect(presets[1].iso).toBe("2026-10-18");
    expect(presets[5].iso).toBe("2026-10-31");
  });
});

describe("visitSlotsAfterPartialSuccess", () => {
  it("drops only the dates that already landed", () => {
    const slots = [
      row("2026-10-18"),
      row("2026-10-19", "13:00", "17:00"),
      row("2026-10-20"),
    ];
    expect(
      visitSlotsAfterPartialSuccess(slots, [row("2026-10-18"), row("2026-10-20")]),
    ).toEqual([row("2026-10-19", "13:00", "17:00")]);
  });

  it("drops one copy when two slots share a date and only one succeeded", () => {
    const slots = [row("2026-10-18"), row("2026-10-18")];
    expect(visitSlotsAfterPartialSuccess(slots, [row("2026-10-18")])).toEqual([
      row("2026-10-18"),
    ]);
  });
});
