import { describe, expect, it } from "vitest";
import {
  activationLabel,
  dayLabel,
  isStoreKey,
  linksForLabels,
  monthKey,
  monthOfDate,
  percent,
  previousMonth,
  recapHref,
  storeHref,
  visitSeries,
  visitStatusLabel,
} from "./storeProfile";

describe("store links", () => {
  it("links only a key with the shape of a store key", () => {
    expect(storeHref("s42")).toBe("/store/s42");
    expect(storeHref(" s42 ")).toBe("/store/s42");
    for (const bad of ["list:abc", "42", "s", "s4/../x", "", null, undefined]) {
      expect(storeHref(bad)).toBeNull();
      expect(isStoreKey(bad)).toBe(false);
    }
  });

  it("opens a recap by its kind", () => {
    expect(recapHref("custom", "u1")).toBe("/recap/view-custom/u1");
    expect(recapHref("legacy", "u1")).toBe("/recap/view/u1");
    expect(recapHref(null, "u1")).toBe("/recap/view-custom/u1");
  });

  it("links a chart row only when its name is one store", () => {
    const links = [
      { name: "Costco", storeKey: "s7" },
      { name: "Bad", storeKey: "list:1" },
    ];
    expect(linksForLabels(["costco ", "Kroger", "Costco", "Bad"], links)).toEqual([
      { name: "costco", href: "/store/s7" },
    ]);
    expect(linksForLabels([], links)).toEqual([]);
  });
});

describe("what the store page says", () => {
  it("never tells a client a recap is in review", () => {
    expect(visitStatusLabel("recap_in_review", true)).toBe("Recap in review");
    expect(visitStatusLabel("recap_in_review", false)).toBe("No approved recap");
    expect(visitStatusLabel("recap_approved", false)).toBe("Recap approved");
    expect(visitStatusLabel("upcoming", false)).toBe("Upcoming");
    expect(visitStatusLabel("no_approved_recap", true)).toBe("No approved recap");
  });

  it("formats days, types and rates", () => {
    expect(dayLabel("2026-10-05")).toBe("Oct 5, 2026");
    expect(dayLabel("2026-10-05T18:00:00")).toBe("Oct 5, 2026");
    expect(dayLabel("nope")).toBe("");
    expect(activationLabel("onprem")).toBe("On-Premise");
    expect(activationLabel("mystery")).toBe("");
    expect(percent(16.2)).toBe("16.2%");
    expect(percent(null)).toBe("—");
  });

  it("charts visits oldest first, and only with three or more figures", () => {
    const visits = [
      { date: "2026-10-07", consumers: 30 },
      { date: "2026-10-05", consumers: 10 },
      { date: "2026-10-06", consumers: null },
      { date: "2026-10-09", consumers: 20 },
    ];
    expect(visitSeries(visits)).toEqual({
      labels: ["Oct 5", "Oct 7", "Oct 9"],
      values: [10, 30, 20],
    });
    expect(visitSeries(visits.slice(0, 3))).toEqual({ labels: [], values: [] });
  });
});

describe("months for the highlight", () => {
  it("names a month and the one before it", () => {
    expect(monthKey(new Date(2026, 10, 15))).toBe("2026-11");
    expect(previousMonth("2026-11")).toBe("2026-10");
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("soon")).toBe("");
    expect(monthOfDate("2026-10-31")).toBe("2026-10");
    expect(monthOfDate("")).toBe("");
  });
});
