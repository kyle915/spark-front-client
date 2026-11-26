/**
 * The counter chip on a labelled photo bucket on the check-in recap step.
 *
 * A bucket's `min` is a SUGGESTION. Nothing reads it but this chip — not the
 * page's `submit`, not the API's recap endpoint, not the brand's setup command,
 * which emits it as a BA-facing nudge and validates nothing. A BA whose store
 * refused customer photos, or who got five good ones instead of eight, has to
 * be able to file the recap and clock out.
 *
 * So the chip's job is to say "here's the number we'd like" without ever
 * looking like an unmet requirement. It previously rendered the short state as
 * bare "0 of 8" painted in the same orange this page uses for a required
 * field's asterisk, and that got reported as a hard requirement it never was.
 * Two things fix it, and the styling depends on only the second:
 *
 *  - the word "suggested", so the target is named as one in the text itself;
 *  - `met`, false until the target is reached, which the caller maps to muted
 *    (the same treatment as a bucket with no target — because that's what an
 *    unmet suggestion is, a plain count) and to green once it is reached.
 *
 * Encouragement on arrival, never a penalty before it. The state is carried by
 * the words as well as the colour, so it survives being read in greyscale.
 *
 * Returns null when there is nothing worth showing: no target and nothing
 * uploaded yet.
 */
export function bucketCountHint(
  done: number,
  min: number,
): { text: string; met: boolean } | null {
  if (min > 0) {
    return done >= min
      ? // Not "8 of 8" — a BA who uploaded 11 shouldn't be told "11 of 8".
        { text: `${done} ✓`, met: true }
      : { text: `${done} of ${min} suggested`, met: false };
  }
  // No target configured: a plain tally once there's something to tally, and
  // never the positive treatment — there's no target to have reached.
  return done > 0 ? { text: String(done), met: false } : null;
}

/**
 * Photo buckets that hold spend proof (receipts, expenses, Product Spend).
 * The Corporate Card Used question sits immediately above the first match.
 */
export function isExpenseReceiptBucket(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return false;
  return n.includes("receipt") || n.includes("expense") || n.includes("product spend");
}

/**
 * Shown under every receipt bucket. The reader reads one receipt per photo, so
 * two receipts in one shot means one of them is never counted.
 */
export const RECEIPT_PHOTO_TIP =
  "One receipt per photo. Add a separate photo for each receipt.";

/** Shelf / stock / cooler buckets that get aisle coaching. */
export function isShelfPhotoBucket(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n || isExpenseReceiptBucket(n)) return false;
  return (
    n.includes("shelf") ||
    n.includes("stock") ||
    n.includes("on-shelf") ||
    n.includes("cooler") ||
    n.includes("aisle") ||
    n.includes("endcap")
  );
}

export type PhotoCoachMode = "shelf" | "setup";

/** Table / booth / footprint / display buckets that get setup coaching. */
export function isSetupPhotoBucket(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n || isExpenseReceiptBucket(n) || n.includes("tally")) return false;
  if (isShelfPhotoBucket(n)) return false;
  return (
    n.includes("setup") ||
    n.includes("set up") ||
    n.includes("set-up") ||
    n.includes("footprint") ||
    n.includes("table") ||
    n.includes("booth") ||
    n.includes("display") ||
    n.includes("stand") ||
    n.includes("banner") ||
    n.includes("tablecloth") ||
    n.includes("activation")
  );
}

/** Resolve real-time vision coaching mode (`"shelf"` | `"setup"`) for a photo bucket. */
export function coachModeForBucket(
  name: string | null | undefined,
): PhotoCoachMode | null {
  if (isShelfPhotoBucket(name)) return "shelf";
  if (isSetupPhotoBucket(name)) return "setup";
  return null;
}
