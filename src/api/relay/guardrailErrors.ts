/**
 * The server's anti-scraping guardrails, read on the way back.
 *
 * spark-api answers a request it will not serve with HTTP 200, `data: null`
 * and one error carrying `extensions.code`:
 *
 *   RATE_LIMITED       too many requests from this person (`retryAfter` s)
 *   QUERY_TOO_COMPLEX  a query that is too deep / too wide / batched
 *   EXPORT_LIMIT       too many exports this hour
 *   BULK_LIMIT         too many items in one change
 *   LOGIN_THROTTLED    too many sign-in attempts
 *
 * None of these is a bug on the page, so they become one friendly toast
 * (not a stack of them when a screen fires ten queries at once) and an
 * error whose message is the server's own sentence, so every `onError`
 * that shows `err.message` shows something a person can read.
 *
 * Pure module: no store imports, so the alert store and the network layer
 * can both use it without a cycle.
 */

export const GUARDRAIL_CODES = [
  "RATE_LIMITED",
  "QUERY_TOO_COMPLEX",
  "EXPORT_LIMIT",
  "BULK_LIMIT",
  "LOGIN_THROTTLED",
] as const;

export type GuardrailCode = (typeof GUARDRAIL_CODES)[number];

/** What to say when the server sent the code without a usable message. */
export const GUARDRAIL_FALLBACK: Record<GuardrailCode, string> = {
  RATE_LIMITED: "Too many requests — slow down and try again in a minute.",
  QUERY_TOO_COMPLEX:
    "That request was too large for Spark to run. Narrow it down and try again.",
  EXPORT_LIMIT: "Export limit reached. Try again later.",
  BULK_LIMIT: "Too many items in one request. Select fewer and try again.",
  LOGIN_THROTTLED:
    "Too many sign-in attempts. Please wait a few minutes and try again.",
};

export interface GuardrailHit {
  code: GuardrailCode;
  message: string;
  /** Seconds the server asked us to wait, when it said. */
  retryAfter: number | null;
}

const isGuardrailCode = (v: unknown): v is GuardrailCode =>
  typeof v === "string" && (GUARDRAIL_CODES as readonly string[]).includes(v);

/** The first guardrail error in a GraphQL `errors` array, or null. */
export function findGuardrailError(errors: unknown): GuardrailHit | null {
  if (!Array.isArray(errors)) return null;
  for (const raw of errors) {
    if (!raw || typeof raw !== "object") continue;
    const err = raw as { message?: unknown; extensions?: unknown };
    const ext =
      err.extensions && typeof err.extensions === "object"
        ? (err.extensions as { code?: unknown; retryAfter?: unknown })
        : null;
    const code = ext?.code;
    if (!isGuardrailCode(code)) continue;
    const said = typeof err.message === "string" ? err.message.trim() : "";
    const retry = Number(ext?.retryAfter);
    return {
      code,
      message: said || GUARDRAIL_FALLBACK[code],
      retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null,
    };
  }
  return null;
}

/** A guardrail refusal, raised so Relay's `onError` gets the plain message. */
export class GuardrailError extends Error {
  readonly code: GuardrailCode;
  readonly retryAfter: number | null;
  readonly isGuardrail = true;

  constructor(hit: GuardrailHit) {
    super(hit.message);
    this.name = "GuardrailError";
    this.code = hit.code;
    this.retryAfter = hit.retryAfter;
  }
}

export function isGuardrailError(error: unknown): error is GuardrailError {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { isGuardrail?: unknown }).isGuardrail === true,
  );
}

/**
 * A plain HTTP 429 (a proxy in front of the API, or a future server change)
 * reads the same as the GraphQL-level refusal.
 */
export function guardrailFromStatus(
  status: number,
  retryAfterHeader: string | null,
): GuardrailHit | null {
  if (status !== 429) return null;
  const retry = Number(retryAfterHeader);
  return {
    code: "RATE_LIMITED",
    message: GUARDRAIL_FALLBACK.RATE_LIMITED,
    retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null,
  };
}

/**
 * One message for a failed GraphQL response: the guardrail sentence when
 * there is one, otherwise every message joined (what the auth pages showed
 * before).
 */
export function graphQLErrorMessage(errors: unknown, fallback: string): string {
  const hit = findGuardrailError(errors);
  if (hit) return hit.message;
  if (!Array.isArray(errors)) return fallback;
  const joined = errors
    .map((e) =>
      e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string"
        ? ((e as { message: string }).message).trim()
        : "",
    )
    .filter(Boolean)
    .join("; ");
  return joined || fallback;
}

/** How long one guardrail toast stands for the next identical one. */
export const GUARDRAIL_TOAST_WINDOW_MS = 10_000;

/**
 * Decides which guardrail toasts to show. A screen that fires ten queries
 * into a rate limit gets one toast, not ten; and a caller's own
 * `showAlert("Save failed: " + err.message)` right after is recognised as
 * the same news and dropped.
 */
export function createGuardrailNotifier(
  windowMs: number = GUARDRAIL_TOAST_WINDOW_MS,
  now: () => number = Date.now,
) {
  const shownAt = new Map<string, number>();
  const fresh = (at: number | undefined, t: number) =>
    at !== undefined && t - at < windowMs;

  return {
    /** True when this hit should be shown now (and records that it was). */
    shouldShow(hit: Pick<GuardrailHit, "code" | "message">): boolean {
      const t = now();
      if (fresh(shownAt.get(hit.code), t)) return false;
      shownAt.set(hit.code, t);
      shownAt.set(`msg:${hit.message}`, t);
      return true;
    },
    /** True when `message` repeats a guardrail toast that is still up. */
    isEcho(message: string): boolean {
      const t = now();
      for (const [key, at] of shownAt) {
        if (!key.startsWith("msg:") || !fresh(at, t)) continue;
        if (message.includes(key.slice(4))) return true;
      }
      return false;
    },
  };
}
