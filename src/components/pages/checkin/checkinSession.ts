/**
 * Standing walk-up session token hygiene.
 *
 * The page used to wipe ``spark.checkin.<code>`` whenever GET returned tenant
 * mode with no session. That raced with temporary navigation (Feel Free photo
 * release QR, training PDF tab, iOS discarding a backgrounded PWA): the API
 * sometimes answered with a bare tenant shell, localStorage died, and the BA
 * looked "not clocked in" while Attendance still had their punch.
 *
 * Only drop the bearer when the API names a dead token. Otherwise keep it and
 * let identify resume an open shift.
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
 * landing. Writing that landing into the cache was half of Michelle's bug:
 * refresh replaced "On the clock" with identify before the token wipe.
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
