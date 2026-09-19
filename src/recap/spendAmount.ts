/**
 * Walk-up (and ops) dollar spend fields.
 *
 * BAs type 2489 meaning $24.89. A silent cents conversion would also turn a
 * real $2,489 into $24.89, so a whole number with no period is rejected.
 * 24.89, 24.8, and 2489.00 are dollars and are stored as a numeric string
 * (no "$"). Existing saved values are not rewritten here.
 */

export const SPEND_CENTS_MESSAGE =
  "Enter dollars and cents, like 24.89 (use 2489.00 if you really mean two thousand).";

const PHOTO_TYPE = /photo|image/;

function fieldName(name: string | null | undefined): string {
  return (name ?? "").trim();
}

function fieldType(typeName: string | null | undefined): string {
  return (typeName ?? "").trim().toLowerCase();
}

/**
 * True for typed dollar fields (Account Spend Amount, Spend Amount, a
 * number-type Product Spend, …). Photo buckets named Product Spend and
 * receipt upload fields are not dollar inputs.
 */
export function isSpendAmountField(field: {
  name?: string | null;
  type?: string | null;
}): boolean {
  const name = fieldName(field.name);
  const type = fieldType(field.type);
  if (!name || PHOTO_TYPE.test(type)) return false;
  if (name.includes("?")) return false;
  if (/\breceipts?\b/i.test(name) && !/\bamount\b/i.test(name)) return false;
  if (/\bused\b/i.test(name) && !/\bamount\b/i.test(name)) return false;

  if (/product\s*spend/i.test(name)) return true;

  return /account\s*spend|spend\s*amount|amount\s*spent|total\s*spend|corporate\s*card\s*spend/i.test(
    name,
  );
}

/** Digits and at most one decimal point. Strips $ , and spaces. */
export function sanitizeSpendAmountInput(raw: string): string {
  const stripped = String(raw ?? "").replace(/[$,\s]/g, "");
  let out = "";
  let seenDot = false;
  for (const ch of stripped) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "." && !seenDot) {
      seenDot = true;
      out += ch;
    }
  }
  return out;
}

function parsedDollars(cleaned: string): number | null {
  if (!cleaned || cleaned === ".") return null;
  if (!/^\d*\.\d*$/.test(cleaned) || !cleaned.includes(".")) return null;
  if (cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Null when blank or a valid dollar amount. The cents message when a
 * non-blank value has no period (2489) or isn't a dollar figure.
 */
export function spendAmountError(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || trimmed === "$") return null;
  const cleaned = sanitizeSpendAmountInput(trimmed);
  if (!cleaned || cleaned === ".") return SPEND_CENTS_MESSAGE;
  if (!cleaned.includes(".")) return SPEND_CENTS_MESSAGE;
  if (parsedDollars(cleaned) == null) return SPEND_CENTS_MESSAGE;
  return null;
}

/**
 * Canonical dollar string ("24.80", "2489.00") or null when blank.
 * Null when the value is not a valid dollar amount — callers must not
 * use that to wipe a legacy whole-number already stored on a recap.
 */
export function spendAmountStored(
  raw: string | null | undefined,
): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || trimmed === "$") return null;
  if (spendAmountError(trimmed)) return null;
  const n = parsedDollars(sanitizeSpendAmountInput(trimmed));
  if (n == null) return null;
  return n.toFixed(2);
}

/**
 * Ops edits of an already-saved whole number (2489) must still save the
 * rest of the recap. A changed value, or any new walk-up submit, is checked.
 */
export function spendAmountSubmitError(
  raw: string | null | undefined,
  original?: string | null,
): string | null {
  if (original != null) {
    const next = sanitizeSpendAmountInput(String(raw ?? ""));
    const prev = sanitizeSpendAmountInput(String(original));
    if (next === prev) return null;
  }
  return spendAmountError(raw);
}
