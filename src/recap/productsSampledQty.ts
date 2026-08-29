/**
 * Bridge "Products Sampled" multiselect pills → CustomRecapProductSample rows.
 *
 * BA forms store selections as option strings like
 * `Sparkling Water — Mt. Death`. Spark's Product Samples grid is keyed by
 * Product catalog ids + quantity. These helpers match an option to a Product
 * (by `Category — Name` or SKU name) so the submit path can send
 * `productSamples: [{ productId, quantity }]`.
 *
 * Pill labels prefer the live Product catalog (`catalogSampleOptions`) so a
 * SKU added in /products appears without re-seeding CustomField.options.
 */

export type SampleProductRef = {
  id: string;
  name: string;
  /** ProductType name when known (e.g. "Sparkling Water"). */
  category?: string | null;
};

/** True when a custom field is the LD-style Products Sampled multiselect. */
export function isProductsSampledMultiselect(field: {
  name?: string | null;
  type?: string | null;
}): boolean {
  const name = (field.name ?? "").trim().toLowerCase();
  if (name !== "products sampled") return false;
  const t = (field.type ?? "").toLowerCase();
  return t === "multiselect" || t.includes("multi");
}

/**
 * Pill labels from the tenant Product catalog — same `Type — Name` shape the
 * API resolves for Products Sampled. Empty catalog → caller keeps field.options.
 */
export function catalogSampleOptions(
  products: readonly SampleProductRef[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const sorted = [...products].sort((a, b) => {
    const ca = (a.category ?? "").localeCompare(b.category ?? "");
    if (ca !== 0) return ca;
    return a.name.localeCompare(b.name);
  });
  for (const p of sorted) {
    const name = (p.name ?? "").trim();
    if (!name) continue;
    const cat = (p.category ?? "").trim();
    const label = cat ? `${cat} — ${name}` : name;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/**
 * SKU name from an option label. LD uses an em dash (`—`); also accept en
 * dash / spaced hyphen so hand-edited options still match.
 */
export function optionSkuName(option: string): string {
  const trimmed = option.trim();
  const parts = trimmed.split(/\s+[—–]\s+/);
  if (parts.length >= 2) return parts.slice(1).join(" — ").trim();
  const hyphen = trimmed.split(/\s+-\s+/);
  if (hyphen.length >= 2) return hyphen.slice(1).join(" - ").trim();
  return trimmed;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when `selected` already contains this pill (exact or same SKU name). */
export function sampleOptionSelected(
  option: string,
  selected: readonly string[],
): boolean {
  if (selected.includes(option)) return true;
  const sku = norm(optionSkuName(option));
  return selected.some((s) => {
    if (s === option) return true;
    return norm(optionSkuName(s)) === sku || norm(s) === sku;
  });
}

/**
 * Resolve a pill label to a Product catalog row. Prefers an exact
 * `Category — Name` match when the product carries a category; falls back to
 * a unique SKU-name match.
 */
export function matchProductForSampleOption(
  option: string,
  products: readonly SampleProductRef[],
): SampleProductRef | null {
  if (!option || products.length === 0) return null;
  const o = norm(option);
  const sku = norm(optionSkuName(option));

  for (const p of products) {
    const cat = (p.category ?? "").trim();
    if (!cat) continue;
    if (norm(`${cat} — ${p.name}`) === o) return p;
    if (norm(`${cat} - ${p.name}`) === o) return p;
  }

  const byName = products.filter((p) => norm(p.name) === sku);
  if (byName.length === 1) return byName[0] ?? null;
  if (byName.length > 1) {
    // Ambiguous bare names (e.g. "Sparkling Water" as both category + SKU):
    // prefer the option's category prefix when present.
    const prefix = option.split(/\s+[—–-]\s+/)[0]?.trim();
    if (prefix) {
      const pref = norm(prefix);
      const narrowed = byName.filter((p) => norm(p.category ?? "") === pref);
      if (narrowed.length === 1) return narrowed[0] ?? null;
    }
  }
  return null;
}

export type ProductSampleQty = { productId: string; quantity: number };

/**
 * Build the productSamples payload from selected pills + per-product qty
 * strings. Drops unmatched options, blanks, and non-positive quantities.
 */
export function productSamplesFromSelections(
  selectedOptions: readonly string[],
  quantitiesByProductId: Record<string, string>,
  products: readonly SampleProductRef[],
  parseQuantity: (raw: string) => number | null,
): ProductSampleQty[] {
  const out: ProductSampleQty[] = [];
  const seen = new Set<string>();
  for (const option of selectedOptions) {
    const product = matchProductForSampleOption(option, products);
    if (!product) continue;
    const id = String(product.id);
    if (seen.has(id)) continue;
    const n = parseQuantity(quantitiesByProductId[id] ?? "");
    if (n == null || !Number.isFinite(n) || n <= 0) continue;
    seen.add(id);
    out.push({ productId: id, quantity: Math.round(n) });
  }
  return out;
}
