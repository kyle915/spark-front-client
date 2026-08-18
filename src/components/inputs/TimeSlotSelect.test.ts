import { describe, it, expect } from "vitest";
import { TIME_SLOTS } from "./TimeSlotSelect";

/**
 * Public Spark request form (and admin request create) share TimeSlotSelect.
 * The dropdown used to start at 6:00 AM, which hid overnight / early-morning
 * starts (12:00 AM–5:30 AM) even when 11:00 PM could already be the value.
 */
describe("TIME_SLOTS — full 24-hour 30-minute grid", () => {
  it("starts at 12:00 AM and ends at 11:30 PM", () => {
    expect(TIME_SLOTS[0]).toEqual({ value: "00:00", label: "12:00 AM" });
    expect(TIME_SLOTS[TIME_SLOTS.length - 1]).toEqual({
      value: "23:30",
      label: "11:30 PM",
    });
  });

  it("includes every 30-minute slot from midnight through 5:30 AM", () => {
    const early = [
      ["00:00", "12:00 AM"],
      ["00:30", "12:30 AM"],
      ["01:00", "1:00 AM"],
      ["01:30", "1:30 AM"],
      ["02:00", "2:00 AM"],
      ["02:30", "2:30 AM"],
      ["03:00", "3:00 AM"],
      ["03:30", "3:30 AM"],
      ["04:00", "4:00 AM"],
      ["04:30", "4:30 AM"],
      ["05:00", "5:00 AM"],
      ["05:30", "5:30 AM"],
    ] as const;
    for (const [value, label] of early) {
      expect(TIME_SLOTS).toContainEqual({ value, label });
    }
  });

  it("keeps late-evening slots through 11:30 PM", () => {
    const late = [
      ["21:00", "9:00 PM"],
      ["21:30", "9:30 PM"],
      ["22:00", "10:00 PM"],
      ["22:30", "10:30 PM"],
      ["23:00", "11:00 PM"],
      ["23:30", "11:30 PM"],
    ] as const;
    for (const [value, label] of late) {
      expect(TIME_SLOTS).toContainEqual({ value, label });
    }
  });

  it("is 48 half-hour slots (no 24:00, no skipped overnight hours)", () => {
    expect(TIME_SLOTS).toHaveLength(48);
    const values = TIME_SLOTS.map((s) => s.value);
    expect(new Set(values).size).toBe(48);
    expect(values).not.toContain("24:00");
    expect(TIME_SLOTS.map((s) => s.label)[0]).toBe("12:00 AM");
  });
});
