import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChartBlock from "@/components/charts/ChartBlock";
import {
  alignPriorWeeklyValues,
  buildProgramExecutiveBrief,
  buildProgramReportCsv,
  computePriorDateWindow,
  formatPercentDelta,
  formatPointDelta,
  metricAxisTitle,
  transformSplitRowsByMetric,
  transformWeeklyByMetric,
} from "./programReportHelpers";
import {
  buildCampaignFunnel,
  computeCampaignConversionPct,
} from "@/reports/campaignFunnel";

const here = dirname(fileURLToPath(import.meta.url));
const readRel = (rel: string) => readFileSync(join(here, rel), "utf8");

describe("Program Report, Charting, and Leave-Behind Upgrades", () => {
  it("computes equal-length prior date windows and delta badges accurately", () => {
    const prior = computePriorDateWindow("2026-11-01", "2026-11-30");
    expect(prior).toEqual({
      startDate: "2026-10-02",
      endDate: "2026-10-31",
      spanDays: 30,
      shortLabel: "prior 30d",
    });

    expect(formatPercentDelta(1200, 1000, "prior 30d")).toEqual({
      text: "+20% vs prior 30d",
      direction: "up",
    });
    expect(formatPercentDelta(900, 1000, "prior 30d")).toEqual({
      text: "-10% vs prior 30d",
      direction: "down",
    });
    expect(formatPercentDelta(500, 0, "prior 30d")).toBeNull();

    expect(formatPointDelta(34.2, 31.8, "prior 90d")).toEqual({
      text: "+2.4 pts vs prior 90d",
      direction: "up",
    });
  });

  it("switches weekly and split rows cleanly across Sampled, Avg / activation, and Activations", () => {
    const weeks = [
      { weekStart: "2026-11-02", consumers: 300, recaps: 3 },
      { weekStart: "2026-11-09", consumers: 450, recaps: 5 },
    ];
    const avgTrend = transformWeeklyByMetric(weeks, "avg", new Date("2026-11-27T12:00:00Z"));
    expect(avgTrend.values).toEqual([100, 90]);

    const actTrend = transformWeeklyByMetric(
      weeks,
      "activations",
      new Date("2026-11-27T12:00:00Z"),
    );
    expect(actTrend.values).toEqual([3, 5]);

    expect(
      alignPriorWeeklyValues(
        3,
        [
          { consumers: 200, recaps: 2 },
          { consumers: 250, recaps: 5 },
        ],
        "avg",
      ),
    ).toEqual([100, 50, null]);

    const stores = transformSplitRowsByMetric(
      [
        { label: "H-E-B #12", kind: "named", consumers: 240, recaps: 3 },
        { label: "Other", kind: "other", consumers: 90, recaps: 4 },
      ],
      "avg",
    );
    expect(stores).toEqual([{ label: "H-E-B #12", kind: "named", consumers: 80 }]);
    expect(metricAxisTitle("store", "avg").title).toBe(
      "Avg sampled per activation by store",
    );
  });

  it("builds deterministic CSV and executive brief outputs for active report windows", () => {
    const payload = {
      brandName: "Feel Free",
      rangeLabel: "Last 90 days",
      startDate: "2026-08-29",
      endDate: "2026-11-27",
      consumersSampled: 4820,
      approvedRecaps: 44,
      unitsSold: 1410,
      conversionPct: 29.3,
      eventsRun: 46,
      samplesPerHour: 31.4,
      unitsPerHour: 9.2,
      byWeek: [{ weekStart: "2026-11-09", consumers: 620, recaps: 6 }],
      byStore: [{ label: "Sprouts Austin", kind: "named", consumers: 540, recaps: 4 }],
      byState: [{ label: "TX", kind: "named", consumers: 2900, recaps: 24 }],
      skus: [{ product: "Feel Free Classic", samples: 3100 }],
      topEfficiencyStores: [
        {
          label: "Sprouts Austin",
          recaps: 4,
          sold: 168,
          samplesPerHour: 33.8,
          unitsPerHour: 10.5,
        },
      ],
    };

    const csv = buildProgramReportCsv(payload);
    expect(csv).toContain("Program Performance Report,Feel Free");
    expect(csv).toContain("Units Sold (Retail & On-Premise),1410");
    expect(csv).toContain("Sprouts Austin,540,4,135");

    const brief = buildProgramExecutiveBrief(payload);
    expect(brief).toContain("Feel Free — Program Report");
    expect(brief).toContain("1,410 (29.3% conversion)");
    expect(brief).toContain("31.4 samples/hr · 9.2 units sold/hr");
  });

  it("renders Chart ⇄ Table toggle on ChartBlock when tableRows are supplied", () => {
    const html = renderToStaticMarkup(
      <ChartBlock
        title="Consumers sampled by store"
        height={200}
        tableRows={[
          { label: "H-E-B #12", value: 240 },
          { label: "Sprouts", value: 180 },
        ]}
      >
        <div>plot</div>
      </ChartBlock>,
    );
    expect(html).toContain("Chart");
    expect(html).toContain("Table");
  });

  it("computes Campaign Report conversion funnel and fixes /report/:token PDF button contrast", () => {
    const kpis = {
      events: 10,
      recaps: 10,
      consumersReached: 1500,
      samplesDistributed: 1200,
      productsSold: 360,
      cansSold: 240,
      packsSold: 120,
      totalEngagements: 1500,
      firstTimeConsumers: 840,
      brandAwareConsumers: 360,
      willingToPurchase: 960,
    };

    expect(computeCampaignConversionPct(kpis)).toBe("30.0%");
    const funnel = buildCampaignFunnel(kpis);
    expect(funnel.map((s) => s.key)).toEqual([
      "reached",
      "sampled",
      "first_time",
      "willing",
      "sold",
    ]);
    expect(funnel.find((s) => s.key === "sold")?.rateNote).toBe(
      "30.0% conversion",
    );

    const publicReportSrc = readRel(
      "../../../public/reports/PublicCampaignReport.tsx",
    );
    expect(publicReportSrc).toContain('background: "#14160f"');
    expect(publicReportSrc).toContain('color: "#f6f6f2"');

    const campaignViewSrc = readRel("../../../reports/CampaignReportView.tsx");
    expect(campaignViewSrc).not.toContain("<SparkMark");
    expect(campaignViewSrc).toContain("Shopper trial & conversion funnel");

    const publicProgramSrc = readRel("../../../public/program/PublicProgram.tsx");
    expect(publicProgramSrc).toContain("PhotoLightbox");
    expect(publicProgramSrc).toContain("RecapKpiStrip");
  });
});
