import { describe, expect, it } from "vitest";
import { scanRecapLine } from "./scanLine";

describe("scanRecapLine", () => {
  it("is one line of who, activation, date, status, and engagements", () => {
    expect(
      scanRecapLine({
        who: "Dane Burman",
        activation: "Product Seeding",
        date: "11/21/2026",
        status: "Needs review",
        engagements: 50,
      }),
    ).toBe("Dane Burman · Product Seeding · 11/21/2026 · Needs review · 50 engagements");
  });

  it("does not invent an engagements number", () => {
    expect(
      scanRecapLine({
        who: "",
        activation: "",
        date: "",
        status: "Needs review",
        engagements: null,
      }),
    ).toBe("Unattributed · Activation · No date · Needs review · —");
  });
});