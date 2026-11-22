/**
 * Pre-submit receipt OCR, itemized brand-spend proposal, and mismatch advisories
 * for walk-up check-in recap forms.
 *
 * Triggered automatically in the background when a photo lands in an
 * `isExpenseReceiptBucket()` dropzone. Advisory only: offline, slow, or
 * unconfigured OCR resolves cleanly without throwing or blocking submission.
 */
import { spendAmountStored } from "@/recap/spendAmount";
import { withTimeout, type FetchLike } from "./timedFetch";

export const RECEIPT_READ_TIMEOUT_MS = 12_000;
const MAX_UPLOAD_BYTES = 4_000_000;
const MONEY_VALUE = /^\d{1,6}\.\d{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ReceiptAdvisoryKind =
  | "store_mismatch"
  | "date_mismatch"
  | "duplicate_receipt";

export type ReceiptAdvisory = {
  kind: ReceiptAdvisoryKind;
  message: string;
};

export type ReceiptReadResult = {
  available: boolean;
  proposedSpend: string | null;
  receiptTotal: string | null;
  brandProductSubtotal: string | null;
  excludedNonBrandTotal: string | null;
  excludedNonBrandCount: number;
  merchant: string;
  storeNumber: string;
  receiptDate: string | null;
  dedupeKey: string;
  advisories: ReceiptAdvisory[];
  message: string;
};

export type CombinedReceiptProposal = {
  proposedSpend: string;
  excludedNonBrandTotal: string | null;
  excludedNonBrandCount: number;
  receiptCount: number;
  detail: string | null;
  signature: string;
};

const ADVISORY_KINDS: readonly ReceiptAdvisoryKind[] = [
  "store_mismatch",
  "date_mismatch",
  "duplicate_receipt",
];

function isAdvisoryKind(value: unknown): value is ReceiptAdvisoryKind {
  return (
    typeof value === "string" &&
    (ADVISORY_KINDS as readonly string[]).includes(value)
  );
}

export function advisoryKindTitle(kind: ReceiptAdvisoryKind): string {
  switch (kind) {
    case "store_mismatch":
      return "Check receipt store";
    case "date_mismatch":
      return "Check receipt date";
    case "duplicate_receipt":
      return "Already submitted receipt";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function unavailableReceiptRead(): ReceiptReadResult {
  return {
    available: false,
    proposedSpend: null,
    receiptTotal: null,
    brandProductSubtotal: null,
    excludedNonBrandTotal: null,
    excludedNonBrandCount: 0,
    merchant: "",
    storeNumber: "",
    receiptDate: null,
    dedupeKey: "",
    advisories: [],
    message: "",
  };
}

function cleanMoney(raw: unknown, { allowZero = false } = {}): string | null {
  if (typeof raw !== "string" || !MONEY_VALUE.test(raw)) return null;
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isFinite(cents) || cents < 0) return null;
  if (!allowZero && cents === 0) return null;
  return (cents / 100).toFixed(2);
}

function parseAdvisories(raw: unknown): ReceiptAdvisory[] {
  if (!Array.isArray(raw)) return [];
  const out: ReceiptAdvisory[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (!isAdvisoryKind(row.kind)) continue;
    const message = typeof row.message === "string" ? row.message.trim() : "";
    if (!message) continue;
    const key = `${row.kind}:${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: row.kind, message });
  }
  return out;
}

/**
 * Parse the server reply. Advisories (such as SHA-256 duplicate detection) are
 * kept even when `available` is false because OCR credentials are absent.
 */
export function parseReceiptRead(json: unknown): ReceiptReadResult {
  if (!json || typeof json !== "object") return unavailableReceiptRead();
  const body = json as Record<string, unknown>;
  const advisories = parseAdvisories(body.advisories);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (body.available !== true) {
    return {
      ...unavailableReceiptRead(),
      advisories,
      message,
    };
  }
  const excludedCountRaw = Number(body.excludedNonBrandCount);
  const excludedNonBrandCount =
    Number.isInteger(excludedCountRaw) && excludedCountRaw > 0
      ? excludedCountRaw
      : 0;
  const excludedNonBrandTotal =
    excludedNonBrandCount > 0 ? cleanMoney(body.excludedNonBrandTotal) : null;
  return {
    available: true,
    proposedSpend: cleanMoney(body.proposedSpend),
    receiptTotal: cleanMoney(body.receiptTotal),
    brandProductSubtotal: cleanMoney(body.brandProductSubtotal, { allowZero: true }),
    excludedNonBrandTotal,
    excludedNonBrandCount: excludedNonBrandTotal ? excludedNonBrandCount : 0,
    merchant: typeof body.merchant === "string" ? body.merchant.trim() : "",
    storeNumber: typeof body.storeNumber === "string" ? body.storeNumber.trim() : "",
    receiptDate:
      typeof body.receiptDate === "string" && ISO_DATE.test(body.receiptDate)
        ? body.receiptDate
        : null,
    dedupeKey: typeof body.dedupeKey === "string" ? body.dedupeKey.trim() : "",
    advisories,
    message,
  };
}

export function formatReceiptProposalDetail(args: {
  receiptCount: number;
  excludedNonBrandTotal: string | null;
  excludedNonBrandCount: number;
}): string | null {
  const parts: string[] = [];
  if (args.receiptCount > 1) {
    parts.push(`across ${args.receiptCount} receipts`);
  }
  if (args.excludedNonBrandCount > 0 && args.excludedNonBrandTotal) {
    const noun = args.excludedNonBrandCount === 1 ? "item" : "items";
    parts.push(`excludes $${args.excludedNonBrandTotal} non-brand ${noun}`);
  }
  return parts.length > 0 ? `(${parts.join(" · ")})` : null;
}

/**
 * Combine proposals across uploaded receipt photos on the current recap.
 * Two photos of the same receipt (matching `dedupeKey`) count once; distinct
 * receipts sum their proposed brand spend. Receipts flagged as already
 * submitted (`duplicate_receipt`) are excluded from the spend proposal while
 * their advisory banner still shows under the photo bucket.
 */
export function combineReceiptProposals(
  entries: readonly { photoId: string; result: ReceiptReadResult }[],
): CombinedReceiptProposal | null {
  const seenKeys = new Set<string>();
  let spendCents = 0;
  let excludedCents = 0;
  let excludedCount = 0;
  let receiptCount = 0;
  const sigParts: string[] = [];

  for (const { photoId, result } of entries) {
    if (!result.available || !result.proposedSpend) continue;
    if (result.advisories.some((adv) => adv.kind === "duplicate_receipt")) {
      continue;
    }
    const key = result.dedupeKey || `photo:${photoId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const cents = Math.round(Number(result.proposedSpend) * 100);
    if (!Number.isFinite(cents) || cents <= 0) continue;
    spendCents += cents;
    receiptCount += 1;
    sigParts.push(`${key}:${result.proposedSpend}`);
    if (result.excludedNonBrandCount > 0 && result.excludedNonBrandTotal) {
      const ex = Math.round(Number(result.excludedNonBrandTotal) * 100);
      if (Number.isFinite(ex) && ex > 0) {
        excludedCents += ex;
        excludedCount += result.excludedNonBrandCount;
      }
    }
  }

  if (receiptCount === 0 || spendCents <= 0) return null;
  const proposedSpend = (spendCents / 100).toFixed(2);
  const excludedNonBrandTotal =
    excludedCount > 0 && excludedCents > 0
      ? (excludedCents / 100).toFixed(2)
      : null;
  return {
    proposedSpend,
    excludedNonBrandTotal,
    excludedNonBrandCount: excludedNonBrandTotal ? excludedCount : 0,
    receiptCount,
    detail: formatReceiptProposalDetail({
      receiptCount,
      excludedNonBrandTotal,
      excludedNonBrandCount: excludedNonBrandTotal ? excludedCount : 0,
    }),
    signature: sigParts.join("|"),
  };
}

/**
 * Return the proposal to display beneath `SpendAmountInput`, hiding it when
 * the input already holds the proposed dollar amount or the BA tapped Ignore
 * on this exact proposal signature.
 */
export function shownReceiptProposal(args: {
  proposal: CombinedReceiptProposal | null;
  currentValue: string | string[] | undefined;
  dismissedSignature: string | null;
}): CombinedReceiptProposal | null {
  const { proposal, currentValue, dismissedSignature } = args;
  if (!proposal) return null;
  if (dismissedSignature && dismissedSignature === proposal.signature) {
    return null;
  }
  if (
    typeof currentValue === "string" &&
    spendAmountStored(currentValue) === proposal.proposedSpend
  ) {
    return null;
  }
  return proposal;
}

export type ShownReceiptAdvisory = ReceiptAdvisory & {
  key: string;
};

/**
 * Collect unique, non-dismissed pre-submit advisories across active receipt photos.
 */
export function collectReceiptAdvisories(
  results: readonly ReceiptReadResult[],
  dismissedKeys: ReadonlySet<string>,
): ShownReceiptAdvisory[] {
  const out: ShownReceiptAdvisory[] = [];
  const seen = new Set<string>();
  for (const res of results) {
    for (const adv of res.advisories) {
      const key = `${adv.kind}:${adv.message}`;
      if (seen.has(key) || dismissedKeys.has(key)) continue;
      seen.add(key);
      out.push({ ...adv, key });
    }
  }
  return out;
}

async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function requestReceiptRead(args: {
  origin: string;
  code: string;
  session: string;
  file: Blob;
  contentType: string;
  sha256?: string;
  storeName?: string;
  storeNumber?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<ReceiptReadResult> {
  if (
    !args.session ||
    !args.contentType.startsWith("image/") ||
    args.file.size === 0 ||
    args.file.size > MAX_UPLOAD_BYTES
  ) {
    return unavailableReceiptRead();
  }
  const doFetch = withTimeout(
    args.fetchImpl ?? ((input, init) => fetch(input, init)),
    args.timeoutMs ?? RECEIPT_READ_TIMEOUT_MS,
  );
  try {
    const imageBase64 = await toBase64(args.file);
    const payload: Record<string, string> = {
      session: args.session,
      imageBase64,
      contentType: args.contentType,
    };
    if (args.sha256) payload.sha256 = args.sha256;
    if (args.storeName?.trim()) payload.storeName = args.storeName.trim();
    if (args.storeNumber?.trim()) payload.storeNumber = args.storeNumber.trim();
    const res = await doFetch(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/receipt-read`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) return unavailableReceiptRead();
    return parseReceiptRead(await res.json());
  } catch {
    return unavailableReceiptRead();
  }
}
