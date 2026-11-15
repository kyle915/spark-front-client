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

export type RecapCheckItem = {
  code: string;
  message: string;
  /** The field to jump to, when the note is about one. */
  fieldId: string | null;
};

/** Long enough for the server's own limit, short enough for a shop aisle. */
export const RECAP_CHECK_TIMEOUT_MS = 8_000;
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
    const { code, message, fieldId } = entry as Record<string, unknown>;
    if (typeof message !== "string" || !message.trim()) continue;
    items.push({
      code: typeof code === "string" ? code : "",
      message: message.trim(),
      fieldId: typeof fieldId === "string" && fieldId ? fieldId : null,
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
        }),
      },
    );
    if (!res.ok) return [];
    return parseRecapCheckItems(await res.json());
  } catch {
    return [];
  }
}
