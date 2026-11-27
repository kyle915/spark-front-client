/**
 * Pure data types, API loader, filtering, MSRP drift, Buyer Deck `.pptx`
 * adapter, and grounded Ask Spark Q&A engine for the Interactive Self-Serve
 * Sandbox ("Explore Sample Brand" at `/sandbox`).
 */

import {
  pitchApiOrigin,
  type PitchPayload,
} from "@/public/pitch/pitchDeckTypes";

export interface SandboxStore {
  storeKey: string;
  storeName: string;
  retailerBanner: string;
  market: string;
  stateCode: string;
  address: string;
  visits: number;
  consumersSampled: number;
  unitsSold: number;
  conversionPct: number;
  osaRatePct: number;
  latestStatus: "on_shelf" | "not_found" | "unclear";
  latestFacings: number;
  avgFacings: number;
  latestPrice: string;
  missingTagVisits: number;
  oosGapVisits: number;
  posLiftPct: number;
  demoCost: number;
  costPerSample: number;
  stockoutSignal: string;
  competitorPromo: string;
  latestDate: string;
  topSku: string;
  quotes: string[];
}

export interface SandboxPhoto {
  fileId: string;
  storeKey: string;
  storeName: string;
  market: string;
  stateCode: string;
  eventDate: string;
  bucketName: string;
  productOnShelf: string;
  facings: number | null;
  priceTagVisible: string;
  price: string | null;
  outOfStockGap: string;
  photoUrl: string;
}

export interface SandboxBeforeAfterPair {
  storeKey: string;
  storeName: string;
  market: string;
  stateCode: string;
  photoCount: number;
  beforePhoto: SandboxPhoto;
  afterPhoto: SandboxPhoto;
}

export interface SandboxCompetitorMarket {
  market: string;
  stateCode: string;
  competitorBrand: string;
  mentionCount: number;
  priorMentionCount: number;
  delta: number;
  trend: "rising" | "new" | "steady" | "cooling";
  sampleQuote: string;
  sampleStoreKey: string;
  sampleStoreName: string;
}

export interface SandboxSavedView {
  id: string;
  name: string;
  retailerFilter: string;
  marketFilter: string;
  storeFilter?: string;
  schedule: string;
}

export interface SandboxPayload {
  brand: {
    name: string;
    tagline: string;
    category: string;
    targetMsrp: string;
    skus: string[];
    periodStart: string;
    periodEnd: string;
  };
  kpis: {
    activations: number;
    activeDoors: number;
    markets: number;
    consumersSampled: number;
    unitsSold: number;
    conversionPct: number;
    avgCostPerSample: number;
    totalDemoSpend: number;
    posLiftPct: number;
    osaRatePct: number;
    priceTagRatePct: number;
    avgFacings: number;
    medianPrice: string;
    oosGapsCount: number;
    missingTagCount: number;
  };
  stores: SandboxStore[];
  shelfPhotos: SandboxPhoto[];
  beforeAfterPairs: SandboxBeforeAfterPair[];
  competitorMarkets: SandboxCompetitorMarket[];
  competitorSummary: Array<{
    brand: string;
    prefersOurs: number;
    onlyMentioned: number;
    prefersTheirs: number;
  }>;
  footprint: Array<{
    stateCode: string;
    activations: number;
    consumers: number;
    unitsSold: number;
    stores: number;
  }>;
  savedViews: SandboxSavedView[];
  shopperThemes: Array<{
    theme: string;
    mentions: number;
    quote: string;
  }>;
}

export interface SandboxAskAnswer {
  headline: string;
  bullets: string[];
  recommendedStoreKeys: string[];
}

export const SANDBOX_SUGGESTED_QUESTIONS = [
  "Which stores have MSRP price drift, missing tags, or OOS gaps?",
  "What are our top-performing doors by conversion and POS lift?",
  "Which competitors are rising by market right now?",
  "Summarize our QBR story for a Whole Foods buyer meeting.",
] as const;

export function computeSandboxMsrpDrift(
  observedPriceStr: string | null | undefined,
  targetMsrp: number | null,
): { deltaPct: number; deltaDollars: number; isDrift: boolean } | null {
  if (!observedPriceStr || targetMsrp == null || targetMsrp <= 0) return null;
  const obs = Number.parseFloat(observedPriceStr);
  if (!Number.isFinite(obs)) return null;
  const deltaDollars = Math.round((obs - targetMsrp) * 100) / 100;
  const deltaPct = Math.round(((obs - targetMsrp) / targetMsrp) * 1000) / 10;
  return { deltaDollars, deltaPct, isDrift: Math.abs(deltaPct) >= 5 };
}

export function storeNeedsSandboxAttention(
  store: SandboxStore,
  targetMsrp: number | null,
): boolean {
  if (
    store.latestStatus === "not_found" ||
    store.oosGapVisits > 0 ||
    store.missingTagVisits > 0 ||
    Boolean(store.stockoutSignal)
  ) {
    return true;
  }
  const drift = computeSandboxMsrpDrift(store.latestPrice, targetMsrp);
  if (drift?.isDrift) return true;
  return store.latestFacings <= 2;
}

export function filterSandboxStores(
  stores: readonly SandboxStore[],
  opts: {
    retailerFilter?: string;
    marketFilter?: string;
    shelfFilter?: "all" | "attention" | "oos" | "missing_tag" | "price_drift";
    targetMsrp?: number | null;
    query?: string;
  },
): SandboxStore[] {
  const ret = (opts.retailerFilter || "").trim().toLowerCase();
  const mkt = (opts.marketFilter || "").trim().toLowerCase();
  const q = (opts.query || "").trim().toLowerCase();
  const sf = opts.shelfFilter || "all";
  const msrp = opts.targetMsrp ?? null;

  return stores.filter((s) => {
    if (ret && !s.retailerBanner.toLowerCase().includes(ret)) return false;
    if (
      mkt &&
      !`${s.market} ${s.stateCode}`.toLowerCase().includes(mkt)
    ) {
      return false;
    }
    if (
      q &&
      !`${s.storeName} ${s.retailerBanner} ${s.market} ${s.topSku} ${s.stockoutSignal} ${s.competitorPromo}`
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    if (sf === "attention") return storeNeedsSandboxAttention(s, msrp);
    if (sf === "oos") {
      return (
        s.latestStatus === "not_found" ||
        s.oosGapVisits > 0 ||
        Boolean(s.stockoutSignal)
      );
    }
    if (sf === "missing_tag") return s.missingTagVisits > 0;
    if (sf === "price_drift") {
      return Boolean(computeSandboxMsrpDrift(s.latestPrice, msrp)?.isDrift);
    }
    return true;
  });
}

export function answerSandboxQuestion(
  payload: SandboxPayload,
  question: string,
): SandboxAskAnswer {
  const q = question.trim().toLowerCase();
  const target = Number.parseFloat(payload.brand.targetMsrp) || 2.49;

  if (
    q.includes("msrp") ||
    q.includes("price") ||
    q.includes("tag") ||
    q.includes("oos") ||
    q.includes("stock") ||
    q.includes("shelf")
  ) {
    const flagged = payload.stores.filter((s) =>
      storeNeedsSandboxAttention(s, target),
    );
    const oosStores = payload.stores.filter(
      (s) => s.latestStatus === "not_found" || s.oosGapVisits > 0,
    );
    const missingTags = payload.stores.filter((s) => s.missingTagVisits > 0);
    const driftStores = payload.stores
      .map((s) => ({
        s,
        d: computeSandboxMsrpDrift(s.latestPrice, target),
      }))
      .filter((x) => x.d?.isDrift);
    return {
      headline: `${flagged.length} of ${payload.stores.length} doors need shelf or pricing follow-up (${payload.kpis.osaRatePct}% OSA across window).`,
      bullets: [
        `OOS / Not found (${oosStores.length} doors): ${oosStores
          .slice(0, 3)
          .map((s) => `${s.storeName} (${s.market})`)
          .join(", ")}.`,
        `Missing shelf price tags (${missingTags.length} doors): ${missingTags
          .map((s) => `${s.storeName} (${s.missingTagVisits} visits)`)
          .join(", ")}.`,
        `MSRP drift vs $${target.toFixed(2)} (${driftStores.length} doors): ${driftStores
          .map(
            (x) =>
              `${x.s.storeName} at $${x.s.latestPrice} (${(x.d?.deltaPct ?? 0) > 0 ? "+" : ""}${x.d?.deltaPct}%)`,
          )
          .join(", ")}.`,
      ],
      recommendedStoreKeys: flagged.slice(0, 3).map((s) => s.storeKey),
    };
  }

  if (
    q.includes("competitor") ||
    q.includes("poppi") ||
    q.includes("olipop") ||
    q.includes("spindrift") ||
    q.includes("promo") ||
    q.includes("rising")
  ) {
    const rising = payload.competitorMarkets.filter(
      (c) => c.trend === "rising" || c.trend === "new",
    );
    return {
      headline: `${rising.length} rising or newly appearing competitor signals detected across Texas markets.`,
      bullets: rising.map(
        (c) =>
          `${c.competitorBrand} in ${c.market}: ${c.mentionCount} mentions (${c.trend === "new" ? "New" : `+${c.delta} vs prior window`}) — "${c.sampleQuote}"`,
      ),
      recommendedStoreKeys: rising
        .map((c) => c.sampleStoreKey)
        .filter(Boolean)
        .slice(0, 3),
    };
  }

  if (
    q.includes("top") ||
    q.includes("best") ||
    q.includes("lift") ||
    q.includes("pos") ||
    q.includes("conversion") ||
    q.includes("roi")
  ) {
    const top = [...payload.stores]
      .sort((a, b) => b.posLiftPct - a.posLiftPct)
      .slice(0, 3);
    return {
      headline: `Program-wide conversion is ${payload.kpis.conversionPct}% with +${payload.kpis.posLiftPct}% adjusted POS velocity lift at $${payload.kpis.avgCostPerSample.toFixed(2)}/sample.`,
      bullets: top.map(
        (s) =>
          `${s.storeName} (${s.market}): ${s.conversionPct}% conversion (${s.unitsSold} units from ${s.consumersSampled} sampled), +${s.posLiftPct}% POS lift, $${s.costPerSample.toFixed(2)}/sample.`,
      ),
      recommendedStoreKeys: top.map((s) => s.storeKey),
    };
  }

  // Executive QBR / Whole Foods summary default
  const wfm = payload.stores.filter((s) =>
    s.retailerBanner.toLowerCase().includes("whole foods"),
  );
  const wfmConsumers = wfm.reduce((a, s) => a + s.consumersSampled, 0);
  const wfmUnits = wfm.reduce((a, s) => a + s.unitsSold, 0);
  const wfmConv = wfmConsumers
    ? Math.round((wfmUnits / wfmConsumers) * 1000) / 10
    : payload.kpis.conversionPct;
  return {
    headline: `${payload.brand.name} drove ${payload.kpis.unitsSold.toLocaleString()} units sold across ${payload.kpis.activations} activations (+${payload.kpis.posLiftPct}% POS lift).`,
    bullets: [
      `Whole Foods Market (${wfm.length} doors): ${wfmConsumers.toLocaleString()} consumers sampled, ${wfmUnits.toLocaleString()} units sold (${wfmConv}% conversion), led by Lamar Flagship at 36.6% conversion.`,
      `Shelf health: ${payload.kpis.osaRatePct}% on-shelf availability, ${payload.kpis.avgFacings} avg front facings, and $${payload.kpis.medianPrice} median retail price.`,
      `Top shopper theme: "${payload.shopperThemes[0]?.theme}" (${payload.shopperThemes[0]?.mentions} mentions) — ready to export as a 16:9 Buyer QBR PowerPoint deck.`,
    ],
    recommendedStoreKeys: wfm.slice(0, 3).map((s) => s.storeKey),
  };
}

export function buildSandboxPitchPayload(
  payload: SandboxPayload,
): PitchPayload {
  const byRetailer = new Map<
    string,
    {
      stores: number;
      visits: number;
      samples: number;
      units: number;
      cost: number;
    }
  >();
  for (const s of payload.stores) {
    const cur = byRetailer.get(s.retailerBanner) ?? {
      stores: 0,
      visits: 0,
      samples: 0,
      units: 0,
      cost: 0,
    };
    cur.stores += 1;
    cur.visits += s.visits;
    cur.samples += s.consumersSampled;
    cur.units += s.unitsSold;
    cur.cost += s.demoCost;
    byRetailer.set(s.retailerBanner, cur);
  }

  return {
    ok: true,
    title: `${payload.brand.name} — Retail Buyer QBR`,
    subtitle: `${payload.brand.tagline} · ${payload.brand.periodStart} → ${payload.brand.periodEnd}`,
    buyerName: "Category Buyer & Regional Team",
    brandName: payload.brand.name,
    introNote:
      "Verified in-store sampling velocity, on-shelf compliance, and shopper voice from Spark's read-only Sample Brand Sandbox.",
    sellStory: `Across ${payload.kpis.activations} retail activations in ${payload.kpis.markets} markets, ${payload.brand.name} converted ${payload.kpis.conversionPct}% of sampled shoppers into immediate purchases and sustained a +${payload.kpis.posLiftPct}% POS velocity lift.`,
    periodStart: payload.brand.periodStart,
    periodEnd: payload.brand.periodEnd,
    includeCosts: true,
    brand: {
      name: payload.brand.name,
      primary: "#2B4C08",
    },
    kpis: {
      visits: payload.kpis.activations,
      stores: payload.kpis.activeDoors,
      samplesDistributed: payload.kpis.consumersSampled,
      repObservedUnits: payload.kpis.unitsSold,
      conversionRatePct: payload.kpis.conversionPct,
      posLiftPct: payload.kpis.posLiftPct,
      supportedCost: payload.kpis.totalDemoSpend.toFixed(2),
      costPerSample: payload.kpis.avgCostPerSample.toFixed(2),
    },
    retailerBreakdown: Array.from(byRetailer.entries()).map(([banner, v]) => ({
      retailerBanner: banner,
      storesCount: v.stores,
      visits: v.visits,
      samplesDistributed: v.samples,
      repObservedUnits: v.units,
      supportedCost: v.cost.toFixed(2),
      costPerUnitSold: v.units > 0 ? (v.cost / v.units).toFixed(2) : null,
    })),
    topStoreWins: [...payload.stores]
      .sort((a, b) => b.conversionPct - a.conversionPct)
      .slice(0, 6)
      .map((s) => ({
        storeLabel: s.storeName,
        retailerBanner: s.retailerBanner,
        market: s.market,
        visits: s.visits,
        samplesDistributed: s.consumersSampled,
        repObservedUnits: s.unitsSold,
        posCoverageLabel: `+${s.posLiftPct}% POS lift`,
        highlight: s.quotes[0] ?? null,
        supportedCost: s.demoCost.toFixed(2),
        costPerUnitSold: (s.demoCost / Math.max(1, s.unitsSold)).toFixed(2),
      })),
    footprint: {
      statesCount: payload.footprint.length,
      marketsCount: payload.kpis.markets,
      states: payload.footprint.map((f) => ({
        state: f.stateCode,
        stores: f.stores,
        visits: f.activations,
        samples: f.consumers,
        repUnits: f.unitsSold,
      })),
      topMarkets: payload.stores.slice(0, 5).map((s) => ({
        market: s.market,
        state: s.stateCode,
        stores: 1,
        visits: s.visits,
        samples: s.consumersSampled,
        repUnits: s.unitsSold,
      })),
    },
    posHalo: {
      available: true,
      baselineAvgUnits: 28,
      demoWeekLiftPct: 46.2,
      postDemoHaloPct: payload.kpis.posLiftPct,
      matchedStores: payload.stores.length,
      weeks: [
        { offset: -2, label: "2 wks pre", avgUnits: 27, totalUnits: 243, storeWeeks: 9, liftPct: 0 },
        { offset: -1, label: "1 wk pre", avgUnits: 29, totalUnits: 261, storeWeeks: 9, liftPct: 0 },
        { offset: 0, label: "Demo wk", avgUnits: 41, totalUnits: 369, storeWeeks: 9, liftPct: 46.2 },
        { offset: 1, label: "+1 wk", avgUnits: 37, totalUnits: 333, storeWeeks: 9, liftPct: 32.1 },
        { offset: 2, label: "+2 wks", avgUnits: 36, totalUnits: 324, storeWeeks: 9, liftPct: 28.6 },
        { offset: 3, label: "+3 wks", avgUnits: 35, totalUnits: 315, storeWeeks: 9, liftPct: 25.0 },
      ],
    },
    shelfCompliance: {
      available: true,
      auditedVisits: payload.kpis.activations,
      unreadVisits: 0,
      onShelfCount: Math.round(
        (payload.kpis.activations * payload.kpis.osaRatePct) / 100,
      ),
      notFoundCount: 4,
      unclearCount: 1,
      osaRatePct: payload.kpis.osaRatePct,
      priceTagVisibleCount: 35,
      priceTagRatePct: payload.kpis.priceTagRatePct,
      avgFacings: payload.kpis.avgFacings,
      medianPrice: payload.kpis.medianPrice,
      oosGapsFlagged: payload.kpis.oosGapsCount,
    },
    shopperVoice: {
      available: true,
      commentCount: 134,
      recapCount: payload.kpis.activations,
      highlights: payload.shopperThemes.map((t) => ({
        section: "liked",
        text: t.theme,
      })),
      themes: payload.shopperThemes.map((t) => ({
        section: "liked",
        label: t.theme,
        recapCount: t.mentions,
        quote: t.quote,
      })),
      quotes: payload.shopperThemes.map((t) => ({
        section: "liked",
        label: t.theme,
        quote: t.quote,
      })),
    },
    photos: payload.shelfPhotos.slice(0, 6).map((p) => ({
      id: p.fileId,
      url: p.photoUrl,
      caption: `${p.storeName} · ${p.bucketName}${p.price ? ` · $${p.price}` : ""}`,
      store: p.storeName,
      market: p.market,
      state: p.stateCode,
      eventDate: p.eventDate,
      category: p.bucketName,
    })),
  };
}

export async function fetchSandboxBrand(): Promise<SandboxPayload> {
  const origin = pitchApiOrigin();
  const url = `${origin}/api/public/sandbox-brand`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`Could not load sample brand (${resp.status}).`);
  }
  return (await resp.json()) as SandboxPayload;
}
