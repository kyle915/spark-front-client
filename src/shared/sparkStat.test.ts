import { describe, expect, it } from "vitest";
import {
  aggregateRows,
  conversionBase,
  conversionSplitNote,
  padIndex,
  recapConversion,
  recapConversionChip,
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
    ).toEqual({ engagements: 150, sold: 30, dryDemos: 0 });
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
    ).toEqual({ engagements: 130, sold: 25, dryDemos: 0 });
  });

  it("uses consumers sampled for dry demos, same as product retail", () => {
    const product = {
      requestType: "Torch THC-Retail Sampling",
      engagements: 40,
      consumersSampled: 18,
      productsSold: 4,
      isDryDemo: false,
      peopleEngaged: null,
    };
    const dry = {
      ...product,
      isDryDemo: true,
      peopleEngaged: 22,
    };
    expect(conversionBase(product)).toBe(18);
    expect(conversionBase(dry)).toBe(18);
    expect(sumConversionBases([product, dry])).toEqual({
      engagements: 36,
      sold: 8,
      dryDemos: 1,
    });
  });

  it("does not invent a dry rate from people engaged when sampled is 0", () => {
    expect(
      sumConversionBases([
        {
          requestType: "Torch THC-Retail Sampling",
          engagements: 30,
          consumersSampled: 0,
          productsSold: 6,
          isDryDemo: true,
          peopleEngaged: 30,
        },
        {
          requestType: "Torch THC-Retail Sampling",
          engagements: 25,
          consumersSampled: 25,
          productsSold: 5,
          isDryDemo: true,
          peopleEngaged: null,
        },
        {
          requestType: "Event Activation",
          engagements: 0,
          productsSold: 9,
          isDryDemo: true,
          peopleEngaged: 40,
        },
      ]),
    ).toEqual({ engagements: 25, sold: 5, dryDemos: 1 });
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
    ).toEqual({ engagements: 0, sold: 0, dryDemos: 0 });
  });
});

describe("recapListKpis", () => {
  it("notes dry demos inside CONV", () => {
    expect(
      recapListKpis({
        filteredTotal: 3,
        loaded: 3,
        total: 3,
        engagements: 80,
        sold: 16,
        conversionEngagements: 80,
        conversionSold: 16,
        conversionDryDemos: 1,
      }).find((k) => k.label === "Conv")?.hint,
    ).toBe("Retail + on-prem · incl. 1 dry demo");
  });

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

describe("recap type on the list strip", () => {
  const base = {
    filteredTotal: 4,
    loaded: 4,
    total: 4,
    engagements: 400,
    sold: 30,
    conversionEngagements: 0,
    conversionSold: 0,
  };

  it("server recap type decides CONV, not the template name", () => {
    expect(
      sumConversionBases([
        {
          requestType: "Feel Free · Sampling Recap",
          recapType: "retail",
          engagements: 100,
          productsSold: 10,
        },
        {
          requestType: "Torch THC-Retail Sampling",
          recapType: "guerilla",
          engagements: 300,
          productsSold: 20,
        },
      ]),
    ).toEqual({ engagements: 100, sold: 10, dryDemos: 0 });
  });

  it.each(["event", "guerilla"] as const)(
    "%s shows Conv as n/a, keeps Eng / Sold",
    (recapType) => {
      const kpis = recapListKpis({ ...base, recapType });
      expect(kpis.find((k) => k.label === "Conv")).toEqual({
        label: "Conv",
        value: "—",
        hint: "n/a · Retail + on-prem only",
        tone: "default",
      });
      expect(kpis.find((k) => k.label === "Eng")?.value).toBe("400");
      expect(kpis.find((k) => k.label === "Sold")?.value).toBe("30");
    },
  );

  it("seeding never reads dropped cases as sampled or sold", () => {
    const kpis = recapListKpis({
      ...base,
      engagements: 0,
      sold: 0,
      recapType: "seeding",
    });
    expect(kpis.find((k) => k.label === "Eng")).toMatchObject({
      value: "—",
      hint: "Drop-offs, not sampling",
    });
    expect(kpis.find((k) => k.label === "Sold")).toMatchObject({
      value: "—",
      hint: "Cases dropped aren't sales",
    });
    expect(kpis.find((k) => k.label === "Conv")?.value).toBe("—");
  });

  it("retail keeps the Retail + on-prem CONV", () => {
    const conv = recapListKpis({
      ...base,
      conversionEngagements: 200,
      conversionSold: 30,
      recapType: "retail",
    }).find((k) => k.label === "Conv");
    expect(conv).toMatchObject({ value: "15%", hint: "Retail + on-prem" });
  });
});

describe("3rd-party recaps stay out of totals", () => {
  const rows = [
    { requestType: "Retail Sampling", engagements: 100, consumersSampled: 100, productsSold: 20 },
    {
      requestType: "Retail Sampling",
      engagements: 50,
      consumersSampled: 50,
      productsSold: 25,
      excludeFromAggregates: true,
    },
  ];

  it("aggregateRows drops flagged rows", () => {
    expect(aggregateRows(rows)).toHaveLength(1);
  });

  it("sumConversionBases skips flagged rows on both sides", () => {
    expect(sumConversionBases(rows)).toEqual({ engagements: 100, sold: 20, dryDemos: 0 });
  });

  it("recapListKpis notes the 3rd-party rows left out", () => {
    const kpis = recapListKpis({
      filteredTotal: 2,
      loaded: 2,
      total: 2,
      engagements: 100,
      sold: 20,
      conversionEngagements: 100,
      conversionSold: 20,
      notInTotals: 1,
    });
    expect(kpis.find((k) => k.label === "Eng")?.hint).toBe("excl. 1 3rd-party");
    expect(kpis.find((k) => k.label === "Sold")?.hint).toBe("excl. 1 3rd-party");
    expect(kpis.find((k) => k.label === "Conv")?.hint).toBe("Retail + on-prem · excl. 1 3rd-party");
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

describe("conversionSplitNote", () => {
  it("is empty with no dry demos", () => {
    expect(conversionSplitNote({ sold: 10, engagements: 50 })).toBe("");
  });

  it("splits live sampled vs dry demos and flags unpaired", () => {
    expect(
      conversionSplitNote({
        sold: 16,
        engagements: 80,
        drySold: 6,
        dryEngagements: 30,
        dryRecaps: 1,
        unpairedDryRecaps: 2,
      }),
    ).toBe(
      " · live sampled 20% (10/50) · dry demos 20% (6/30) · 2 dry demos with no consumers sampled left out",
    );
  });
});

describe("recapConversion", () => {
  const retail = {
    requestType: null,
    recapType: "retail" as const,
    engagements: 40,
    productsSold: 4,
  };

  it("same sold and different sampled counts are the two list rates", () => {
    const product = recapConversion({ ...retail, consumersSampled: 18 });
    expect(product.applies && product.pct).toBe(22);
    const dry = recapConversion({
      ...retail,
      consumersSampled: 22,
      isDryDemo: true,
      peopleEngaged: 40,
    });
    expect(dry.applies && dry.pct).toBe(18);
    expect(dry.applies && dry.base).toBe(22);
  });

  it("ignores people engaged when a dry demo also has consumers sampled", () => {
    const conv = recapConversion({
      ...retail,
      consumersSampled: 18,
      isDryDemo: true,
      peopleEngaged: 22,
    });
    expect(conv).toMatchObject({
      applies: true,
      pct: 22,
      sold: 4,
      base: 18,
      baseNoun: "sampled",
      ok: true,
    });
  });

  it("classifies 20% as ok and below 20% as a warning", () => {
    expect(
      recapConversionChip({ ...retail, consumersSampled: 20 }).status,
    ).toBe("pass");
    expect(
      recapConversionChip({ ...retail, consumersSampled: 22 }).status,
    ).toBe("flag");
    expect(recapConversionChip({ ...retail, consumersSampled: 22 }).label).toBe(
      "Conv 18% · 4 sold / 22 sampled",
    );
  });

  it("does not give event types a retail conversion", () => {
    expect(
      recapConversion({
        ...retail,
        recapType: "event",
        consumersSampled: 18,
      }),
    ).toEqual({
      applies: false,
      reason: "Conversion does not apply · retail and on-premise only",
    });
    expect(
      recapConversionChip({
        ...retail,
        recapType: "event",
        consumersSampled: 18,
      }).status,
    ).toBe("na");
  });

  it("does not invent a percent when the denominator is missing", () => {
    expect(
      recapConversion({
        ...retail,
        consumersSampled: 0,
        isDryDemo: true,
        peopleEngaged: 22,
      }),
    ).toEqual({
      applies: false,
      reason: "No conversion — consumers sampled is missing",
    });
  });
});
