/**
 * Product Seeding "Drop-off Locations" repeater — structured JSON in a
 * longtext CustomFieldValue.
 *
 * Shape (array of locations):
 *   {
 *     placeName: string,          // account / venue name (required)
 *     address?: string,           // typed or reverse-geocoded address
 *     lat?: number | null,
 *     lng?: number | null,
 *     source?: "gps" | "places" | "manual",
 *     skus: [{ productId, productName?, cases }]
 *   }
 *
 * Old seeding recaps may still have flat "Location product dropped" /
 * "Total cases dropped" / "Cases Dropped by SKU" — leave those alone.
 */

export const DROP_OFF_LOCATIONS_FIELD = "Drop-off Locations";

export type DropOffSkuLine = {
  productId: string;
  productName?: string;
  cases: number;
};

export type DropOffLocation = {
  placeName: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  source?: "gps" | "places" | "manual";
  skus: DropOffSkuLine[];
};

export type DropOffProductRef = {
  id: string;
  name: string;
  category?: string | null;
  imageUrl?: string | null;
};

export function isDropOffLocationsField(field: {
  name?: string | null;
}): boolean {
  const n = (field.name ?? "").trim().toLowerCase();
  return n === "drop-off locations" || n === "drop off locations";
}

export function emptyDropOffLocation(): DropOffLocation {
  return {
    placeName: "",
    address: "",
    lat: null,
    lng: null,
    source: "manual",
    skus: [],
  };
}

function asFiniteNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeSku(raw: unknown): DropOffSkuLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productId = String(o.productId ?? o.product_id ?? "").trim();
  if (!productId) return null;
  const cases = asFiniteNumber(o.cases ?? o.quantity ?? o.qty) ?? 0;
  const productName =
    typeof o.productName === "string"
      ? o.productName
      : typeof o.product_name === "string"
        ? o.product_name
        : undefined;
  return {
    productId,
    productName,
    cases: cases > 0 ? Math.round(cases) : 0,
  };
}

function normalizeLocation(raw: unknown): DropOffLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const placeName = String(
    o.placeName ?? o.place_name ?? o.name ?? "",
  ).trim();
  const address = String(o.address ?? o.formattedAddress ?? "").trim();
  const lat = asFiniteNumber(o.lat ?? o.latitude);
  const lng = asFiniteNumber(o.lng ?? o.longitude);
  const sourceRaw = String(o.source ?? "").toLowerCase();
  const source: DropOffLocation["source"] =
    sourceRaw === "gps" || sourceRaw === "places" || sourceRaw === "manual"
      ? sourceRaw
      : address || lat != null
        ? "manual"
        : "manual";
  const skusRaw = Array.isArray(o.skus)
    ? o.skus
    : Array.isArray(o.products)
      ? o.products
      : [];
  const skus = skusRaw
    .map(normalizeSku)
    .filter((s): s is DropOffSkuLine => Boolean(s));
  return {
    placeName,
    address: address || undefined,
    lat,
    lng,
    source,
    skus,
  };
}

/** Parse stored field value → locations. Tolerates legacy plain text. */
export function parseDropOffLocations(
  value: string | null | undefined,
): DropOffLocation[] {
  if (value == null) return [];
  const trimmed = String(value).trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map(normalizeLocation)
        .filter((loc): loc is DropOffLocation => Boolean(loc));
    }
    if (parsed && typeof parsed === "object") {
      const loc = normalizeLocation(parsed);
      return loc ? [loc] : [];
    }
  } catch {
    // Legacy flat "Location product dropped" text may land here if someone
    // renamed the field — treat as a single place with no coords/skus.
    return [
      {
        placeName: trimmed,
        address: trimmed,
        lat: null,
        lng: null,
        source: "manual",
        skus: [],
      },
    ];
  }
  return [];
}

export function serializeDropOffLocations(
  locations: readonly DropOffLocation[],
): string {
  const cleaned = locations.map((loc) => ({
    placeName: (loc.placeName ?? "").trim(),
    address: (loc.address ?? "").trim() || undefined,
    lat: loc.lat ?? null,
    lng: loc.lng ?? null,
    source: loc.source ?? "manual",
    skus: (loc.skus ?? [])
      .filter((s) => s.productId && Number(s.cases) > 0)
      .map((s) => ({
        productId: String(s.productId),
        productName: s.productName,
        cases: Math.round(Number(s.cases)),
      })),
  }));
  return JSON.stringify(cleaned);
}

export function locationHasPin(loc: DropOffLocation): boolean {
  const hasCoords =
    loc.lat != null &&
    loc.lng != null &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng);
  const hasAddress = Boolean((loc.address ?? "").trim());
  return hasCoords || hasAddress;
}

export function locationIsComplete(loc: DropOffLocation): boolean {
  if (!(loc.placeName ?? "").trim()) return false;
  if (!locationHasPin(loc)) return false;
  return (loc.skus ?? []).some((s) => s.productId && Number(s.cases) > 0);
}

/**
 * Validate a required Drop-off Locations value. Returns an error message or
 * null when OK.
 */
export function validateDropOffLocationsValue(
  value: string | null | undefined,
): string | null {
  const locs = parseDropOffLocations(value);
  if (locs.length === 0) {
    return "Add at least one drop-off location.";
  }
  for (let i = 0; i < locs.length; i++) {
    const loc = locs[i]!;
    const n = i + 1;
    if (!(loc.placeName ?? "").trim()) {
      return `Drop-off #${n}: enter the account / place name.`;
    }
    if (!locationHasPin(loc)) {
      return `Drop-off #${n}: pull GPS or type an address.`;
    }
    if (!(loc.skus ?? []).some((s) => s.productId && Number(s.cases) > 0)) {
      return `Drop-off #${n}: add at least one SKU with cases.`;
    }
  }
  return null;
}

/** Sum cases across locations by productId for CustomRecapProductSample. */
export function productSamplesFromDropOffs(
  locations: readonly DropOffLocation[],
): { productId: string; quantity: number }[] {
  const totals = new Map<string, number>();
  for (const loc of locations) {
    for (const sku of loc.skus ?? []) {
      const id = String(sku.productId ?? "").trim();
      const n = Number(sku.cases);
      if (!id || !Number.isFinite(n) || n <= 0) continue;
      totals.set(id, (totals.get(id) ?? 0) + Math.round(n));
    }
  }
  return [...totals.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export function totalCasesFromDropOffs(
  locations: readonly DropOffLocation[],
): number {
  return productSamplesFromDropOffs(locations).reduce(
    (sum, row) => sum + row.quantity,
    0,
  );
}

/** Short read-mode summary lines for ops / share surfaces. */
export function formatDropOffLocationsSummary(
  value: string | null | undefined,
): string[] {
  const locs = parseDropOffLocations(value);
  if (locs.length === 0) return [];
  return locs.map((loc, i) => {
    const name = (loc.placeName || loc.address || `Location ${i + 1}`).trim();
    const cases = (loc.skus ?? []).reduce(
      (s, row) => s + (Number(row.cases) > 0 ? Math.round(Number(row.cases)) : 0),
      0,
    );
    const skuBits = (loc.skus ?? [])
      .filter((s) => Number(s.cases) > 0)
      .map(
        (s) =>
          `${s.productName || s.productId} × ${Math.round(Number(s.cases))}`,
      );
    const pin =
      loc.lat != null && loc.lng != null
        ? `${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)}`
        : (loc.address ?? "").trim();
    const parts = [
      name,
      pin && pin !== name ? pin : null,
      cases > 0 ? `${cases} case${cases === 1 ? "" : "s"}` : null,
      skuBits.length ? skuBits.join(", ") : null,
    ].filter(Boolean);
    return parts.join(" · ");
  });
}
