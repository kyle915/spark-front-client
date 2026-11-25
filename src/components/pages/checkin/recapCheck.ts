/**
 * A check of the recap answers, asked for when the ambassador taps Submit.
 *
 * The server returns a short list of things to fix or confirm ("You sampled
 * 40 people but sold 55 cans. Is that right?"). It is advice only. Every
 * failure here — offline, a slow connection, a refused or malformed reply —
 * resolves to an empty list, and an empty list means the recap goes straight
 * in, exactly as it did before this existed.
 */
import { withTimeout, type FetchLike } from "./timedFetch";

export type RecapCheckSeverity = "warning" | "error";

export type RecapCheckItem = {
  code: string;
  message: string;
  /** The field to jump to, when the note is about one. */
  fieldId: string | null;
  /** Every field the note is about (the jump target first). */
  fieldIds: string[];
  /** "error": two answers that cannot both be right. Never a block. */
  severity: RecapCheckSeverity;
};

/** The receipts' brand total the page already read, sent with the answers. */
export type RecapCheckReceiptSpend = { total: string };

/** What the ambassador did with the notes, sent with the recap. */
export type RecapCheckAnswers = {
  /** Codes the ambassador marked "This is correct". */
  checkConfirmed: string[];
  /** Codes that were on screen when they submitted. */
  checkShown: string[];
  receiptSpend?: RecapCheckReceiptSpend;
};

/** One key per note: the same code with new numbers is a new question. */
export function recapCheckKey(item: Pick<RecapCheckItem, "code" | "message">): string {
  return `${item.code}|${item.message}`;
}

/**
 * The confirmations to send with the recap: only for notes still showing,
 * so a note the ambassador fixed (and that went away) is not sent.
 */
export function recapCheckAnswers(
  items: readonly RecapCheckItem[],
  confirmedKeys: ReadonlySet<string>,
  receiptSpend?: RecapCheckReceiptSpend | null,
): RecapCheckAnswers {
  return {
    checkConfirmed: items
      .filter((item) => confirmedKeys.has(recapCheckKey(item)))
      .map((item) => item.code),
    checkShown: items.map((item) => item.code),
    ...(receiptSpend ? { receiptSpend } : {}),
  };
}

/** Notes about one field, for the line shown under it. */
export function recapCheckItemsForField(
  items: readonly RecapCheckItem[],
  fieldId: string,
): RecapCheckItem[] {
  return items.filter((item) => item.fieldIds.includes(fieldId));
}

/**
 * The most a tap on Submit ever waits for the check. The server drops its
 * own slow step before this, so this is the real ceiling.
 */
export const RECAP_CHECK_TIMEOUT_MS = 5_000;
/** Checks per open form. After this the answers are submitted unchecked. */
export const RECAP_CHECK_MAX_RUNS = 3;
const MAX_ITEMS = 6;

type FieldValue = { customFieldId: string; value: string };

/**
 * Identifies one set of answers. The same answers are never checked twice,
 * which is what makes a second tap on Submit go through.
 */
export function answersSignature(
  fieldValues: FieldValue[],
  totalEngagements: number | null,
  photoCount: number,
): string {
  const rows = fieldValues
    .map((fv) => [fv.customFieldId, fv.value] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify([rows, totalEngagements, photoCount > 0]);
}

export function parseRecapCheckItems(json: unknown): RecapCheckItem[] {
  if (!json || typeof json !== "object") return [];
  const raw = (json as { items?: unknown }).items;
  if (!Array.isArray(raw)) return [];
  const items: RecapCheckItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { code, message, fieldId, fieldIds, severity } = entry as Record<
      string,
      unknown
    >;
    if (typeof message !== "string" || !message.trim()) continue;
    const jump = typeof fieldId === "string" && fieldId ? fieldId : null;
    const ids = Array.isArray(fieldIds)
      ? fieldIds.filter((id): id is string => typeof id === "string" && id !== "")
      : [];
    if (jump && !ids.includes(jump)) ids.unshift(jump);
    items.push({
      code: typeof code === "string" ? code : "",
      message: message.trim(),
      fieldId: jump ?? ids[0] ?? null,
      fieldIds: ids,
      severity: severity === "error" ? "error" : "warning",
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

export async function requestRecapCheck(args: {
  origin: string;
  code: string;
  session: string;
  fieldValues: FieldValue[];
  totalEngagements: number | null;
  photoCount: number;
  receiptSpend?: RecapCheckReceiptSpend | null;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<RecapCheckItem[]> {
  const doFetch = withTimeout(
    args.fetchImpl ?? ((input, init) => fetch(input, init)),
    args.timeoutMs ?? RECAP_CHECK_TIMEOUT_MS,
  );
  try {
    const res = await doFetch(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/recap-check`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: args.session,
          fieldValues: args.fieldValues,
          totalEngagements: args.totalEngagements,
          photoCount: args.photoCount,
          ...(args.receiptSpend ? { receiptSpend: args.receiptSpend } : {}),
        }),
      },
    );
    if (!res.ok) return [];
    return parseRecapCheckItems(await res.json());
  } catch {
    return [];
  }
}
