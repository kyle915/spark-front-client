import { describe, expect, it } from "vitest";
import {
  activationBucketForTypeName,
  countsTowardConversion,
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
});

describe("countsTowardConversion", () => {
  it("includes retail and on-premise only", () => {
    expect(countsTowardConversion("Retail Sampling")).toBe(true);
    expect(countsTowardConversion("On-Premise Sampling")).toBe(true);
    expect(countsTowardConversion("Event Activation")).toBe(false);
    expect(countsTowardConversion(null)).toBe(false);
  });
});
