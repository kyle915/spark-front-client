/**
 * Helpers for Evidences upload / "Move to…" category picks on RecapCustomView.
 *
 * The dropdowns used to hard-code only "Sampling photos" + "Receipts", which
 * left tenant buckets like Torch THC "Product Spend" visible (files already
 * filed there) but not targetable for upload or move. Options come from the
 * tenant's FileRecapCategory rows; values are category NAMES so they never
 * collide with a real PK the way positional "1"/"2" sentinels did.
 */

export type FileRecapCategoryOption = {
  id: string;
  name: string;
};

/** Stable fallbacks when the categories query is empty / still loading. */
export const FALLBACK_FILE_CATEGORY_PHOTOS = "Sampling photos";
export const FALLBACK_FILE_CATEGORY_RECEIPTS = "Receipts";

/**
 * Build the ordered list of section names for upload + move dropdowns.
 * Prefers the tenant's live categories; falls back to the classic two roles
 * so the controls still work if the query returns nothing.
 */
export function buildFileRecapCategoryOptions(
  categories: ReadonlyArray<FileRecapCategoryOption | null | undefined>,
): FileRecapCategoryOption[] {
  const seen = new Set<string>();
  const out: FileRecapCategoryOption[] = [];
  for (const cat of categories) {
    if (!cat?.name) continue;
    const key = cat.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: cat.id, name: cat.name });
  }
  if (out.length === 0) {
    return [
      { id: "fallback-photos", name: FALLBACK_FILE_CATEGORY_PHOTOS },
      { id: "fallback-receipts", name: FALLBACK_FILE_CATEGORY_RECEIPTS },
    ];
  }
  return out;
}

/**
 * RecapUploader's accept MIME: receipt-like buckets allow PDFs; photo
 * buckets stay image-only. "Product Spend" / "Receipts" / names containing
 * those keywords count as receipt.
 */
export function isReceiptLikeCategory(name: string | null | undefined): boolean {
  const n = (name ?? "").toLowerCase();
  if (!n) return false;
  return (
    n.includes("receipt") ||
    n.includes("spend") ||
    n.includes("purchase") ||
    n.includes("expense")
  );
}

/** Default upload section: Sampling photos when present, else first option. */
export function defaultUploadCategoryName(
  options: ReadonlyArray<FileRecapCategoryOption>,
): string {
  const photos = options.find(
    (o) => o.name.toLowerCase() === FALLBACK_FILE_CATEGORY_PHOTOS.toLowerCase(),
  );
  return photos?.name ?? options[0]?.name ?? FALLBACK_FILE_CATEGORY_PHOTOS;
}
