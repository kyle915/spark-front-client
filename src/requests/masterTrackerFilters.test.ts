import { describe, expect, it } from "vitest";
import {
  buildTrackerUrlParams,
  parseTrackerUrlParams,
  trackerDateRangeToServer,
  trackerExportMatching,
  trackerExportScope,
  trackerStatusCount,
  trackerStatusToServer,
  trackerSortToServer,
} from "./masterTrackerFilters";

describe("masterTrackerFilters", () => {
  it("maps active status to multiple slugs", () => {
    expect(trackerStatusToServer("active")).toEqual({
      statusSlugs: ["pending", "queue", "approved", "scheduled"],
    });
  });

  it("maps single status slug", () => {
    expect(trackerStatusToServer("done")).toEqual({ statusSlug: "done" });
  });

  it("maps date sort modes", () => {
    expect(trackerSortToServer("date-asc")).toEqual({ dateSort: "asc" });
    expect(trackerSortToServer("venue")).toEqual({});
  });

  it("returns bounds for next7", () => {
    const { startDate, endDate } = trackerDateRangeToServer("next7");
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses URL search params and falls back to defaults for unknown values", () => {
    expect(parseTrackerUrlParams(new URLSearchParams())).toEqual({
      status: "active",
      dateRange: "all",
      market: "all",
      planId: null,
      customRange: null,
    });

    expect(
      parseTrackerUrlParams(
        new URLSearchParams("status=done&when=next30&market=ca&plan=42"),
      ),
    ).toEqual({
      status: "done",
      dateRange: "next30",
      market: "CA",
      planId: "42",
      customRange: null,
    });

    expect(
      parseTrackerUrlParams(
        new URLSearchParams("status=bogus&when=yesterday&market=ALL"),
      ),
    ).toEqual({
      status: "active",
      dateRange: "all",
      market: "all",
      planId: null,
      customRange: null,
    });
  });

  it("parses a custom from/to range and rejects invalid ones", () => {
    expect(
      parseTrackerUrlParams(
        new URLSearchParams("when=custom&from=2026-10-19&to=2026-10-25"),
      ),
    ).toMatchObject({
      dateRange: "custom",
      customRange: { startDate: "2026-10-19", endDate: "2026-10-25" },
    });

    for (const qs of [
      "when=custom&from=2026-10-25&to=2026-10-19",
      "when=custom&from=2026-02-30&to=2026-10-19",
      "when=custom&from=2026-10-19",
      "when=next7&from=2026-10-19&to=2026-10-25",
    ]) {
      expect(parseTrackerUrlParams(new URLSearchParams(qs))).toMatchObject({
        customRange: null,
      });
    }
    expect(
      parseTrackerUrlParams(
        new URLSearchParams("when=custom&from=bad&to=2026-10-19"),
      ).dateRange,
    ).toBe("all");
  });

  it("maps a custom range to server bounds", () => {
    expect(
      trackerDateRangeToServer("custom", {
        startDate: "2026-10-19",
        endDate: "2026-10-25",
      }),
    ).toEqual({ startDate: "2026-10-19", endDate: "2026-10-25" });
    expect(trackerDateRangeToServer("custom", null)).toEqual({});
    expect(
      trackerDateRangeToServer("custom", {
        startDate: "2026-10-25",
        endDate: "2026-10-19",
      }),
    ).toEqual({});
  });

  it("builds and clears custom range params", () => {
    const built = buildTrackerUrlParams(new URLSearchParams(), {
      dateRange: "custom",
      customRange: { startDate: "2026-10-19", endDate: "2026-10-25" },
    });
    expect(built.get("when")).toBe("custom");
    expect(built.get("from")).toBe("2026-10-19");
    expect(built.get("to")).toBe("2026-10-25");

    const preset = buildTrackerUrlParams(built, { dateRange: "next7" });
    expect(preset.get("when")).toBe("next7");
    expect(preset.get("from")).toBeNull();
    expect(preset.get("to")).toBeNull();

    const cleared = buildTrackerUrlParams(built, { customRange: null });
    expect(cleared.get("when")).toBeNull();
    expect(cleared.get("from")).toBeNull();
    expect(cleared.get("to")).toBeNull();
  });

  it("builds URL search params while omitting default values", () => {
    const initial = new URLSearchParams("foo=bar");
    const updated = buildTrackerUrlParams(initial, {
      status: "pending",
      dateRange: "next7",
      market: "tx",
      planId: "99",
    });
    expect(updated.get("foo")).toBe("bar");
    expect(updated.get("status")).toBe("pending");
    expect(updated.get("when")).toBe("next7");
    expect(updated.get("market")).toBe("TX");
    expect(updated.get("plan")).toBe("99");

    const cleared = buildTrackerUrlParams(updated, {
      status: "active",
      dateRange: "all",
      market: "all",
      planId: null,
    });
    expect(cleared.toString()).toBe("foo=bar");
  });

  it("rolls Active up and leaves All as the tracker total", () => {
    const counts = { pending: 1, queue: 0, approved: 1, scheduled: 0, done: 4 };
    expect(trackerStatusCount("all", counts, 1068)).toBe(1068);
    expect(trackerStatusCount("active", counts, 1068)).toBe(2);
    expect(trackerStatusCount("pending", counts, 1068)).toBe(1);
  });

  it("names a partial export instead of a bare page size", () => {
    expect(trackerExportScope(0, 1068)).toBe("");
    expect(trackerExportScope(50, 1068)).toBe("50 loaded of 1,068");
    expect(trackerExportScope(12, 12)).toBe("12");
  });

  it("keeps a REQ lookup off the tracker total", () => {
    expect(trackerExportMatching("REQ-1A2B", 1, 1068)).toBe(1);
    expect(trackerExportMatching("req ab", 1, 1068)).toBe(1);
    expect(trackerExportMatching("kroger", 50, 1068)).toBe(1068);
    expect(
      trackerExportScope(1, trackerExportMatching("REQ-1A2B", 1, 1068)),
    ).toBe("1");
  });
});
