import { describe, expect, it } from "vitest";
import {
  buildTrackerUrlParams,
  parseTrackerUrlParams,
  trackerDateRangeToServer,
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
    });
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
});
