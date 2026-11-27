/**
 * Shared types, API fetcher, and slide-plan builder for the Retail Buyer QBR /
 * Line-Review Deck (`/pitch/:token` + `.pptx` export).
 */

export interface PitchRetailerRow {
  retailerBanner?: string;
  storesCount?: number;
  visits?: number;
  samplesDistributed?: number;
  repObservedUnits?: number;
  adjustedRegisterUnits?: number | null;
  supportedCost?: string | null;
  costPerUnitSold?: string | null;
}

export interface PitchStoreWin {
  storeLabel?: string;
  retailerBanner?: string;
  market?: string;
  visits?: number;
  samplesDistributed?: number;
  repObservedUnits?: number;
  adjustedRegisterUnits?: number | null;
  posCoverageLabel?: string;
  highlight?: string | null;
  supportedCost?: string | null;
  costPerUnitSold?: string | null;
}

export interface PitchFootprintState {
  state: string;
  stores: number;
  visits: number;
  samples: number;
  repUnits: number;
  registerUnits?: number | null;
}

export interface PitchFootprintMarket {
  market: string;
  state: string;
  stores: number;
  visits: number;
  samples: number;
  repUnits: number;
}

export interface PitchFootprint {
  statesCount: number;
  marketsCount: number;
  states: PitchFootprintState[];
  topMarkets: PitchFootprintMarket[];
}

export interface PitchPosHaloWeek {
  offset: number;
  label: string;
  avgUnits: number;
  totalUnits: number;
  storeWeeks: number;
  liftPct?: number | null;
}

export interface PitchPosHalo {
  available: boolean;
  note?: string;
  baselineAvgUnits?: number | null;
  demoWeekLiftPct?: number | null;
  postDemoHaloPct?: number | null;
  matchedStores: number;
  weeks: PitchPosHaloWeek[];
}

export interface PitchShelfCompliance {
  available: boolean;
  auditedVisits: number;
  unreadVisits: number;
  onShelfCount: number;
  notFoundCount: number;
  unclearCount: number;
  osaRatePct?: number | null;
  priceTagVisibleCount: number;
  priceTagRatePct?: number | null;
  avgFacings?: number | null;
  medianPrice?: string | null;
  oosGapsFlagged: number;
  scopedToFilter?: boolean;
}

export interface PitchVoiceTheme {
  section: string;
  label: string;
  recapCount: number;
  quote?: string;
}

export interface PitchVoiceQuote {
  section: string;
  label: string;
  quote: string;
}

export interface PitchVoiceHighlight {
  section: string;
  text: string;
}

export interface PitchShopperVoice {
  available: boolean;
  source?: string;
  commentCount: number;
  recapCount: number;
  highlights: PitchVoiceHighlight[];
  themes: PitchVoiceTheme[];
  quotes: PitchVoiceQuote[];
}

export interface PitchPhoto {
  id?: string;
  url: string;
  caption?: string;
  store?: string;
  retailer?: string;
  market?: string;
  state?: string;
  eventDate?: string;
  category?: string;
  skus?: string[];
}

export interface PitchPayload {
  ok?: boolean;
  locked?: boolean;
  title?: string;
  subtitle?: string;
  buyerName?: string;
  brandName?: string;
  requiresPasscode?: boolean;
  introNote?: string;
  sellStory?: string;
  sellStorySource?: string;
  periodStart?: string;
  periodEnd?: string;
  retailerFilter?: string;
  marketFilter?: string;
  includeCosts?: boolean;
  brand?: {
    name?: string;
    primary?: string | null;
    cssVariables?: Record<string, string>;
  };
  kpis?: Record<string, unknown>;
  retailerBreakdown?: PitchRetailerRow[];
  topStoreWins?: PitchStoreWin[];
  footprint?: PitchFootprint;
  posHalo?: PitchPosHalo;
  shelfCompliance?: PitchShelfCompliance;
  shopperVoice?: PitchShopperVoice;
  photos?: PitchPhoto[];
  error?: string;
  message?: string;
}

export type PitchSlideDescriptor =
  | { id: "cover"; label: string; title: string }
  | { id: "kpis"; label: string; title: string }
  | { id: "footprint"; label: string; title: string }
  | { id: "halo"; label: string; title: string }
  | { id: "shelf"; label: string; title: string }
  | { id: "stores"; label: string; title: string }
  | { id: "voice"; label: string; title: string }
  | {
      id: `photos-${number}`;
      label: string;
      title: string;
      pageIndex: number;
      photos: PitchPhoto[];
    };

export const PHOTOS_PER_SLIDE = 6;

export function pitchApiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

export function fmtPitchNum(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-US");
  const parsed = Number(v);
  if (Number.isFinite(parsed) && String(v).trim() !== "") {
    return parsed.toLocaleString("en-US");
  }
  return String(v);
}

export function fmtPitchPct(v: unknown, signed = false): string {
  if (v === null || v === undefined || v === "") return "—";
  const num = Number(v);
  if (Number.isFinite(num)) {
    const prefix = signed && num > 0 ? "+" : "";
    return `${prefix}${num.toFixed(1).replace(/\.0$/, "")}%`;
  }
  const raw = String(v);
  return raw.endsWith("%") ? raw : `${raw}%`;
}

export function sanitizeDeckFilename(rawTitle: string | undefined): string {
  const cleaned = (rawTitle || "buyer-qbr-deck")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${cleaned || "buyer-qbr-deck"}.pptx`;
}

/**
 * Resolve a hex accent color from the brand payload, falling back to Spark's
 * calm editorial obsidian-olive accent when missing or non-hex.
 */
export function resolveDeckAccentHex(data: PitchPayload): string {
  const candidates = [
    data.brand?.primary,
    data.brand?.cssVariables?.["--color-primary"],
  ];
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      const [, r, g, b] = trimmed;
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
  }
  return "#14160F";
}

/**
 * Build the ordered 6–8+ slide presentation outline for a Buyer QBR Deck.
 * Omits empty optional modules so every slide carries real, verified evidence.
 */
export function buildPitchSlidePlan(data: PitchPayload): PitchSlideDescriptor[] {
  const slides: PitchSlideDescriptor[] = [
    { id: "cover", label: "Cover", title: data.title || "Buyer Pitch Deck" },
    { id: "kpis", label: "KPIs", title: "Program Headline & Banner Summary" },
  ];

  const footprint = data.footprint;
  if (
    footprint &&
    ((footprint.states && footprint.states.length > 0) ||
      (footprint.topMarkets && footprint.topMarkets.length > 0))
  ) {
    slides.push({
      id: "footprint",
      label: "Footprint",
      title: "Geographic Activation Footprint",
    });
  }

  const posHalo = data.posHalo;
  const topStoreWins = data.topStoreWins || [];
  if (posHalo?.available && posHalo.weeks && posHalo.weeks.length > 0) {
    slides.push({
      id: "halo",
      label: "POS Halo",
      title: "2–4 Week Post-Demo POS Lift Halo",
    });
  } else if (topStoreWins.length > 0) {
    slides.push({
      id: "halo",
      label: "Velocity",
      title: "Store Sampling & Velocity Readout",
    });
  }

  if (data.shelfCompliance?.available) {
    slides.push({
      id: "shelf",
      label: "Shelf OSA",
      title: "On-Shelf Availability & Price Compliance",
    });
  }

  if (topStoreWins.length > 0) {
    slides.push({
      id: "stores",
      label: "Top Stores",
      title: "Top Performing Doors",
    });
  }

  if (
    data.shopperVoice?.available &&
    ((data.shopperVoice.themes && data.shopperVoice.themes.length > 0) ||
      (data.shopperVoice.quotes && data.shopperVoice.quotes.length > 0))
  ) {
    slides.push({
      id: "voice",
      label: "Shopper Voice",
      title: "AI-Distilled Shopper Voice & Takeaways",
    });
  }

  const photos = data.photos || [];
  if (photos.length > 0) {
    const pages = Math.ceil(photos.length / PHOTOS_PER_SLIDE);
    for (let i = 0; i < pages; i++) {
      const slice = photos.slice(
        i * PHOTOS_PER_SLIDE,
        (i + 1) * PHOTOS_PER_SLIDE,
      );
      slides.push({
        id: `photos-${i}`,
        label: pages > 1 ? `Proof ${i + 1}/${pages}` : "In-Store Proof",
        title:
          pages > 1
            ? `Curated In-Store Proof (${i + 1} of ${pages})`
            : "Curated In-Store Proof",
        pageIndex: i,
        photos: slice,
      });
    }
  }

  return slides;
}

export async function fetchPublicPitchPayload(
  token: string,
  passcode?: string,
): Promise<{ status: number; payload: PitchPayload | null }> {
  const origin = pitchApiOrigin();
  const url = `${origin}/api/public/pitch/${encodeURIComponent(token)}/`;
  const init: RequestInit = passcode
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      }
    : { method: "GET" };
  const res = await fetch(url, init);
  const payload = (await res.json().catch(() => null)) as PitchPayload | null;
  return { status: res.status, payload };
}
