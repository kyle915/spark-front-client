import { describe, expect, it } from "vitest";
import {
  calloutLinkLabel,
  calloutRecapsHref,
  cleanChartQuestion,
  MAX_CHART_QUESTION,
  sampleNextKindLabel,
  sampleNextLine,
} from "./dashboardExplain";

describe("calloutRecapsHref", () => {
  it("filters the recaps list to a store and its dates", () => {
    const href = calloutRecapsHref({
      store: "H-E-B #42",
      state: null,
      startDate: "2026-10-16",
      endDate: "2026-11-15",
    });
    const url = new URL(href, "https://x.test");
    expect(url.pathname).toBe("/recaps/list");
    expect(url.searchParams.get("status")).toBe("approved");
    expect(url.searchParams.get("retailer")).toBe("H-E-B #42");
    expect(url.searchParams.get("from")).toBe("2026-10-16");
    expect(url.searchParams.get("to")).toBe("2026-11-15");
    expect(url.searchParams.has("state")).toBe(false);
  });

  it("filters to a state", () => {
    const url = new URL(
      calloutRecapsHref({ state: "TX", startDate: "2026-08-01", endDate: "2026-11-15" }),
      "https://x.test",
    );
    expect(url.searchParams.get("state")).toBe("TX");
    expect(url.searchParams.has("retailer")).toBe(false);
  });

  it("opens the needs-review recaps for a state waiting for review", () => {
    const link = { state: "NY", startDate: "2026-10-19", endDate: "2026-11-15" };
    const url = new URL(calloutRecapsHref(link, "state_waiting_review"), "https://x.test");
    expect(url.pathname).toBe("/recaps/list");
    expect(url.searchParams.get("status")).toBe("needs_review");
    expect(url.searchParams.get("state")).toBe("NY");
    expect(url.searchParams.get("from")).toBe("2026-10-19");
    expect(url.searchParams.get("to")).toBe("2026-11-15");
    expect(calloutLinkLabel(link, "state_waiting_review")).toBe("Review the recaps in NY");
    // Every other kind keeps the approved list.
    expect(new URL(calloutRecapsHref(link, "state_quiet"), "https://x.test").searchParams.get("status")).toBe("approved");
  });

  it("leaves the dates off when there are none", () => {
    expect(calloutRecapsHref({})).toBe("/recaps/list?status=approved");
  });
});

describe("calloutLinkLabel", () => {
  it("names the store, then the state, then nothing", () => {
    expect(calloutLinkLabel({ store: "Kroger" })).toBe("See the recaps at Kroger");
    expect(calloutLinkLabel({ state: "TX" })).toBe("See the recaps in TX");
    expect(calloutLinkLabel({})).toBe("See the recaps");
  });
});

describe("cleanChartQuestion", () => {
  it("folds whitespace and caps the length", () => {
    expect(cleanChartQuestion("  which   store\nled? ")).toBe("which store led?");
    expect(cleanChartQuestion("   ")).toBe("");
    expect(cleanChartQuestion("x".repeat(900))).toHaveLength(MAX_CHART_QUESTION);
  });
});

describe("sampleNextKindLabel", () => {
  it("reads in plain words", () => {
    expect(sampleNextKindLabel("revisit")).toBe("Worth going back to");
    expect(sampleNextKindLabel("never_visited")).toBe("Never visited");
  });
});

describe("sampleNextLine", () => {
  it("keeps the store, the rate against the average, and the weeks", () => {
    expect(
      sampleNextLine({
        name: "Walmart",
        market: "TX",
        reason:
          "Converted at 55.9% against a 15.2% average, last visited 44 weeks ago.",
      }),
    ).toBe("Walmart · TX · 55.9% vs 15.2% · 44 weeks");
  });

  it("does not invent a rate the reason does not contain", () => {
    expect(
      sampleNextLine({
        name: "H-E-B",
        market: "TX",
        reason: "Never visited. No store nearby has results to compare yet.",
      }),
    ).toBe("H-E-B · TX · never visited");
  });
});
