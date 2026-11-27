/**
 * Pure filtering, MSRP price-drift, and market rollup helpers for the
 * Shelf Compliance, Pricing & Competitor Voice Hub (`/shelf-voice`).
 */

export type ShelfStoreFilter =
  | "all"
  | "attention"
  | "oos"
  | "missing_tag"
  | "price_drift"
  | "low_facings";

export type ShelfPhotoFilter = "all" | "oos" | "missing_tag" | "on_shelf";

export interface ShelfStoreLike {
  readonly storeKey: string;
  readonly storeName: string;
  readonly market: string;
  readonly stateCode: string;
  readonly visitCount: number;
  readonly latestDate: string;
  readonly latestRecapUuid: string;
  readonly latestStatus: string;
  readonly onShelfVisits: number;
  readonly notFoundVisits: number;
  readonly osaRatePct?: number | null;
  readonly missingTagVisits: number;
  readonly oosGapVisits: number;
  readonly latestFacings?: number | null;
  readonly avgFacings?: number | null;
  readonly latestPrice?: string | null;
  readonly priceDriftPct?: number | null;
  readonly stockoutSignal: string;
  readonly competitorPromo: string;
  readonly hasBeforeAfter: boolean;
}

export interface ShelfPhotoLike {
  readonly fileId: string;
  readonly photoUrl: string;
  readonly bucketName: string;
  readonly storeKey: string;
  readonly storeName: string;
  readonly market: string;
  readonly stateCode: string;
  readonly eventDate: string;
  readonly recapUuid: string;
  readonly productOnShelf: string;
  readonly facings?: number | null;
  readonly priceTagVisible: string;
  readonly price?: string | null;
  readonly outOfStockGap: string;
}

export const MSRP_DRIFT_THRESHOLD_PCT = 5;
export const LOW_FACINGS_THRESHOLD = 2;

export function parseMsrpTarget(
  rawInput: string,
  medianPrice: string | null | undefined,
): number | null {
  const cleaned = rawInput.replace(/[$,\s]/g, "").trim();
  if (cleaned) {
    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  if (medianPrice) {
    const med = Number.parseFloat(medianPrice);
    return Number.isFinite(med) && med > 0 ? med : null;
  }
  return null;
}

export function computePriceDrift(
  observedPriceStr: string | null | undefined,
  targetMsrp: number | null,
): { deltaDollars: number; deltaPct: number; isDrift: boolean } | null {
  if (!observedPriceStr || targetMsrp == null || targetMsrp <= 0) return null;
  const obs = Number.parseFloat(observedPriceStr);
  if (!Number.isFinite(obs)) return null;
  const deltaDollars = Math.round((obs - targetMsrp) * 100) / 100;
  const deltaPct = Math.round(((obs - targetMsrp) / targetMsrp) * 1000) / 10;
  return {
    deltaDollars,
    deltaPct,
    isDrift: Math.abs(deltaPct) >= MSRP_DRIFT_THRESHOLD_PCT,
  };
}

export function storeHasShelfAttention(
  row: ShelfStoreLike,
  targetMsrp: number | null,
): boolean {
  if (row.notFoundVisits > 0 || row.oosGapVisits > 0 || row.missingTagVisits > 0) {
    return true;
  }
  if (row.stockoutSignal) return true;
  const drift = computePriceDrift(row.latestPrice, targetMsrp);
  if (drift?.isDrift) return true;
  if (row.latestFacings != null && row.latestFacings <= LOW_FACINGS_THRESHOLD) {
    return true;
  }
  return false;
}

export function filterShelfStores<T extends ShelfStoreLike>(
  rows: readonly T[],
  filter: ShelfStoreFilter,
  query: string,
  targetMsrp: number | null,
): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (q) {
      const hay = `${row.storeName} ${row.market} ${row.stateCode} ${row.stockoutSignal} ${row.competitorPromo}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filter === "all") return true;
    if (filter === "attention") return storeHasShelfAttention(row, targetMsrp);
    if (filter === "oos") {
      return row.notFoundVisits > 0 || row.oosGapVisits > 0 || Boolean(row.stockoutSignal);
    }
    if (filter === "missing_tag") return row.missingTagVisits > 0;
    if (filter === "price_drift") {
      return Boolean(computePriceDrift(row.latestPrice, targetMsrp)?.isDrift);
    }
    if (filter === "low_facings") {
      return row.latestFacings != null && row.latestFacings <= LOW_FACINGS_THRESHOLD;
    }
    return true;
  });
}

export function filterShelfPhotos<T extends ShelfPhotoLike>(
  photos: readonly T[],
  filter: ShelfPhotoFilter,
): T[] {
  if (filter === "all") return [...photos];
  if (filter === "oos") {
    return photos.filter(
      (p) => p.productOnShelf === "no" || p.outOfStockGap === "yes",
    );
  }
  if (filter === "missing_tag") {
    return photos.filter((p) => p.priceTagVisible === "no");
  }
  return photos.filter((p) => p.productOnShelf === "yes");
}

export interface MarketOsaRow {
  market: string;
  stores: number;
  auditedVisits: number;
  onShelfVisits: number;
  osaRatePct: number;
  missingTags: number;
}

export function aggregateOsaByMarket(
  stores: readonly ShelfStoreLike[],
): MarketOsaRow[] {
  const map = new Map<
    string,
    { stores: number; visits: number; onShelf: number; missingTags: number }
  >();
  for (const s of stores) {
    const label = s.market || s.stateCode || "Unmapped";
    const cur = map.get(label) ?? {
      stores: 0,
      visits: 0,
      onShelf: 0,
      missingTags: 0,
    };
    cur.stores += 1;
    cur.visits += s.visitCount;
    cur.onShelf += s.onShelfVisits;
    cur.missingTags += s.missingTagVisits;
    map.set(label, cur);
  }
  return Array.from(map.entries())
    .map(([market, v]) => ({
      market,
      stores: v.stores,
      auditedVisits: v.visits,
      onShelfVisits: v.onShelf,
      osaRatePct: v.visits > 0 ? Math.round((v.onShelf / v.visits) * 1000) / 10 : 0,
      missingTags: v.missingTags,
    }))
    .sort((a, b) => a.osaRatePct - b.osaRatePct || b.auditedVisits - a.auditedVisits);
}

export function trendBadgeMeta(trend: string): {
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  if (trend === "rising") {
    return {
      label: "↑ Rising",
      bg: "rgba(239, 90, 42, 0.12)",
      color: "var(--spark-flag-ink, #a8340f)",
      border: "rgba(239, 90, 42, 0.35)",
    };
  }
  if (trend === "new") {
    return {
      label: "New",
      bg: "rgba(239, 90, 42, 0.10)",
      color: "var(--spark-flag-ink, #a8340f)",
      border: "rgba(239, 90, 42, 0.28)",
    };
  }
  if (trend === "cooling") {
    return {
      label: "↓ Cooling",
      bg: "var(--spark-ok-bg)",
      color: "var(--spark-ok-ink)",
      border: "var(--spark-ok-border)",
    };
  }
  return {
    label: "Steady",
    bg: "var(--spark-surface-2)",
    color: "var(--spark-text-meta)",
    border: "var(--spark-border)",
  };
}
