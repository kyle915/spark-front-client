import { describe, expect, it } from "vitest";
import { formatRecapFieldLabel } from "./recapFieldLabel";

describe("formatRecapFieldLabel", () => {
  it("sentence-cases shouting Liquid Death questions", () => {
    expect(formatRecapFieldLabel("TOTAL NUMBER OF CONSUMERS SAMPLED")).toBe(
      "Total number of consumers sampled",
    );
    expect(formatRecapFieldLabel("FIRST TIME CONSUMERS?")).toBe(
      "First time consumers?",
    );
  });

  it("corrects TASING on display without needing a data rewrite", () => {
    expect(
      formatRecapFieldLabel(
        "HOW MANY CONSUMERS WOULD BE WILLING TO PURCHASE THE PRODUCT AFTER TASING IT?",
      ),
    ).toBe(
      "How many consumers would be willing to purchase the product after tasting it?",
    );
    expect(
      formatRecapFieldLabel(
        "How many consumers would NOT be willing to purchase the product after tasing it?",
      ),
    ).toBe(
      "How many consumers would NOT be willing to purchase the product after tasting it?",
    );
  });

  it("leaves already-readable labels alone aside from the typo", () => {
    expect(formatRecapFieldLabel("Total number of consumers sampled")).toBe(
      "Total number of consumers sampled",
    );
    expect(formatRecapFieldLabel("First-time consumers")).toBe(
      "First-time consumers",
    );
  });
});
