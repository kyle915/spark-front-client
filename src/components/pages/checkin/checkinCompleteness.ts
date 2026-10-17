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
 * as a reason Submit will refuse. A spend figure with no receipt photo in
 * the tenant's Product Spend / Receipts bucket is likewise listed here
 * while Submit itself still follows its existing photo rules.
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

function spendEntered(fields: CompletenessField[], values: CompletenessInput["values"]): boolean {
  for (const f of fields) {
    if (isPhotoType(f.type) || !isSpendAmountField(f)) continue;
    const raw = values[f.id];
    const stored = spendAmountStored(Array.isArray(raw) ? "" : String(raw ?? ""));
    if (stored != null && Number(stored) > 0) return true;
  }
  return false;
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
    const receiptBucket = buckets.find((b) => isExpenseReceiptBucket(b.name));
    if (receiptBucket && spendEntered(fields, values)) {
      const hasReceipt = photos.some(
        (p) => p.category === receiptBucket.id && p.state !== "failed",
      );
      if (!hasReceipt) {
        items.push({
          id: `receipt:${receiptBucket.id}`,
          kind: "receipt-photo",
          label: `Add a receipt photo to ${receiptBucket.name} for the spend you entered`,
          target: `bucket:${receiptBucket.id}`,
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
