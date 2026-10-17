/**
 * Standing walk-up sessions live in localStorage keyed only by the code
 * (`spark.checkin.FF-…`, `LD-…`, `TH-…`, `BD-…`, …) and tenant tokens last
 * 90 days. Reopening any standing link on Wednesday can restore Saturday's
 * event. Clock in then punches that leftover day — the Alicia identify
 * date-gate never runs.
 *
 * ``isStaleWalkupSession`` / ``walkupDayKind`` detect that leftover
 * token+date case. Do NOT auto-wipe localStorage on date mismatch: that
 * fights mid-shift recovery. On a new calendar day the page leads with a
 * gate ("Clock in for Friday, Oct 16") and does not open the old recap.
 * Same-day open punches must survive temporary navigation (release QR /
 * PR #577) and keep "Continue your recap" / "Clocking in for a new shift?".
 *
 * Second shift (same calendar day, Feel Free market) is a different flow —
 * see ``secondShift.ts``. These must never look alike:
 *   leftover     = prior calendar day still restored
 *   second shift = already finished today's first filing, starting another
 *                  on the same day
 */

/** Shown on the primary button while clear-clock is in flight. */
export const LEFTOVER_PRIMARY_BUSY = "Starting…";

/** Same-day wrong-store / new-shift start-over (not leftover). */
export const START_OVER_LINK = "Clocking in for a new shift? Tap here";

/**
 * Clocked-out escape when the BA needs a different place/day — avoid
 * "Log another shift/event", which reads like a second punch on this day.
 */
export const CHECK_IN_SOMEWHERE_ELSE = "Check in somewhere else";

export const CLEAR_LEFTOVER_ERROR =
  "Couldn't start today's shift. Check your connection and try again.";

/** Civil YYYY-MM-DD from Event.date (noon-UTC ISO). Matches API event_calendar_date. */
export function eventCalendarDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

/** How a restored standing session relates to "today". */
export type WalkupDayKind = "leftover_prior_day" | "same_day" | "unknown";

export function walkupDayKind(
  eventDate: string | null | undefined,
  today: string,
): WalkupDayKind {
  const cal = eventCalendarDate(eventDate);
  if (!cal || !today) return "unknown";
  if (cal !== today) return "leftover_prior_day";
  return "same_day";
}

export function isLeftoverCheckinSession(
  eventDate: string | null | undefined,
  today: string,
): boolean {
  return walkupDayKind(eventDate, today) === "leftover_prior_day";
}

/**
 * "Friday, Oct 16" from a civil YYYY-MM-DD (or an Event.date ISO).
 * Noon UTC matches ``eventCalendarDate`` so the weekday cannot slip.
 */
export function walkupDayLabel(iso: string | null | undefined): string | null {
  const cal = eventCalendarDate(iso);
  if (!cal) return null;
  const d = new Date(`${cal}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Primary new-day gate. Example: "Clock in for Friday, Oct 16". */
export function clockInForTodayLabel(today: string): string {
  const day = walkupDayLabel(today);
  return day ? `Clock in for ${day}` : "Clock in for today";
}

/** Recap-only standing links have no punch. Same date, different verb. */
export function fileRecapForTodayLabel(today: string): string {
  const day = walkupDayLabel(today);
  return day ? `File a recap for ${day}` : "File a recap for today";
}

export function newDayPrimaryLabel(today: string, recapOnly?: boolean): string {
  return recapOnly ? fileRecapForTodayLabel(today) : clockInForTodayLabel(today);
}

/** "Thursday" from the saved shift's calendar date. */
export function priorShiftWeekday(eventDate: string | null | undefined): string | null {
  const cal = eventCalendarDate(eventDate);
  if (!cal) return null;
  const d = new Date(`${cal}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(d);
}

/** Secondary new-day gate. Example: "Finish Thursday's recap". */
export function finishPriorRecapLabel(eventDate: string | null | undefined): string {
  const day = priorShiftWeekday(eventDate);
  return day ? `Finish ${day}'s recap` : "Finish that recap";
}

/**
 * Whether the new-day gate offers "Finish Thursday's recap".
 *
 * Filed recaps (``hasRecap``) and empty clock-out stubs are not offered.
 * An empty stub is a clock-out with nothing filed and nothing started on
 * the device. A shift still on the clock, a recap-only session, or any
 * on-device draft / queued submit that never landed can still be filed.
 */
export function offerFinishPriorRecap(opts: {
  hasRecap: boolean;
  clockState?: string | null;
  recapOnly?: boolean;
  /** Draft answers, photos, or a queued submit that has not been filed. */
  hasUnsubmittedWork?: boolean;
}): boolean {
  if (opts.hasRecap) return false;
  if (opts.recapOnly) return true;
  if (opts.clockState === "clocked_in") return true;
  if (opts.hasUnsubmittedWork) return true;
  return false;
}

export const PAST_DAY_NO_CLOCK =
  "That day is over, so there's no clock to start. File its recap — your lead adds the hours.";

/** Matches API OPEN_SHIFT_RESUME_HOURS: a start this recent can still clock in. */
const OVERNIGHT_GRACE_MS = 18 * 60 * 60 * 1000;

function latestUsToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * True when Clock in would land on a day that already ended — the API refuses
 * it (409 past_day), so the page offers File recap instead. Weni (Torch, Oct
 * 2026) clocked in Saturday onto Thursday's event just to reach the recap.
 * "Today" is Hawaii's date, like the API, so no US market loses an evening.
 */
export function isPastDayWalkupSession(
  eventDate: string | null | undefined,
  startTime: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const cal = eventCalendarDate(eventDate);
  if (!cal || cal >= latestUsToday(now)) return false;
  const start = startTime ? Date.parse(startTime) : NaN;
  if (!Number.isNaN(start) && Math.abs(now.getTime() - start) <= OVERNIGHT_GRACE_MS) {
    return false;
  }
  return true;
}

/** True when a restored session token exists but the event date is not today. */
export function isStaleWalkupSession(
  hasSessionToken: boolean,
  mode: string | null | undefined,
  eventDate: string | null | undefined,
  today: string,
): boolean {
  return (
    Boolean(hasSessionToken) &&
    mode === "tenant" &&
    isLeftoverCheckinSession(eventDate, today)
  );
}
