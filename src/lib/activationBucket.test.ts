import { describe, expect, it } from "vitest";
import {
  activationBucketForTypeName,
  countsTowardConversion,
  normalizeRecapActivationFilter,
  recapMatchesActivationFilter,
} from "./activationBucket";

describe("activationBucketForTypeName", () => {
  it("classifies Liquid Death–style program names", () => {
    expect(activationBucketForTypeName("Retail Sampling")).toBe("retail");
    expect(activationBucketForTypeName("Liquid Death-Retail Sampling")).toBe(
      "retail",
    );
    expect(activationBucketForTypeName("On-Premise Sampling")).toBe("onprem");
    expect(activationBucketForTypeName("On-Premise")).toBe("onprem");
    expect(activationBucketForTypeName("Event Activation")).toBe("event");
    expect(activationBucketForTypeName("Liquid Death-Event Activation")).toBe(
      "event",
    );
  });

  it("returns other when the name does not match", () => {
    expect(activationBucketForTypeName(null)).toBe("other");
    expect(activationBucketForTypeName("Demo Table")).toBe("other");
  });

  it("keeps Product Seeding under View all (not Event)", () => {
    expect(activationBucketForTypeName("Product Seeding")).toBe("other");
    expect(activationBucketForTypeName("Liquid Death-Product Seeding")).toBe(
      "other",
    );
    expect(countsTowardConversion("Product Seeding")).toBe(false);
    expect(recapMatchesActivationFilter("Product Seeding", "event")).toBe(
      false,
    );
    expect(recapMatchesActivationFilter("Product Seeding", "retail")).toBe(
      false,
    );
    expect(recapMatchesActivationFilter("Product Seeding", "all")).toBe(true);
  });
});

describe("countsTowardConversion", () => {
  it("includes retail and on-premise only", () => {
    expect(countsTowardConversion("Retail Sampling")).toBe(true);
    expect(countsTowardConversion("On-Premise Sampling")).toBe(true);
    expect(countsTowardConversion("Event Activation")).toBe(false);
    expect(countsTowardConversion(null)).toBe(false);
  });
});

describe("recapMatchesActivationFilter", () => {
  it("folds on-premise into Retail and leaves Other for View all", () => {
    expect(recapMatchesActivationFilter("Retail Sampling", "retail")).toBe(
      true,
    );
    expect(recapMatchesActivationFilter("On-Premise Sampling", "retail")).toBe(
      true,
    );
    expect(recapMatchesActivationFilter("Event Activation", "retail")).toBe(
      false,
    );
    expect(recapMatchesActivationFilter("Event Activation", "event")).toBe(
      true,
    );
    expect(recapMatchesActivationFilter("Demo Table", "event")).toBe(false);
    expect(recapMatchesActivationFilter("Demo Table", "all")).toBe(true);
    expect(recapMatchesActivationFilter(null, "retail")).toBe(false);
  });
});

describe("normalizeRecapActivationFilter", () => {
  it("accepts retail/event and defaults everything else to all", () => {
    expect(normalizeRecapActivationFilter("retail")).toBe("retail");
    expect(normalizeRecapActivationFilter("event")).toBe("event");
    expect(normalizeRecapActivationFilter("onprem")).toBe("all");
    expect(normalizeRecapActivationFilter(null)).toBe("all");
  });
});
