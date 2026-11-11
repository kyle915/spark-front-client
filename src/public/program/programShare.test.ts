import { describe, expect, it } from "vitest";
import { programLinkUrl, programStats, shareStatusLine } from "./programShare";

const totals = {
  activations: 42,
  events: 60,
  consumersReached: 12400,
  samplesDistributed: 0,
  productsSold: 980,
  states: 1,
};

describe("public program page", () => {
  it("formats the tiles and leaves out figures that were never recorded", () => {
    expect(programStats(totals)).toEqual([
      { label: "Activations", value: "42" },
      { label: "Consumers reached", value: "12,400" },
      { label: "Products sold", value: "980" },
      { label: "State", value: "1" },
    ]);
  });

  it("pluralises states", () => {
    const stats = programStats({ ...totals, states: 7 });
    expect(stats.at(-1)).toEqual({ label: "States", value: "7" });
  });

  it("builds the public link", () => {
    expect(programLinkUrl("https://client.example.co/", "a:b")).toBe(
      "https://client.example.co/program/a%3Ab",
    );
  });

  it("summarises opens and the end date", () => {
    expect(shareStatusLine({ views: 0, lastViewedAt: null, expiresAt: null })).toBe(
      "Not opened yet · No end date",
    );
    const line = shareStatusLine({
      views: 12,
      lastViewedAt: "2026-11-09T15:00:00Z",
      expiresAt: "2026-12-10T15:00:00Z",
    });
    expect(line).toMatch(/^Opened 12 times, last Nov \d+, 2026 · Works until Dec \d+, 2026$/);
    expect(shareStatusLine({ views: 1, lastViewedAt: null, expiresAt: null })).toBe(
      "Opened 1 time · No end date",
    );
  });
});
