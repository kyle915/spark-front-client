import { describe, expect, it } from "vitest";
import {
  padIndex,
  recapListKpis,
  sumConversionBases,
  todayGroundKpis,
} from "./sparkStat";

describe("sumConversionBases", () => {
  it("excludes Event activations from both sides of CONV", () => {
    expect(
      sumConversionBases([
        {
          requestType: "Retail Sampling",
          engagements: 100,
          productsSold: 20,
        },
        {
          requestType: "On-Premise Sampling",
          engagements: 50,
          productsSold: 10,
        },
        {
          requestType: "Event Activation",
          engagements: 10_000,
          productsSold: 5,
        },
      ]),
    ).toEqual({ engagements: 150, sold: 30 });
  });

  it("uses consumers sampled as the base when a row has one", () => {
    expect(
      sumConversionBases([
        {
          requestType: "Torch THC-Retail Sampling",
          engagements: 300,
          consumersSampled: 80,
          productsSold: 20,
        },
        { requestType: "Retail Sampling", engagements: 50, productsSold: 5 },
      ]),
    ).toEqual({ engagements: 130, sold: 25 });
  });

  it("ignores unclassified / null request types", () => {
    expect(
      sumConversionBases([
        { requestType: null, engagements: 80, productsSold: 8 },
        {
          requestType: "Demo Table",
          engagements: 40,
          productsSold: 4,
        },
      ]),
    ).toEqual({ engagements: 0, sold: 0 });
  });
});

describe("recapListKpis", () => {
  it("builds in-view / eng / sold / conv from loaded numbers", () => {
    expect(
      recapListKpis({
        filteredTotal: 12,
        loaded: 50,
        total: 80,
        engagements: 200,
        sold: 40,
        conversionEngagements: 200,
        conversionSold: 40,
      }),
    ).toEqual([
      { label: "In view", value: "12", hint: "50 loaded" },
      { label: "Eng", value: "200", tone: "lime" },
      { label: "Sold", value: "40" },
      {
        label: "Conv",
        value: "20%",
        hint: "Retail + on-prem",
        tone: "lime",
      },
    ]);
  });

  it("computes CONV from retail/on-prem only while ENG/SOLD stay all-program", () => {
    const kpis = recapListKpis({
      filteredTotal: 43,
      loaded: 43,
      total: 43,
      // All programs (events inflate eng)
      engagements: 31_485,
      sold: 224,
      // Retail + on-prem only
      conversionEngagements: 1_000,
      conversionSold: 200,
    });
    expect(kpis.find((k) => k.label === "Eng")?.value).toBe("31,485");
    expect(kpis.find((k) => k.label === "Sold")?.value).toBe("224");
    expect(kpis.find((k) => k.label === "Conv")).toEqual({
      label: "Conv",
      value: "20%",
      hint: "Retail + on-prem",
      tone: "lime",
    });
  });

  it("never invents conv when retail/on-prem engagements are zero", () => {
    const conv = recapListKpis({
      filteredTotal: 3,
      loaded: 3,
      total: 3,
      engagements: 500,
      sold: 8,
      conversionEngagements: 0,
      conversionSold: 8,
    }).find((k) => k.label === "Conv");
    expect(conv).toEqual({
      label: "Conv",
      value: "—",
      hint: "Retail + on-prem",
      tone: "default",
    });
  });
});

describe("todayGroundKpis", () => {
  it("oranges live BAs and limes mapped", () => {
    expect(todayGroundKpis({ events: 4, liveBas: 2, mapped: 3 })).toEqual([
      { label: "Events", value: "4", count: 4 },
      { label: "Live BAs", value: "2", count: 2, tone: "orange" },
      { label: "Mapped", value: "3", count: 3, tone: "lime" },
    ]);
  });
});

describe("padIndex", () => {
  it("zero-pads Jump row numbers", () => {
    expect(padIndex(1)).toBe("01");
    expect(padIndex(12)).toBe("12");
  });
});
