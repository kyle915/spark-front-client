import { describe, expect, it } from "vitest";
import {
  activationBucketForTypeName,
  countsTowardConversion,
  normalizeRecapActivationFilter,
  recapActivationFilterLabel,
  recapMatchesActivationFilter,
  recapTypeCountsTowardConversion,
  recapTypeForRow,
} from "./activationBucket";

describe("activationBucketForTypeName", () => {
  it("classifies Liquid Death–style program names", () => {
    expect(activationBucketForTypeName("Retail Sampling")).toBe("retail");
    expect(activationBucketForTypeName("Liquid Death-Retail Sampling")).toBe(
      "retail",
    );
    expect(activationBucketForTypeName("On-Premise Sampling")).toBe("onprem");
    expect(activationBucketForTypeName("On-Premise")).toBe("onprem");
    expect(
      activationBucketForTypeName("Mark Anthony Brands-On-Premise"),
    ).toBe("onprem");
    expect(activationBucketForTypeName("Event Activation")).toBe("event");
    expect(activationBucketForTypeName("Liquid Death-Event Activation")).toBe(
      "event",
    );
  });

  it("returns other when the name does not match", () => {
    expect(activationBucketForTypeName(null)).toBe("other");
    expect(activationBucketForTypeName("Demo Table")).toBe("other");
  });

  it("classifies Product Seeding as seeding (not Event)", () => {
    expect(activationBucketForTypeName("Product Seeding")).toBe("seeding");
    expect(activationBucketForTypeName("Liquid Death-Product Seeding")).toBe(
      "seeding",
    );
    expect(activationBucketForTypeName("Seed drop")).toBe("other");
    expect(countsTowardConversion("Product Seeding")).toBe(false);
  });
});

describe("countsTowardConversion", () => {
  it("includes retail and on-premise only", () => {
    expect(countsTowardConversion("Retail Sampling")).toBe(true);
    expect(countsTowardConversion("On-Premise Sampling")).toBe(true);
    expect(countsTowardConversion("Event Activation")).toBe(false);
    expect(countsTowardConversion("Product Seeding")).toBe(false);
    expect(countsTowardConversion(null)).toBe(false);
  });
});

describe("recapTypeForRow", () => {
  it("trusts the server recap type", () => {
    expect(recapTypeForRow("guerilla", "Torch THC-Event Activation")).toBe(
      "guerilla",
    );
    expect(recapTypeForRow("onprem", null)).toBe("onprem");
  });

  it("falls back to the name, unknown is retail", () => {
    expect(recapTypeForRow(null, "Torch THC · Guerilla Recap")).toBe(
      "guerilla",
    );
    expect(recapTypeForRow(undefined, "Liquid Death-Product Seeding")).toBe(
      "seeding",
    );
    expect(recapTypeForRow("bogus", "Event Activation")).toBe("event");
    expect(recapTypeForRow(null, "Feel Free · Sampling Recap")).toBe("retail");
    expect(recapTypeForRow(null, null)).toBe("retail");
  });
});

describe("recapTypeCountsTowardConversion", () => {
  it("is Retail + On-Premise only", () => {
    expect(recapTypeCountsTowardConversion("retail")).toBe(true);
    expect(recapTypeCountsTowardConversion("onprem")).toBe(true);
    expect(recapTypeCountsTowardConversion("event")).toBe(false);
    expect(recapTypeCountsTowardConversion("guerilla")).toBe(false);
    expect(recapTypeCountsTowardConversion("seeding")).toBe(false);
  });
});

describe("recapMatchesActivationFilter", () => {
  it("matches one type exactly; All matches everything", () => {
    expect(recapMatchesActivationFilter("retail", "retail")).toBe(true);
    expect(recapMatchesActivationFilter("onprem", "retail")).toBe(false);
    expect(recapMatchesActivationFilter("guerilla", "event")).toBe(false);
    expect(recapMatchesActivationFilter("guerilla", "guerilla")).toBe(true);
    expect(recapMatchesActivationFilter("seeding", "all")).toBe(true);
  });
});

describe("normalizeRecapActivationFilter", () => {
  it("accepts every recap type and defaults everything else to all", () => {
    expect(normalizeRecapActivationFilter("retail")).toBe("retail");
    expect(normalizeRecapActivationFilter("event")).toBe("event");
    expect(normalizeRecapActivationFilter("seeding")).toBe("seeding");
    expect(normalizeRecapActivationFilter("guerilla")).toBe("guerilla");
    expect(normalizeRecapActivationFilter("onprem")).toBe("onprem");
    expect(normalizeRecapActivationFilter("product_seeding")).toBe("all");
    expect(normalizeRecapActivationFilter(null)).toBe("all");
  });
});

describe("recapActivationFilterLabel", () => {
  it("labels chips for the toolbar and filter pills", () => {
    expect(recapActivationFilterLabel("all")).toBe("All");
    expect(recapActivationFilterLabel("retail")).toBe("Retail");
    expect(recapActivationFilterLabel("onprem")).toBe("On-Premise");
    expect(recapActivationFilterLabel("event")).toBe("Event");
    expect(recapActivationFilterLabel("guerilla")).toBe("Guerilla");
    expect(recapActivationFilterLabel("seeding")).toBe("Seeding");
  });
});
