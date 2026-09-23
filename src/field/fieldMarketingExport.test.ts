import { describe, expect, it } from "vitest";
import { fieldMarketingCsv, matchesTactic } from "./fieldMarketingExport";

describe("field marketing export", () => {
  it("keeps legacy can rows inside guerilla and leaves seeding out of that tactic", () => {
    expect(matchesTactic("full_can", "guerilla")).toBe(true);
    expect(matchesTactic("product_seeding", "guerilla")).toBe(false);
    expect(matchesTactic("sales_support", "")).toBe(true);
  });

  it("writes logged results and does not invent a monthly target column", () => {
    const csv = fieldMarketingCsv([
      {
        startsOn: "2026-09-12",
        marketLabel: "Miami",
        managerName: "Alec Aparicio",
        activity: "product_seeding",
        activityLabel: "Product seeding",
        supportLabel: "",
        supportOther: "",
        samplingLabel: "",
        skuNames: ["Black Cherry 10mg", "Nonactive"],
        name: "Wynwood, drop",
        days: 1,
        loggedFullCans: null,
        loggedPourSamples: null,
        loggedCases: 12,
        loggedEmails: 4,
        ambassadorCount: 0,
        status: "planned",
        requestCode: null,
      },
    ]);
    expect(csv.split("\n")[0]).not.toMatch(/target/i);
    expect(csv).toContain('"Wynwood, drop"');
    expect(csv).toContain("Black Cherry 10mg; Nonactive");
    expect(csv).toContain(",12,");
    expect(csv).toContain("Draft");
  });
});
