import { describe, it, expect } from "vitest";
import { clientRecapKpis } from "./clientRecapKpis";

describe("clientRecapKpis", () => {
  it("shows ENG / SOLD / CONV / photos when both numbers exist", () => {
    expect(
      clientRecapKpis({
        engagements: 80,
        soldUnits: 12,
        unitsSampled: 40,
        photoCount: 9,
      }),
    ).toEqual([
      { label: "Engagements", value: "80" },
      { label: "Sold", value: "12" },
      { label: "Conv", value: "15%" },
      { label: "Photos", value: "9" },
    ]);
  });

  it("falls back to sampled when sold is missing — never a fake conv", () => {
    expect(
      clientRecapKpis({
        engagements: 80,
        soldUnits: null,
        unitsSampled: 40,
        photoCount: 3,
      }),
    ).toEqual([
      { label: "Engagements", value: "80" },
      { label: "Sampled", value: "40" },
      { label: "Photos", value: "3" },
    ]);
  });

  it("skips conv when engagements are zero", () => {
    const labels = clientRecapKpis({
      engagements: 0,
      soldUnits: 4,
      unitsSampled: 0,
      photoCount: 2,
    }).map((k) => k.label);
    expect(labels).toEqual(["Engagements", "Sold", "Photos"]);
  });

  it("divides by consumers sampled, not engagements (reach)", () => {
    expect(
      clientRecapKpis({
        engagements: 300,
        consumersSampled: 80,
        soldUnits: 20,
        unitsSampled: 0,
        photoCount: 4,
        activationType: "Torch THC-Retail Sampling",
      }).find((k) => k.label === "Conv"),
    ).toEqual({ label: "Conv", value: "25%" });
  });

  it("never shows conv on an Event activation recap", () => {
    const labels = clientRecapKpis({
      engagements: 500,
      consumersSampled: 200,
      soldUnits: 10,
      unitsSampled: 0,
      photoCount: 1,
      activationType: "Event Activation",
    }).map((k) => k.label);
    expect(labels).toEqual(["Engagements", "Sold", "Photos"]);
  });

  it("dry demo: conversion vs people engaged, labelled", () => {
    expect(
      clientRecapKpis({
        engagements: 30,
        consumersSampled: 0,
        soldUnits: 6,
        unitsSampled: 0,
        photoCount: 5,
        activationType: "Torch THC-Retail Sampling",
        isDryDemo: true,
        peopleEngaged: 30,
      }),
    ).toEqual([
      { label: "Dry demo · people engaged", value: "30" },
      { label: "Sold", value: "6" },
      { label: "Conv · vs. people engaged (dry demo)", value: "20%" },
      { label: "Photos", value: "5" },
    ]);
  });

  it("dry demo with no people engaged or sampled shows no conv", () => {
    const labels = clientRecapKpis({
      engagements: 0,
      consumersSampled: 0,
      soldUnits: 17,
      unitsSampled: 0,
      photoCount: 2,
      activationType: "Torch THC-Retail Sampling",
      isDryDemo: true,
      peopleEngaged: null,
    }).map((k) => k.label);
    expect(labels).toEqual(["Dry demo", "Sold", "Photos"]);
  });
});
