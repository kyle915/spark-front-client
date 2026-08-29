import { describe, expect, it } from "vitest";
import {
  trackerDateRangeToServer,
  trackerStatusToServer,
  trackerSortToServer,
} from "@/requests/masterTrackerFilters";

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
});
