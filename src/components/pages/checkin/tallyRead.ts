/**
 * "Fill from photo": numbers read off a photo of a tally sheet, proposed for
 * the recap form's number boxes.
 *
 * The server reads the photo and returns a value per number field (and per
 * product, when the form has the per-product grid). These are proposals:
 * the form shows each one next to its box and the ambassador accepts it.
 * Nothing is filled or submitted from here. Every failure — offline, a slow
 * connection, a refused or malformed reply, an unreadable photo — resolves
 * to the same plain line, and the form carries on exactly as before.
 */
import { withTimeout, type FetchLike } from "./timedFetch";

export const TALLY_UNREADABLE = "Could not read that photo. Enter the numbers by hand.";
/** The longest a tap on "Fill from photo" waits for the server. */
export const TALLY_READ_TIMEOUT_MS = 8_000;
/** The photo is shrunk to this before it is sent. */
export const TALLY_PHOTO_PREP = { maxEdge: 1600, quality: 0.8 } as const;
const MAX_UPLOAD_BYTES = 2_800_000;

export type TallyProposals = {
  ok: boolean;
  /** field id → proposed value */
  fields: Record<string, string>;
  /** product id → proposed count */
  products: Record<string, string>;
  message: string;
};

const NUMBER_TYPE = /number|numeric|int|decimal|float/i;
const NUMBER_VALUE = /^\d{1,6}(\.\d{1,2})?$/;

/** True for template fields the server can propose a number for. */
export const isTallyNumberType = (type: string): boolean => NUMBER_TYPE.test(type || "");

export function unreadableTally(): TallyProposals {
  return { ok: false, fields: {}, products: {}, message: TALLY_UNREADABLE };
}

function pairs(raw: unknown, idKey: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(raw)) return out;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = row[idKey];
    const value = row.value;
    if (typeof id !== "string" || !id) continue;
    if (typeof value !== "string" || !NUMBER_VALUE.test(value)) continue;
    out[id] = value;
  }
  return out;
}

/** The server reply → proposals. Anything that is not a plain number is dropped. */
export function parseTallyRead(json: unknown): TallyProposals {
  if (!json || typeof json !== "object") return unreadableTally();
  const body = json as Record<string, unknown>;
  if (body.available !== true) return unreadableTally();
  const fields = pairs(body.values, "fieldId");
  const products = pairs(body.productSamples, "productId");
  if (Object.keys(fields).length === 0 && Object.keys(products).length === 0) {
    return unreadableTally();
  }
  return { ok: true, fields, products, message: "" };
}

/**
 * Keep only proposals the form can show: boxes on screen now, and not a
 * number the box already holds.
 */
export function shownProposals(
  proposals: Record<string, string>,
  shownIds: readonly string[],
  current: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of shownIds) {
    const value = proposals[id];
    if (value === undefined) continue;
    const held = current[id];
    if (typeof held === "string" && held.trim() === value) continue;
    out[id] = value;
  }
  return out;
}

/** "Found 4 numbers. Check each one next to its box." */
export function tallyFoundLine(count: number): string {
  return count === 1
    ? "Found 1 number. Check it next to its box."
    : `Found ${count} numbers. Check each one next to its box.`;
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

export async function requestTallyRead(args: {
  origin: string;
  code: string;
  session: string;
  /** Already shrunk (see TALLY_PHOTO_PREP). */
  file: Blob;
  contentType: string;
  includeProducts: boolean;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<TallyProposals> {
  if (!args.contentType.startsWith("image/") || args.file.size === 0) return unreadableTally();
  if (args.file.size > MAX_UPLOAD_BYTES) return unreadableTally();
  const doFetch = withTimeout(
    args.fetchImpl ?? ((input, init) => fetch(input, init)),
    args.timeoutMs ?? TALLY_READ_TIMEOUT_MS,
  );
  try {
    const imageBase64 = await toBase64(args.file);
    const res = await doFetch(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/tally-read`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: args.session,
          imageBase64,
          contentType: args.contentType,
          includeProducts: args.includeProducts,
        }),
      },
    );
    if (!res.ok) return unreadableTally();
    return parseTallyRead(await res.json());
  } catch {
    return unreadableTally();
  }
}
