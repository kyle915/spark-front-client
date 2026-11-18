import { validateDropOffLocationsValue, isDropOffLocationsField } from "@/recap/dropOffLocations";
import { isSpendAmountField, spendAmountError, spendAmountStored } from "@/recap/spendAmount";
import { isFieldShown, type ShowWhen } from "./fieldConditions";
import { isExpenseReceiptBucket } from "./photoBuckets";

/**
 * Pre-submit completeness for the walk-up recap.
 *
 * This mirrors the checks `submit` already makes — it invents no new
 * required rules. Photo buckets stay advisory (their `min` is a suggestion,
 * never a gate), so an empty bucket is listed as something to check, not
 * as a reason Submit will refuse. The one hard photo rule besides "at
 * least one photo": a spend figure with no receipt photo in the tenant's
 * Product Spend / Receipts bucket. Submit and the API both refuse that
 * (see `spendNeedingReceipt`).
 */

export type CompletenessField = {
  id: string;
  name: string;
  required: boolean;
  type: string;
  showWhen?: ShowWhen | null;
};

export type CompletenessBucket = { id: string; name: string; min: number };

export type CompletenessPhoto = {
  category: string | null;
  state: "uploading" | "done" | "failed";
};

export type CompletenessItemKind =
  | "required-field"
  | "spend-format"
  | "store"
  | "corpo-card"
  | "photos"
  | "photo-bucket"
  | "receipt-photo";

export type CompletenessItem = {
  id: string;
  kind: CompletenessItemKind;
  label: string;
  /** Value of the `data-completeness-target` attribute to scroll/focus to. */
  target: string;
};

export type CompletenessInput = {
  fields: CompletenessField[];
  values: Record<string, string | string[] | undefined>;
  buckets: CompletenessBucket[];
  photos: CompletenessPhoto[];
  hasPhotoField: boolean;
  usedCorpoCard: boolean | null;
  storeIdentity: boolean;
  store: { name: string; number: string; noNumber: boolean };
};

const isPhotoType = (t: string) => t.includes("photo") || t.includes("image");

function isEmpty(v: string | string[] | undefined): boolean {
  return v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
}

/** The sentence a BA sees when spend is entered with no receipt photo.
 *  Kept word for word with the API's refusal (recaps/receipt_gate.py), so
 *  whichever layer catches it, the BA reads one message. */
export function receiptRequiredMessage(amount: number): string {
  const dollars = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return "Add a photo of your receipt — you entered $" + dollars + " in product spend.";
}

/**
 * Product spend the BA typed (shown spend fields only; hidden ones are never
 * sent) and the receipt bucket it must be backed by. Null when there is no
 * spend, or the page offers no receipt bucket to put a photo in — the API
 * skips the rule then too, so the BA is never asked for the impossible.
 */
export function spendNeedingReceipt(
  fields: CompletenessField[],
  values: CompletenessInput["values"],
  buckets: CompletenessBucket[],
): { bucket: CompletenessBucket; amount: number; message: string } | null {
  const bucket = buckets.find((b) => isExpenseReceiptBucket(b.name));
  if (!bucket) return null;
  let total = 0;
  for (const f of fields) {
    if (isPhotoType(f.type) || !isSpendAmountField(f) || !isFieldShown(f, values)) continue;
    const raw = values[f.id];
    const stored = spendAmountStored(Array.isArray(raw) ? "" : String(raw ?? ""));
    const n = stored == null ? 0 : Number(stored);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  if (total <= 0) return null;
  const amount = Math.round(total * 100) / 100;
  return { bucket, amount, message: receiptRequiredMessage(amount) };
}

/**
 * Why Submit must wait for the receipt, or null when it can go. Online, the
 * receipt has to have LANDED: the leave-behind path files only finished
 * uploads, and the API would refuse the recap without it. Offline, a
 * receipt that failed for lack of signal is queued with the recap and sent
 * before it, so it counts.
 */
export function receiptSubmitBlock(
  need: { bucket: CompletenessBucket; message: string } | null,
  photos: { category: string | null; state: CompletenessPhoto["state"]; unrecoverable?: boolean }[],
  offline: boolean,
): string | null {
  if (!need) return null;
  const inBucket = photos.filter((p) => p.category === need.bucket.id && !p.unrecoverable);
  if (inBucket.some((p) => p.state === "done")) return null;
  if (offline && inBucket.some((p) => p.state === "failed")) return null;
  if (inBucket.some((p) => p.state === "uploading")) {
    return "Your receipt photo is still uploading — one moment.";
  }
  if (inBucket.some((p) => p.state === "failed")) {
    return "Your receipt photo didn't upload. Tap Retry, or check your signal.";
  }
  return need.message;
}

export function buildCompletenessItems(input: CompletenessInput): CompletenessItem[] {
  const items: CompletenessItem[] = [];
  const { fields, values, buckets, photos } = input;

  if (input.storeIdentity) {
    if (!input.store.name.trim()) {
      items.push({ id: "store-name", kind: "store", label: "Enter the store name", target: "store" });
    } else if (!input.store.noNumber && !input.store.number.trim()) {
      items.push({
        id: "store-number",
        kind: "store",
        label: "Enter the store number, or tick “No store number”",
        target: "store",
      });
    }
  }

  for (const f of fields) {
    if (isPhotoType(f.type) || !isFieldShown(f, values)) continue;
    const v = values[f.id];
    if (f.required) {
      if (isDropOffLocationsField(f)) {
        const err = validateDropOffLocationsValue(Array.isArray(v) ? JSON.stringify(v) : String(v ?? ""));
        if (err) {
          items.push({ id: `field:${f.id}`, kind: "required-field", label: `${f.name}: ${err}`, target: f.id });
          continue;
        }
      } else if (isEmpty(v)) {
        items.push({
          id: `field:${f.id}`,
          kind: "required-field",
          label: `Fill in “${f.name}”`,
          target: f.id,
        });
        continue;
      }
    }
    if (!isEmpty(v) && isSpendAmountField(f)) {
      const raw = Array.isArray(v) ? "" : String(v ?? "");
      const err = spendAmountError(raw);
      if (err) {
        items.push({ id: `spend:${f.id}`, kind: "spend-format", label: `${f.name}: ${err}`, target: f.id });
      }
    }
  }

  if (input.usedCorpoCard == null) {
    items.push({
      id: "corpo-card",
      kind: "corpo-card",
      label: "Say whether a corporate card was used",
      target: "corpo-card",
    });
  }

  const donePhotos = photos.filter((p) => p.state === "done");
  if (buckets.length > 0) {
    for (const b of buckets) {
      const inBucket = photos.filter((p) => p.category === b.id);
      const done = inBucket.filter((p) => p.state === "done").length;
      if (b.min > 0 && done === 0 && inBucket.length === 0) {
        items.push({
          id: `bucket:${b.id}`,
          kind: "photo-bucket",
          label: `${b.name}: no photos yet (${b.min} suggested)`,
          target: `bucket:${b.id}`,
        });
      }
    }
    const receiptNeed = spendNeedingReceipt(fields, values, buckets);
    if (receiptNeed) {
      const hasReceipt = photos.some(
        (p) => p.category === receiptNeed.bucket.id && p.state !== "failed",
      );
      if (!hasReceipt) {
        items.push({
          id: `receipt:${receiptNeed.bucket.id}`,
          kind: "receipt-photo",
          label: receiptNeed.message,
          target: `bucket:${receiptNeed.bucket.id}`,
        });
      }
    }
    if (donePhotos.length === 0 && photos.length === 0) {
      items.push({
        id: "photos-any",
        kind: "photos",
        label: "Add at least one photo of your event",
        target: `bucket:${buckets[0].id}`,
      });
    }
  } else if (donePhotos.length === 0) {
    // No labelled buckets: Submit requires at least one landed photo
    // (failed uploads alone never block when the BA is offline).
    items.push({
      id: "photos-any",
      kind: "photos",
      label: "Add at least one photo of your event",
      target: "photos",
    });
  }

  return items;
}

/** Scroll to the field/bucket a checklist item points at and focus it. */
export function scrollToCompletenessTarget(target: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector<HTMLElement>(
    `[data-completeness-target="${target.replace(/"/g, "")}"]`,
  );
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = el.matches("input, select, textarea, button")
    ? el
    : el.querySelector<HTMLElement>("input, select, textarea, button");
  focusable?.focus({ preventScroll: true });
  return true;
}
