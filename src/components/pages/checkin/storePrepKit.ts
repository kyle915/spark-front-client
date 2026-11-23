/**
 * Store Prep Kit payload helpers for BA shift cards.
 */

import type { CheckinResource } from "./checkinTypes";

export type StorePrepKitLastShelf = {
  eventDate: string;
  productOnShelf: string;
  priceTagVisible: string;
  storeName: string;
};

export type StorePrepKitStockRisk = {
  level: "none" | "watch" | "high";
  reason: string;
};

export type StorePrepKit = {
  logisticsNotes: string;
  lastShelfVisit: StorePrepKitLastShelf | null;
  skus: string[];
  resources: CheckinResource[];
  stockRisk: StorePrepKitStockRisk | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseLastShelf(raw: unknown): StorePrepKitLastShelf | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    eventDate: asString(row.eventDate),
    productOnShelf: asString(row.productOnShelf) || "unclear",
    priceTagVisible: asString(row.priceTagVisible) || "unclear",
    storeName: asString(row.storeName),
  };
}

function parseStockRisk(raw: unknown): StorePrepKitStockRisk | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const level = asString(row.level);
  if (level !== "none" && level !== "watch" && level !== "high") return null;
  return { level, reason: asString(row.reason) };
}

function parseResources(raw: unknown): CheckinResource[] {
  if (!Array.isArray(raw)) return [];
  const out: CheckinResource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = asString(row.label);
    const url = asString(row.url);
    const kind = asString(row.kind) || "link";
    if (!label || !url) continue;
    const note = asString(row.note);
    out.push(
      note
        ? { label, kind: kind as CheckinResource["kind"], url, note }
        : { label, kind: kind as CheckinResource["kind"], url },
    );
  }
  return out;
}

export function parseStorePrepKit(raw: unknown): StorePrepKit | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const skus = Array.isArray(row.skus)
    ? row.skus.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  return {
    logisticsNotes: asString(row.logisticsNotes).trim(),
    lastShelfVisit: parseLastShelf(row.lastShelfVisit),
    skus,
    resources: parseResources(row.resources),
    stockRisk: parseStockRisk(row.stockRisk),
  };
}

export function storePrepKitHasContent(kit: StorePrepKit | null | undefined): boolean {
  if (!kit) return false;
  if (kit.logisticsNotes.trim()) return true;
  if (kit.lastShelfVisit) return true;
  if (kit.skus.length) return true;
  if (kit.resources.length) return true;
  if (kit.stockRisk && (kit.stockRisk.level === "high" || kit.stockRisk.level === "watch")) {
    return true;
  }
  return false;
}

/**
 * Open the kit by default when stock risk needs eyes before the BA walks in.
 * Quiet "none" / empty risk stays collapsed so the card doesn't dominate.
 */
export function storePrepKitShouldStartOpen(
  kit: StorePrepKit | null | undefined,
): boolean {
  if (!kit?.stockRisk) return false;
  return kit.stockRisk.level === "high" || kit.stockRisk.level === "watch";
}

/** True when the stock-risk line should stay visible above the fold. */
export function storePrepKitShowsPinnedRisk(
  kit: StorePrepKit | null | undefined,
): boolean {
  const risk = kit?.stockRisk;
  if (!risk?.reason.trim()) return false;
  return (
    risk.level === "high" || risk.level === "watch" || risk.level === "none"
  );
}

export function shelfStatusLabel(productOnShelf: string): string {
  switch (productOnShelf) {
    case "yes":
      return "On shelf last visit";
    case "no":
      return "Not found last visit";
    default:
      return "Shelf status unclear";
  }
}
