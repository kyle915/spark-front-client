import { describe, expect, it } from "vitest";
import {
  formatRecapFieldLabel,
  formatRecapProductName,
  recapLabelsMatch,
} from "./recapFieldLabel";

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

describe("formatRecapProductName", () => {
  it("turns shouting catalog SKUs into readable flavor identity", () => {
    expect(formatRecapProductName("SPARKLING WATER - STRAWBERRY TERROR")).toBe(
      "Sparkling water · Strawberry Terror",
    );
    expect(formatRecapProductName("SPARKLING WATER - SEVERED LIME")).toBe(
      "Sparkling water · Severed Lime",
    );
    expect(formatRecapProductName("SPARKLING WATER - DOCTOR DEATH")).toBe(
      "Sparkling water · Doctor Death",
    );
  });

  it("title-cases a shouting name with no flavor split", () => {
    expect(formatRecapProductName("LIQUID DEATH")).toBe("Liquid Death");
  });

  it("leaves an already-readable name alone", () => {
    expect(formatRecapProductName("Strawberry Terror")).toBe("Strawberry Terror");
  });
});

describe("recapLabelsMatch", () => {
  it("treats shouting and sentence-case as the same header", () => {
    expect(recapLabelsMatch("PRODUCTS SAMPLED", "Products Sampled")).toBe(true);
    expect(recapLabelsMatch("Summary", "Consumer engagement")).toBe(false);
  });
});
