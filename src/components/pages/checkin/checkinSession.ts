import { timedFetch, type FetchLike } from "./timedFetch";
/**
 * Standing walk-up session token hygiene — every tenant standing code
 * (`FF-`, `LD-`, `TH-`, `BD-`, …), not just Feel Free.
 *
 * The page used to wipe ``spark.checkin.<code>`` whenever GET returned tenant
 * mode with no session. That raced with temporary navigation (photo-release
 * QR, training PDF tab, iOS discarding a backgrounded PWA): the API sometimes
 * answered with a bare tenant shell, localStorage died, and the BA looked
 * "not clocked in" while Attendance still had their punch.
 *
 * Only drop the bearer when the API names a dead token. Otherwise keep it and
 * let identify resume an open shift via ``open_shift_event_for``.
 *
 * Local storage is per browser, so none of this survives the BA reopening the
 * link somewhere else (Torch, Annjolie, Oct 2026: "it shows the original clock
 * in page as if I never clocked in"). The phone lookup below is the
 * server-backed path that does.
 */

/** API ``sessionError`` values that mean this bearer can never restore. */
export const DEAD_SESSION_ERRORS = new Set([
  "expired",
  "bad_session",
  "mismatch",
  "not_found",
  "no_profile",
]);

export function shouldDropSessionToken(opts: {
  mode?: string | null;
  hasToken: boolean;
  hasSession: boolean;
  sessionError?: string | null;
}): boolean {
  if (!opts.hasToken || opts.hasSession) return false;
  if (opts.mode !== "tenant") return false;
  const err = (opts.sessionError || "").trim();
  // Old APIs omit sessionError — do NOT wipe. Prefer resume / cache.
  if (!err) return false;
  return DEAD_SESSION_ERRORS.has(err);
}

/**
 * Keep a same-day cached clocked-in shell when GET returns a bare tenant
 * landing. Writing that landing into the cache was half of the bug:
 * refresh replaced "On the clock" with identify before the token wipe.
 *
 * Leftover prior-day caches must NOT be kept — the new-day gate owns that
 * path so BAs clock in for today without opening yesterday's recap.
 */
export function shouldKeepCachedSession(opts: {
  incomingHasSession: boolean;
  cachedHasSession: boolean;
  cachedEventDate?: string | null;
  today: string;
  isLeftover: (eventDate: string | null | undefined, today: string) => boolean;
}): boolean {
  if (opts.incomingHasSession) return false;
  if (!opts.cachedHasSession) return false;
  if (opts.isLeftover(opts.cachedEventDate, opts.today)) return false;
  return true;
}

/** Ten digits is the shortest number the API can match to a walk-up stub. */
export function hasLookupPhone(phone: string | null | undefined): boolean {
  return (phone || "").replace(/\D/g, "").length >= 10;
}

/**
 * Silent "are you already on the clock?" check when the page opens with no
 * live session. Only a saved phone is needed: the lookup never mints a stub
 * or an event, so it no longer waits for local evidence of a punch (which a
 * different browser — texting app vs Safari, private tab — never has).
 */
export function canAttemptOpenPunchResume(opts: {
  mode?: string | null;
  recapOnly?: boolean;
  hasLiveSession: boolean;
  phone: string;
  /** The BA just tapped Start over / new shift on this page. */
  suppressed?: boolean;
}): boolean {
  if (opts.mode !== "tenant") return false;
  if (opts.recapOnly) return false;
  if (opts.hasLiveSession) return false;
  if (opts.suppressed) return false;
  return hasLookupPhone(opts.phone);
}

/** The shift a phone is clocked in on today (API ``openShift``). */
export type OpenShift = {
  eventDate: string | null;
  name: string;
  address: string;
  clockInAt: string | null;
};


/**
 * Phone lookup on a standing link: shifts still missing a recap, plus the
 * shift this phone is on the clock for today, if any. Never throws.
 */
export async function lookupShiftsByPhone<S = unknown>(opts: {
  origin: string;
  code: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  eventDate: string;
  fetchImpl?: FetchLike;
}): Promise<{ shifts: S[]; openShift: OpenShift | null }> {
  const doFetch = opts.fetchImpl ?? timedFetch;
  try {
    const res = await doFetch(
      `${opts.origin}/api/public/checkin/${encodeURIComponent(opts.code)}/unfiled-recaps`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: opts.firstName ?? "",
          lastName: opts.lastName ?? "",
          phone: opts.phone,
          eventDate: opts.eventDate,
        }),
      },
    );
    const json = (await res.json()) as {
      shifts?: S[];
      openShift?: OpenShift | null;
    };
    return {
      shifts: Array.isArray(json.shifts) ? json.shifts : [],
      openShift: json.openShift && typeof json.openShift === "object" ? json.openShift : null,
    };
  } catch {
    return { shifts: [], openShift: null };
  }
}

/**
 * "Continue my shift": get the session for the shift this phone is already
 * clocked in on. ``resumeOnly`` makes the API refuse (404) rather than start
 * a new check-in, so this can never fork a second shift. Null when there is
 * nothing to resume or the network failed.
 */
export async function resumeOpenShift<P extends { sessionToken?: string }>(opts: {
  origin: string;
  code: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  eventDate: string;
  fetchImpl?: FetchLike;
}): Promise<(P & { sessionToken: string }) | null> {
  const doFetch = opts.fetchImpl ?? timedFetch;
  try {
    const res = await doFetch(
      `${opts.origin}/api/public/checkin/${encodeURIComponent(opts.code)}/identify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeOnly: true,
          firstName: opts.firstName ?? "",
          lastName: opts.lastName ?? "",
          phone: opts.phone,
          email: opts.email ?? "",
          eventDate: opts.eventDate,
        }),
      },
    );
    const json = (await res.json()) as P;
    if (!res.ok || !json.sessionToken) return null;
    return json as P & { sessionToken: string };
  } catch {
    return null;
  }
}
