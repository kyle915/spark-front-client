import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildPitchSlidePlan,
  fmtPitchNum,
  fmtPitchPct,
  resolveDeckAccentHex,
  sanitizeDeckFilename,
  type PitchPayload,
} from "./pitchDeckTypes";
import PitchFootprintMap from "./PitchFootprintMap";
import { buildFootprintSvgMarkup } from "./pitchFootprintGeometry";
import { buildBuyerDeckPptxZip } from "./buyerDeckPptx";

const SAMPLE_PAYLOAD: PitchPayload = {
  ok: true,
  title: "HEB Quarterly Business Review",
  subtitle: "In-store sampling velocity, 2–4 week POS halo & shelf compliance",
  buyerName: "Sarah Chen",
  brandName: "Liquid Death",
  periodStart: "2026-10-01",
  periodEnd: "2026-11-15",
  retailerFilter: "HEB",
  marketFilter: "TX",
  includeCosts: false,
  sellStory:
    "Liquid Death ran 18 visits across 12 HEB doors, handing out 2,400 samples with +38.5% matched POS lift.",
  brand: { name: "Liquid Death", primary: "#2B4C08" },
  kpis: {
    totalVisits: 18,
    storesActivated: 12,
    totalSamplesDistributed: 2400,
    repObservedUnits: 420,
    adjustedRegisterUnits: 615,
    samplingLiftPct: 38.5,
  },
  retailerBreakdown: [
    {
      retailerBanner: "HEB",
      storesCount: 12,
      visits: 18,
      samplesDistributed: 2400,
      repObservedUnits: 420,
      adjustedRegisterUnits: 615,
    },
  ],
  topStoreWins: [
    {
      storeLabel: "HEB #725",
      retailerBanner: "HEB",
      market: "Houston, TX",
      visits: 4,
      samplesDistributed: 640,
      repObservedUnits: 128,
      adjustedRegisterUnits: 184,
      highlight: "High afternoon conversion on Mango Chainsaw.",
    },
    {
      storeLabel: "HEB #411",
      retailerBanner: "HEB",
      market: "Austin, TX",
      visits: 3,
      samplesDistributed: 490,
      repObservedUnits: 96,
      adjustedRegisterUnits: 140,
      highlight: "Strong repeat trial from weekend shoppers.",
    },
  ],
  footprint: {
    statesCount: 2,
    marketsCount: 3,
    states: [
      { state: "TX", stores: 10, visits: 15, samples: 2000, repUnits: 350, registerUnits: 520 },
      { state: "CA", stores: 2, visits: 3, samples: 400, repUnits: 70, registerUnits: 95 },
    ],
    topMarkets: [
      { market: "Houston, TX", state: "TX", stores: 6, visits: 9, samples: 1200, repUnits: 210 },
      { market: "Austin, TX", state: "TX", stores: 4, visits: 6, samples: 800, repUnits: 140 },
    ],
  },
  posHalo: {
    available: true,
    note: "Average matched register units per store-SKU-week before, during, and 1–4 weeks after demos.",
    baselineAvgUnits: 20,
    demoWeekLiftPct: 95,
    postDemoHaloPct: 35,
    matchedStores: 10,
    weeks: [
      { offset: -1, label: "Pre-demo baseline", avgUnits: 20, totalUnits: 200, storeWeeks: 10, liftPct: 0 },
      { offset: 0, label: "Demo week", avgUnits: 39, totalUnits: 390, storeWeeks: 10, liftPct: 95 },
      { offset: 1, label: "Week +1", avgUnits: 30, totalUnits: 300, storeWeeks: 10, liftPct: 50 },
      { offset: 2, label: "Week +2", avgUnits: 27, totalUnits: 270, storeWeeks: 10, liftPct: 35 },
      { offset: 3, label: "Week +3", avgUnits: 25, totalUnits: 250, storeWeeks: 10, liftPct: 25 },
      { offset: 4, label: "Week +4", avgUnits: 26, totalUnits: 260, storeWeeks: 10, liftPct: 30 },
    ],
  },
  shelfCompliance: {
    available: true,
    auditedVisits: 16,
    unreadVisits: 2,
    onShelfCount: 15,
    notFoundCount: 1,
    unclearCount: 0,
    osaRatePct: 93.8,
    priceTagVisibleCount: 14,
    priceTagRatePct: 87.5,
    avgFacings: 4.2,
    medianPrice: "2.49",
    oosGapsFlagged: 1,
    scopedToFilter: true,
  },
  shopperVoice: {
    available: true,
    source: "ready",
    commentCount: 44,
    recapCount: 14,
    highlights: [{ section: "liked", text: "Crisp carbonation without heavy sugar." }],
    themes: [
      {
        section: "liked",
        label: "Crisp flavor & low sugar",
        recapCount: 9,
        quote: "Loved how crisp it tastes without tasting overly sweet.",
      },
      {
        section: "asked",
        label: "Multi-pack availability",
        recapCount: 5,
        quote: "Several shoppers asked if 12-packs were stocked in the cold box.",
      },
    ],
    quotes: [
      {
        section: "liked",
        label: "Crisp flavor & low sugar",
        quote: "Loved how crisp it tastes without tasting overly sweet.",
      },
      {
        section: "asked",
        label: "Multi-pack availability",
        quote: "Several shoppers asked if 12-packs were stocked in the cold box.",
      },
    ],
  },
  photos: [
    {
      id: "101",
      url: "https://example.com/photo-1.jpg",
      store: "HEB #725",
      retailer: "HEB",
      market: "Houston, TX",
      eventDate: "2026-10-18",
      caption: "On shelf at HEB #725, 4 facings, $2.49.",
    },
    {
      id: "102",
      url: "https://example.com/photo-2.jpg",
      store: "HEB #411",
      retailer: "HEB",
      market: "Austin, TX",
      eventDate: "2026-10-25",
      caption: "Demo table setup beside beverage endcap.",
    },
  ],
};

describe("Retail Buyer QBR / Line-Review Deck Generator", () => {
  it("builds a complete 8-slide outline when all QBR datasets are present", () => {
    const plan = buildPitchSlidePlan(SAMPLE_PAYLOAD);
    expect(plan.map((s) => s.id)).toEqual([
      "cover",
      "kpis",
      "footprint",
      "halo",
      "shelf",
      "stores",
      "voice",
      "photos-0",
    ]);
    expect(fmtPitchNum(2400)).toBe("2,400");
    expect(fmtPitchPct(38.5, true)).toBe("+38.5%");
    expect(resolveDeckAccentHex(SAMPLE_PAYLOAD)).toBe("#2B4C08");
    expect(sanitizeDeckFilename("HEB Quarterly Business Review!")).toBe(
      "heb-quarterly-business-review.pptx",
    );
  });

  it("renders US choropleth footprint map SVG markup and React component cleanly", () => {
    const svg = buildFootprintSvgMarkup(SAMPLE_PAYLOAD.footprint!.states, "#2B4C08");
    expect(svg).toContain("<svg");
    expect(svg).toContain(">TX<");
    expect(svg).toContain(">CA<");

    const html = renderToStaticMarkup(
      <PitchFootprintMap
        states={SAMPLE_PAYLOAD.footprint!.states}
        accentHex="#2B4C08"
      />,
    );
    expect(html).toContain('aria-label="US activation footprint across 2 states"');
    expect(html).toContain(">TX<");
    expect(html).toContain(">CA<");
  });

  it("generates a valid 16:9 OOXML .pptx package with all slides, tables, and relationships", async () => {
    const { zip, slideCount } = await buildBuyerDeckPptxZip(SAMPLE_PAYLOAD, {
      fetchPhotos: false,
    });
    expect(slideCount).toBe(8);

    const files = Object.keys(zip.files);
    expect(files).toContain("[Content_Types].xml");
    expect(files).toContain("_rels/.rels");
    expect(files).toContain("ppt/presentation.xml");
    expect(files).toContain("ppt/_rels/presentation.xml.rels");
    expect(files).toContain("ppt/slideMasters/slideMaster1.xml");
    expect(files).toContain("ppt/slideLayouts/slideLayout1.xml");
    expect(files).toContain("ppt/theme/theme1.xml");
    for (let i = 1; i <= 8; i++) {
      expect(files).toContain(`ppt/slides/slide${i}.xml`);
      expect(files).toContain(`ppt/slides/_rels/slide${i}.xml.rels`);
    }

    const slide1 = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slide1).toContain("HEB Quarterly Business Review");
    expect(slide1).toContain("SARAH CHEN");

    const slide2 = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(slide2).toContain("<a:tbl>");
    expect(slide2).toContain("HEB");

    const slide4 = await zip.file("ppt/slides/slide4.xml")!.async("string");
    expect(slide4).toContain("2–4 WK POST-DEMO HALO");
    expect(slide4).toContain("+35%");

    const slide5 = await zip.file("ppt/slides/slide5.xml")!.async("string");
    expect(slide5).toContain("93.8%");
    expect(slide5).toContain("$2.49");

    const slide7 = await zip.file("ppt/slides/slide7.xml")!.async("string");
    expect(slide7).toContain("CRISP FLAVOR &amp; LOW SUGAR");
    expect(slide7).toContain("MULTI-PACK AVAILABILITY");
    expect(slide7).toContain("Loved how crisp it tastes");

    const presXml = await zip.file("ppt/presentation.xml")!.async("string");
    expect(presXml).toContain('cx="12192000" cy="6858000"');
  });

  it("wires BuyerPitchDeckShareCard, PhotoWallPage, and PublicPitch cleanly", () => {
    const shareCard = readFileSync(
      resolve(__dirname, "../../pilot/BuyerPitchDeckShareCard.tsx"),
      "utf8",
    );
    expect(shareCard).toContain("Build Buyer QBR / Line-Review Deck");
    expect(shareCard).toContain("downloadBuyerDeckPptx");
    expect(shareCard).toContain("periodStart: effectiveStart");

    const photoWall = readFileSync(
      resolve(__dirname, "../../pilot/PhotoWallPage.tsx"),
      "utf8",
    );
    expect(photoWall).toContain("Build Buyer Deck");
    expect(photoWall).toContain("/buyer-report?");

    const publicPitch = readFileSync(
      resolve(__dirname, "./PublicPitch.tsx"),
      "utf8",
    );
    expect(publicPitch).toContain("Download .pptx");
    expect(publicPitch).toContain("PitchFootprintMap");
    expect(publicPitch).toContain("RecapKpiStrip");
    expect(publicPitch).toContain("Save PDF");
  });
});
