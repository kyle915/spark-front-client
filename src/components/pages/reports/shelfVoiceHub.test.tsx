import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateOsaByMarket,
  computePriceDrift,
  filterShelfPhotos,
  filterShelfStores,
  parseMsrpTarget,
  storeHasShelfAttention,
  trendBadgeMeta,
  type ShelfPhotoLike,
  type ShelfStoreLike,
} from "./shelfVoiceHelpers";
import { activeMobileDockKey } from "@/layout/mobileDockItems";
import { routeAskSparkPrompts } from "@/components/ai/routeAskSparkPrompts";

const SAMPLE_STORES: ShelfStoreLike[] = [
  {
    storeKey: "heb:725",
    storeName: "HEB #725",
    market: "Houston, TX",
    stateCode: "TX",
    visitCount: 3,
    latestDate: "2026-11-20",
    latestRecapUuid: "r-1",
    latestStatus: "on_shelf",
    onShelfVisits: 3,
    notFoundVisits: 0,
    osaRatePct: 100,
    missingTagVisits: 0,
    oosGapVisits: 0,
    latestFacings: 5,
    avgFacings: 4.5,
    latestPrice: "2.49",
    priceDriftPct: 0,
    stockoutSignal: "",
    competitorPromo: "",
    hasBeforeAfter: true,
  },
  {
    storeKey: "kroger:11",
    storeName: "Kroger #11",
    market: "Dallas, TX",
    stateCode: "TX",
    visitCount: 2,
    latestDate: "2026-11-18",
    latestRecapUuid: "r-2",
    latestStatus: "not_found",
    onShelfVisits: 1,
    notFoundVisits: 1,
    osaRatePct: 50,
    missingTagVisits: 1,
    oosGapVisits: 1,
    latestFacings: 1,
    avgFacings: 1.5,
    latestPrice: "2.99",
    priceDriftPct: 20.1,
    stockoutSignal: "Empty beverage endcap",
    competitorPromo: "Poppi BOGO display",
    hasBeforeAfter: false,
  },
];

const SAMPLE_PHOTOS: ShelfPhotoLike[] = [
  {
    fileId: "1",
    photoUrl: "https://example.com/1.jpg",
    bucketName: "Shelf",
    storeKey: "heb:725",
    storeName: "HEB #725",
    market: "Houston, TX",
    stateCode: "TX",
    eventDate: "2026-11-20",
    recapUuid: "r-1",
    productOnShelf: "yes",
    facings: 5,
    priceTagVisible: "yes",
    price: "2.49",
    outOfStockGap: "no",
  },
  {
    fileId: "2",
    photoUrl: "https://example.com/2.jpg",
    bucketName: "Shelf",
    storeKey: "kroger:11",
    storeName: "Kroger #11",
    market: "Dallas, TX",
    stateCode: "TX",
    eventDate: "2026-11-18",
    recapUuid: "r-2",
    productOnShelf: "no",
    facings: 0,
    priceTagVisible: "no",
    price: null,
    outOfStockGap: "yes",
  },
];

describe("Shelf Compliance, Pricing & Competitor Voice Hub", () => {
  it("computes MSRP price drift against custom target or median baseline", () => {
    expect(parseMsrpTarget("$2.49", "2.79")).toBe(2.49);
    expect(parseMsrpTarget("", "2.49")).toBe(2.49);
    expect(parseMsrpTarget("", null)).toBeNull();

    const drift = computePriceDrift("2.99", 2.49);
    expect(drift).toEqual({ deltaDollars: 0.5, deltaPct: 20.1, isDrift: true });
    expect(computePriceDrift("2.52", 2.49)?.isDrift).toBe(false);
  });

  it("filters stores by OOS, missing tags, MSRP drift, low facings, and search", () => {
    expect(storeHasShelfAttention(SAMPLE_STORES[0], 2.49)).toBe(false);
    expect(storeHasShelfAttention(SAMPLE_STORES[1], 2.49)).toBe(true);

    expect(filterShelfStores(SAMPLE_STORES, "attention", "", 2.49)).toHaveLength(1);
    expect(filterShelfStores(SAMPLE_STORES, "oos", "", 2.49)[0].storeName).toBe("Kroger #11");
    expect(filterShelfStores(SAMPLE_STORES, "missing_tag", "", 2.49)).toHaveLength(1);
    expect(filterShelfStores(SAMPLE_STORES, "price_drift", "", 2.49)).toHaveLength(1);
    expect(filterShelfStores(SAMPLE_STORES, "low_facings", "", 2.49)).toHaveLength(1);
    expect(filterShelfStores(SAMPLE_STORES, "all", "houston", 2.49)).toHaveLength(1);
  });

  it("filters audited shelf photos and aggregates OSA by market lowest-first", () => {
    expect(filterShelfPhotos(SAMPLE_PHOTOS, "oos")).toHaveLength(1);
    expect(filterShelfPhotos(SAMPLE_PHOTOS, "missing_tag")).toHaveLength(1);
    expect(filterShelfPhotos(SAMPLE_PHOTOS, "on_shelf")).toHaveLength(1);

    const markets = aggregateOsaByMarket(SAMPLE_STORES);
    expect(markets[0].market).toBe("Dallas, TX");
    expect(markets[0].osaRatePct).toBe(50);
    expect(markets[1].market).toBe("Houston, TX");
    expect(markets[1].osaRatePct).toBe(100);
    expect(trendBadgeMeta("rising").label).toContain("Rising");
  });

  it("wires /shelf-voice into hub nav, mobile dock, Ask Spark prompts, routes, and Layout ErrorBoundary", () => {
    expect(activeMobileDockKey("/shelf-voice")).toBe("reports");
    const prompts = routeAskSparkPrompts("/shelf-voice", true);
    expect(prompts.some((p) => p.toLowerCase().includes("msrp"))).toBe(true);

    const hubNav = readFileSync(resolve(__dirname, "../../../shared/sparkHubNav.ts"), "utf8");
    expect(hubNav).toContain('label: "Shelf & Voice"');
    expect(hubNav).toContain('to: "/shelf-voice"');

    const routes = readFileSync(resolve(__dirname, "../../../routes/AppRoutes.tsx"), "utf8");
    expect(routes).toContain('path: "/shelf-voice"');
    expect(routes).toContain("ShelfVoicePage");

    const layout = readFileSync(resolve(__dirname, "../../../layout/Layout.tsx"), "utf8");
    expect(layout).toContain("location.pathname}:${tenantId");
  });
});
