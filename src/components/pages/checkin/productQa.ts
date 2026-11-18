/**
 * Product questions on the check-in page: a BA at the table asks "what's in
 * OG Luxe?" and gets a 1–3 sentence answer drawn only from the brand's own
 * notes, catalog, training, documents and website (spark-api
 * `product-question`), with where the answer came from. Nothing here
 * files or changes the shift.
 */
import type { ProductQaState } from "./checkinTypes";
import type { FetchLike } from "./timedFetch";

export const NO_NOTES_YET = "No product info for this brand yet — check with your lead.";
export const AI_UNAVAILABLE =
  "Product answers aren't available right now — check with your lead.";
export const NOT_IN_NOTES = "I don't have that — check with your lead.";
export const TOO_MANY = "That's a lot of questions this shift. Check with your lead.";
export const QUESTION_MAX = 300;

export type ProductAnswer = {
  answer: string;
  answered: boolean;
  source: string;
};

/** Which face the box shows before anything is asked. */
export type BoxMode = "hidden" | "no_notes" | "unavailable" | "ready";

export function productQaMode(
  state: ProductQaState | undefined | null,
  opts: { recapOnly?: boolean } = {},
): BoxMode {
  // Older API builds don't send the state; agency recap-only links have no shift.
  if (!state || opts.recapOnly) return "hidden";
  if (!state.hasMaterial) return "no_notes";
  if (!state.aiAvailable) return "unavailable";
  return "ready";
}

export async function askProductQuestion(args: {
  origin: string;
  code: string;
  session: string;
  question: string;
  fetchImpl: FetchLike;
}): Promise<ProductAnswer> {
  const fallback: ProductAnswer = { answer: AI_UNAVAILABLE, answered: false, source: "" };
  try {
    const res = await args.fetchImpl(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/product-question`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: args.session, question: args.question }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      if (res.status === 429) return { answer: TOO_MANY, answered: false, source: "" };
      const message = typeof json.message === "string" ? json.message : "";
      return message ? { answer: message, answered: false, source: "" } : fallback;
    }
    const answer = typeof json.answer === "string" ? json.answer.trim() : "";
    if (!answer) return fallback;
    const answered = json.answered === true;
    return {
      answer,
      answered,
      source: answered && typeof json.source === "string" ? json.source : "",
    };
  } catch {
    return fallback;
  }
}
