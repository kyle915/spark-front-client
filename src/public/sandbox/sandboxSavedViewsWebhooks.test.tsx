import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  answerSandboxQuestion,
  buildSandboxPitchPayload,
  computeSandboxMsrpDrift,
  filterSandboxStores,
  type SandboxPayload,
} from "./sandboxHelpers";
import { buildBuyerDeckPptxZip } from "@/public/pitch/buyerDeckPptx";

const SAMPLE_PAYLOAD: SandboxPayload = {
  brand: {
    name: "Meadowlark Botanicals",
    tagline: "Botanical Sparkling Tonic · Zero Stevia",
    category: "Better-for-You Beverage",
    targetMsrp: "2.49",
    skus: ["Yuzu Ginger 12oz", "Blood Orange Hibiscus 12oz"],
    periodStart: "2026-08-30",
    periodEnd: "2026-11-27",
  },
  kpis: {
    activations: 42,
    activeDoors: 2,
    markets: 2,
    consumersSampled: 1002,
    unitsSold: 342,
    conversionPct: 34.1,
    avgCostPerSample: 2.25,
    totalDemoSpend: 2250,
    posLiftPct: 28.4,
    osaRatePct: 87.5,
    priceTagRatePct: 80,
    avgFacings: 3.5,
    medianPrice: "2.49",
    oosGapsCount: 2,
    missingTagCount: 2,
  },
  stores: [
    {
      storeKey: "sandbox:greenway-austin-barton",
      storeName: "Greenway Market — Barton Creek #104",
      retailerBanner: "Greenway Market",
      market: "Austin, TX",
      stateCode: "TX",
      address: "410 Meadowbrook Pkwy, Austin, TX 78704",
      visits: 6,
      consumersSampled: 612,
      unitsSold: 224,
      conversionPct: 36.6,
      osaRatePct: 100,
      latestStatus: "on_shelf",
      latestFacings: 6,
      avgFacings: 5.5,
      latestPrice: "2.49",
      missingTagVisits: 0,
      oosGapVisits: 0,
      posLiftPct: 38.4,
      demoCost: 1350,
      costPerSample: 2.21,
      stockoutSignal: "",
      competitorPromo: "",
      latestDate: "2026-11-24",
      topSku: "Yuzu Ginger 12oz",
      quotes: ["Crisp citrus finish!"],
    },
    {
      storeKey: "sandbox:greenway-dallas-northgate",
      storeName: "Greenway Market — Northgate #119",
      retailerBanner: "Greenway Market",
      market: "Dallas, TX",
      stateCode: "TX",
      address: "7220 Briarwood Ln, Dallas, TX 75214",
      visits: 4,
      consumersSampled: 390,
      unitsSold: 118,
      conversionPct: 30.3,
      osaRatePct: 75,
      latestStatus: "not_found",
      latestFacings: 0,
      avgFacings: 2,
      latestPrice: "2.89",
      missingTagVisits: 2,
      oosGapVisits: 2,
      posLiftPct: 19.5,
      demoCost: 900,
      costPerSample: 2.31,
      stockoutSignal: "Missing from cold box",
      competitorPromo: "Zestify Soda 2/$4",
      latestDate: "2026-11-21",
      topSku: "Blood Orange Hibiscus 12oz",
      quotes: ["Cooler was empty."],
    },
  ],
  shelfPhotos: [
    {
      fileId: "p1",
      storeKey: "sandbox:greenway-austin-barton",
      storeName: "Greenway Market — Barton Creek #104",
      market: "Austin, TX",
      stateCode: "TX",
      eventDate: "2026-11-24",
      bucketName: "Shelf",
      productOnShelf: "yes",
      facings: 6,
      priceTagVisible: "yes",
      price: "2.49",
      outOfStockGap: "no",
      photoUrl: "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E",
    },
  ],
  beforeAfterPairs: [],
  competitorMarkets: [
    {
      market: "Houston, TX",
      stateCode: "TX",
      competitorBrand: "Zestify Soda",
      mentionCount: 9,
      priorMentionCount: 4,
      delta: 5,
      trend: "rising",
      sampleQuote: "Zestify Soda 2/$4 nearby.",
      sampleStoreKey: "sandbox:greenway-dallas-northgate",
      sampleStoreName: "Greenway Market — Northgate #119",
    },
  ],
  competitorSummary: [
    { brand: "Zestify Soda", prefersOurs: 7, onlyMentioned: 5, prefersTheirs: 2 },
  ],
  footprint: [
    { stateCode: "TX", activations: 10, consumers: 1002, unitsSold: 342, stores: 2 },
  ],
  savedViews: [],
  shopperThemes: [
    {
      theme: "Crisp citrus without stevia",
      mentions: 64,
      quote: "Not cloyingly sweet.",
    },
  ],
};

describe("Interactive Sample Brand Sandbox, Saved Views & Webhooks", () => {
  it("computes MSRP drift, filters stores, and answers grounded Ask Spark questions", () => {
    const drift = computeSandboxMsrpDrift("2.89", 2.49);
    expect(drift?.isDrift).toBe(true);
    expect(drift?.deltaPct).toBe(16.1);

    const flagged = filterSandboxStores(SAMPLE_PAYLOAD.stores, {
      shelfFilter: "price_drift",
      targetMsrp: 2.49,
    });
    expect(flagged.map((s) => s.storeKey)).toEqual([
      "sandbox:greenway-dallas-northgate",
    ]);

    const msrpAns = answerSandboxQuestion(
      SAMPLE_PAYLOAD,
      "Which stores have MSRP drift or missing tags?",
    );
    expect(msrpAns.headline).toContain("1 of 2 doors");
    expect(msrpAns.recommendedStoreKeys).toContain(
      "sandbox:greenway-dallas-northgate",
    );

    const compAns = answerSandboxQuestion(
      SAMPLE_PAYLOAD,
      "Which competitors are rising?",
    );
    expect(compAns.bullets[0]).toContain("Zestify Soda");

    const qbrAns = answerSandboxQuestion(
      SAMPLE_PAYLOAD,
      "Summarize our QBR story for a Greenway Market buyer meeting.",
    );
    expect(qbrAns.bullets[0]).toContain("Greenway Market");
  });

  it("adapts Sandbox payload to a valid native Buyer QBR PowerPoint (.pptx)", async () => {
    const pitch = buildSandboxPitchPayload(SAMPLE_PAYLOAD);
    const { zip, slideCount } = await buildBuyerDeckPptxZip(pitch, {
      fetchPhotos: false,
    });
    expect(slideCount).toBeGreaterThanOrEqual(5);
    expect(zip.file("ppt/presentation.xml")).not.toBeNull();
    expect(zip.file("ppt/slides/slide1.xml")).not.toBeNull();
  });

  it("locks /sandbox to AdminOnly (non-public), removes public CTAs, and keeps SavedViews/Webhooks wired", () => {
    const routes = readFileSync(resolve(__dirname, "../../routes/AppRoutes.tsx"), "utf8");
    expect(routes).toMatch(
      /path:\s*"\/sandbox",\s*component:\s*\(\s*<AdminOnly>\s*<SandboxBrandPage \/>\s*<\/AdminOnly>\s*\),\s*isPublic:\s*false/,
    );

    const login = readFileSync(resolve(__dirname, "../../auth/Login.tsx"), "utf8");
    expect(login).not.toContain('to="/sandbox"');

    const onboarding = readFileSync(
      resolve(__dirname, "../../pilot/SelfServeOnboardingPage.tsx"),
      "utf8",
    );
    expect(onboarding).not.toContain('to="/sandbox"');

    const buyerReport = readFileSync(
      resolve(__dirname, "../../pilot/BuyerReportPage.tsx"),
      "utf8",
    );
    expect(buyerReport).toContain("SavedViewsDigestBar");

    const shelfVoice = readFileSync(
      resolve(__dirname, "../../components/pages/reports/ShelfVoicePage.tsx"),
      "utf8",
    );
    expect(shelfVoice).toContain("SavedViewsDigestBar");

    const aiConnector = readFileSync(
      resolve(__dirname, "../../components/pages/ai-connector/SparkAiConnector.tsx"),
      "utf8",
    );
    expect(aiConnector).toContain("WebhooksPanel");

    const settings = readFileSync(
      resolve(__dirname, "../../components/pages/settings/SparkSettings.tsx"),
      "utf8",
    );
    expect(settings).toContain('to="/ai-connector"');
    expect(settings).toContain("isAdmin ?");
    expect(settings).toContain('to="/sandbox"');

    // Verify all 7 pilot pages key their Relay body by tenantId for clean workspace switching
    for (const rel of [
      "../../pilot/BuyerReportPage.tsx",
      "../../pilot/RetailerPosPage.tsx",
      "../../pilot/RoiPacingPage.tsx",
      "../../pilot/DemoCostsPage.tsx",
      "../../pilot/BrandWorkspacePage.tsx",
      "../../pilot/ProviderImportsPage.tsx",
      "../../pilot/FinanceQueuePage.tsx",
    ]) {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      expect(src, `${rel} should key body by tenantId`).toContain(
        'key={tenantId ?? "none"}',
      );
      expect(src, `${rel} should scope fetchKey by tenantId`).toContain(
        '`${tenantId ?? "none"}:${fetchKey}`',
      );
    }
  });
});
