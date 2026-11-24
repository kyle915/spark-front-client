import { describe, expect, it } from "vitest";
import { scanRecapLine } from "./scanLine";

describe("scanRecapLine", () => {
  it("is one line: who, activation, date, status, engagements", () => {
    expect(
      scanRecapLine({
        who: "Dane Burman",
        activation: "Seeding",
        date: "Nov 21, 2026",
        status: "Needs review",
        engagements: 50,
      }),
    ).toBe("Dane Burman · Seeding · Nov 21, 2026 · Needs review · 50 engagements");
  });

  it("keeps the line when a name or a count is missing", () => {
    expect(
      scanRecapLine({
        who: "  ",
        activation: "",
        date: "",
        status: "Approved",
        engagements: null,
      }),
    ).toBe("Unattributed · Activation · No date · Approved · — engagements");
  });

  it("uses the singular when there is one engagement", () => {
    expect(
      scanRecapLine({
        who: "Ada",
        activation: "Retail",
        date: "Nov 1, 2026",
        status: "Approved",
        engagements: 1,
      }),
    ).toContain("1 engagement");
  });
});
