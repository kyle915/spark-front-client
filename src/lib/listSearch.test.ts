import { describe, expect, it } from "vitest";
import {
  EMPTY_LIST_FILTER,
  conditionText,
  dateRangeLabel,
  filterChips,
  filterFromServer,
  fullListHref,
  isEmptyFilter,
  resultCountLine,
  rowFigures,
  rowHref,
  rowPlaceLine,
  rowStatusLabel,
  toFilterInput,
  withoutChip,
  type ListFilter,
} from "./listSearch";

const october: ListFilter = {
  ...EMPTY_LIST_FILTER,
  state: "tx",
  store: " Kroger ",
  dateFrom: "2026-10-01",
  dateTo: "2026-10-31",
  conditions: [{ metric: "conversion", op: "lt", value: 10 }],
};

describe("the filter sent to the server", () => {
  it("sends blanks as null and the state in capitals", () => {
    expect(toFilterInput(october)).toEqual({
      state: "TX",
      city: null,
      store: "Kroger",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      status: null,
      activationType: null,
      product: null,
      conditions: [{ metric: "conversion", op: "lt", value: 10 }],
    });
  });

  it("drops a date that is not a date and a figure with no number", () => {
    const input = toFilterInput({
      ...EMPTY_LIST_FILTER,
      dateFrom: "October",
      conditions: [{ metric: "consumers", op: "gt", value: Number.NaN }],
    });
    expect(input.dateFrom).toBeNull();
    expect(input.conditions).toEqual([]);
  });

  it("is empty until something is asked for; a status alone is not a search", () => {
    expect(isEmptyFilter(EMPTY_LIST_FILTER)).toBe(true);
    expect(isEmptyFilter({ ...EMPTY_LIST_FILTER, status: "approved" })).toBe(true);
    expect(isEmptyFilter({ ...EMPTY_LIST_FILTER, city: "Dallas" })).toBe(false);
    expect(isEmptyFilter(october)).toBe(false);
  });

  it("reads the server's filter back, leaving out what it does not know", () => {
    const read = filterFromServer({
      state: "TX",
      store: null,
      conditions: [
        { metric: "conversion", op: "lt", value: 10 },
        { metric: "cost_per_sample", op: "lt", value: 2 },
      ],
    });
    expect(read.state).toBe("TX");
    expect(read.store).toBe("");
    expect(read.conditions).toEqual([{ metric: "conversion", op: "lt", value: 10 }]);
  });
});

describe("chips", () => {
  it("shows one chip per thing asked for", () => {
    expect(filterChips(october, "events", true).map((c) => c.text)).toEqual([
      "Store: Kroger",
      "State: TX",
      "Event date: Oct 1, 2026 to Oct 31, 2026",
      "Conversion under 10%",
    ]);
  });

  it("shows the recap status to staff on the recaps list only", () => {
    const f = { ...october, status: "needs_review" };
    expect(filterChips(f, "recaps", false).some((c) => c.key === "status")).toBe(true);
    expect(filterChips(f, "recaps", true).some((c) => c.key === "status")).toBe(false);
    expect(filterChips(f, "events", false).some((c) => c.key === "status")).toBe(false);
  });

  it("removes exactly the chip that was closed", () => {
    expect(withoutChip(october, "cond:0").conditions).toEqual([]);
    expect(withoutChip(october, "date")).toMatchObject({ dateFrom: "", dateTo: "", state: "tx" });
    expect(withoutChip(october, "store").store).toBe("");
    expect(withoutChip(october, "unknown")).toBe(october);
  });

  it("words a condition and a date range plainly", () => {
    expect(conditionText({ metric: "consumers", op: "gte", value: 1500 })).toBe(
      "Consumers sampled at least 1,500",
    );
    expect(conditionText({ metric: "units_sold", op: "eq", value: 0 })).toBe(
      "Units sold exactly 0",
    );
    expect(dateRangeLabel("2026-10-05", "2026-10-05")).toBe("Oct 5, 2026");
    expect(dateRangeLabel("2026-10-05", null)).toBe("From Oct 5, 2026");
    expect(dateRangeLabel(null, "2026-10-05")).toBe("Through Oct 5, 2026");
    expect(dateRangeLabel(null, null)).toBe("");
  });
});

describe("result rows", () => {
  const recap = {
    kind: "custom",
    uuid: "abc",
    store: "Kroger",
    city: "Houston",
    state: "TX",
    date: "2026-10-05",
    activationType: "retail",
    status: "needs_review",
    consumers: 1200,
    unitsSold: 60,
    conversion: 5,
  };

  it("opens the right page", () => {
    expect(rowHref(recap)).toBe("/recap/view-custom/abc");
    expect(rowHref({ kind: "legacy", uuid: "abc" })).toBe("/recap/view/abc");
    expect(rowHref({ kind: "event", uuid: "e1", requestUuid: "r1" })).toBe("/request/view/r1");
    expect(rowHref({ kind: "event", uuid: "e1", requestUuid: null })).toBe("/event/view/e1");
  });

  it("says where and when, and only the figures the row has", () => {
    expect(rowPlaceLine(recap)).toBe("Oct 5, 2026 · Kroger · Houston, TX · Retail");
    expect(rowFigures(recap)).toBe("1,200 sampled · 60 sold · 5% conversion");
    expect(rowFigures({ ...recap, consumers: null, unitsSold: null, conversion: null })).toBe("");
    expect(
      rowFigures({
        ...recap,
        kind: "event",
        recapCount: 0,
        consumers: null,
        unitsSold: null,
        conversion: null,
      }),
    ).toBe("No approved recap");
  });

  it("never shows a review state to a client", () => {
    expect(rowStatusLabel(recap, false)).toBe("Needs review");
    expect(rowStatusLabel(recap, true)).toBe("");
    expect(rowStatusLabel({ kind: "custom", status: "approved" }, false)).toBe("");
    expect(rowStatusLabel({ kind: "event", status: "" }, false)).toBe("");
  });

  it("counts the results", () => {
    expect(resultCountLine("recaps", 0, 0)).toBe(
      "No recaps match. Remove a filter to widen the search.",
    );
    expect(resultCountLine("events", 1, 1)).toBe("1 event");
    expect(resultCountLine("recaps", 1200, 100)).toBe("1,200 recaps, showing the first 100");
  });
});

describe("the same search in the full list", () => {
  it("uses the list's own URL filters", () => {
    expect(fullListHref({ ...october, conditions: [] })).toBe(
      "/recaps/list?status=approved&retailer=Kroger&state=TX&from=2026-10-01&to=2026-10-31",
    );
    expect(fullListHref({ ...EMPTY_LIST_FILTER, state: "CA", status: "needs_review" })).toBe(
      "/recaps/list?status=needs_review&state=CA&range=all",
    );
  });

  it("is not offered when the list cannot filter on what was asked", () => {
    expect(fullListHref(october)).toBeNull();
    expect(fullListHref({ ...EMPTY_LIST_FILTER, city: "Dallas" })).toBeNull();
    expect(fullListHref({ ...EMPTY_LIST_FILTER, product: "Citrus" })).toBeNull();
    expect(fullListHref(EMPTY_LIST_FILTER)).toBeNull();
  });
});
