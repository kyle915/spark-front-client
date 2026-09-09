import { describe, expect, it } from "vitest";
import {
  buildProgramPulseCopy,
  buildProgramPulseOneLiner,
} from "@/components/insights/ExecutiveInsightsStrip";

describe("Program pulse copy helpers", () => {
  const mix = [
    { key: "retail", label: "Retail demos", count: 12 },
    { key: "onprem", label: "On-prem samplings", count: 3 },
    { key: "event", label: "Events", count: 5 },
  ];
  const topSkus = [
    { product: "5MG — Berry Blast", samples: 60 },
    { product: "5MG — Lemon Lime", samples: 10 },
  ];

  it("builds a one-liner from real aggregates only", () => {
    const line = buildProgramPulseOneLiner({
      rangeLabel: "30d",
      convPct: 52.9,
      sold: 46,
      sampled: 87,
      mix,
      topSkus,
      totalSamples: 70,
    });
    expect(line).toContain("53% conversion");
    expect(line).toContain("46 sold ÷ 87 sampled");
    expect(line).toContain("12 Retail demos");
    expect(line).toContain("5MG — Berry Blast");
    expect(line).not.toMatch(/%\s*ROI|invented/i);
  });

  it("does not invent a conversion rate when sides are missing", () => {
    const line = buildProgramPulseOneLiner({
      rangeLabel: "7d",
      convPct: null,
      sold: 0,
      sampled: 0,
      mix: [
        { key: "retail", label: "Retail demos", count: 2 },
        { key: "onprem", label: "On-prem samplings", count: 0 },
        { key: "event", label: "Events", count: 0 },
      ],
      topSkus: [],
      totalSamples: 0,
    });
    expect(line).toContain("2 Retail demos");
    expect(line).not.toMatch(/\d+%\s+conversion/);
  });

  it("Slack copy separates aggregate purchased from per-SKU samples", () => {
    const text = buildProgramPulseCopy({
      rangeLabel: "30d",
      startDate: "2026-08-10",
      endDate: "2026-09-09",
      convPct: 52.9,
      sold: 46,
      sampled: 87,
      mix,
      topSkus,
      totalSamples: 70,
      oneLiner: "In 30d: test.",
    });
    expect(text).toContain("Products purchased (Retail + On-Prem aggregate, not per SKU): 46");
    expect(text).toContain("5MG — Berry Blast 60");
  });
});
