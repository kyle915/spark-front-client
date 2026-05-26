/**
 * Venue-timezone helpers for the request edit + view flow.
 *
 * Why this exists
 * ---------------
 * The backend stores `start_time`/`end_time`/`date` in UTC and, after
 * the May 26 DST fix, returns them as **naive ISO strings in the
 * venue's local timezone** — e.g. "2026-05-30T14:00:00" for a
 * 2pm-Central activation. That convention works fine for display
 * IF the renderer treats the string literally. Passing it through
 * `new Date()` instead re-parses it as **browser-local**, which is
 * what produced the bug Kyle hit on REQ-MJY:
 *
 *   1. Original event: 2pm Central (DB: 19:00 UTC, naive: "...T14:00:00")
 *   2. Form's `toLocalTime` did `new Date("...T14:00:00").getHours()`
 *      → 14 (works by accident if browser is in PDT — both render same)
 *   3. User edits 14:00 → 12:00 (intending 12pm Central)
 *   4. Save does `new Date("...T12:00:00").toISOString()` in PDT
 *      → 19:00 UTC (wrong; this is 12pm PACIFIC, not 12pm Central)
 *   5. Backend stores 19:00 UTC, serializes back as 14:00 Central
 *   6. View shows 2pm. User typed 12pm. Off by +2h (PDT-CDT gap).
 *
 * The fix is to make BOTH read and write paths venue-tz-aware:
 *  - `pickHourMinute` reads the naive string literally, no Date()
 *  - `fmtVenueTime` renders the literal HH:MM as 12-hour, no Date()
 *  - `venueLocalToUtcIso` converts a YYYY-MM-DD + HH:MM the user typed
 *    into UTC ISO, treating the input as local in the venue's IANA tz
 *
 * Browser timezone never enters the picture. Same wall-clock result
 * whether the admin is editing from NYC, LA, or Berlin.
 */

// Mirror of `_APP_TZ_TO_IANA` in spark-api utils/tz.py. Keep these
// dicts in sync — if you add a region one side, add it the other.
const APP_TZ_TO_IANA: Record<string, string> = {
  EASTERN: "America/New_York",
  CENTRAL: "America/Chicago",
  MOUNTAIN: "America/Denver",
  PACIFIC: "America/Los_Angeles",
  ALASKA: "America/Anchorage",
  "HAWAII-ALEUTIAN": "Pacific/Honolulu",
  "HAWAII–ALEUTIAN": "Pacific/Honolulu", // en-dash variant
  EST: "America/New_York",
  EDT: "America/New_York",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MST: "America/Denver",
  MDT: "America/Denver",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  AKST: "America/Anchorage",
  AKDT: "America/Anchorage",
  HST: "Pacific/Honolulu",
  HDT: "Pacific/Honolulu",
};

type TimeZoneLike = {
  name?: string | null;
  code?: string | null;
} | null | undefined;

/**
 * Resolve a backend TimeZone row to an IANA zone name.
 * Returns null if we can't map it — callers should fall back to
 * browser-local behavior in that case (current GraphQL responses
 * always include `timezone`, so the null path is defensive).
 */
export function ianaForVenueTz(tz: TimeZoneLike): string | null {
  if (!tz) return null;
  const code = (tz.code ?? "").trim().toUpperCase();
  if (code && APP_TZ_TO_IANA[code]) return APP_TZ_TO_IANA[code];
  const name = (tz.name ?? "").trim();
  const nameUpper = name.toUpperCase();
  if (nameUpper && APP_TZ_TO_IANA[nameUpper]) return APP_TZ_TO_IANA[nameUpper];
  // Last resort: try the raw name as an IANA zone (works for fixtures
  // like "America/Denver" stored on TimeZone.name directly).
  if (name) {
    try {
      // Test if Intl accepts it
      new Intl.DateTimeFormat("en-US", { timeZone: name });
      return name;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Pull HH:MM from a naive ISO string ("2026-05-30T14:00:00").
 * No Date() — the string IS already in venue-local time, so we want
 * the literal hour/minute. Returns "12:00" for unparseable input so
 * the form has a sane default.
 */
export function pickHourMinute(naive: string | null | undefined): string {
  if (!naive) return "12:00";
  const m = naive.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "12:00";
}

/**
 * Pull YYYY-MM-DD from a naive ISO string. Same rationale as above:
 * the date in a venue-local naive string is already the venue's
 * calendar day, so we read it literally.
 */
export function pickYmd(naive: string | null | undefined): string {
  if (!naive) return "";
  const m = naive.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

/**
 * Render a naive venue-local string as "h:mm AM/PM" without going
 * through Date(). Same input "2026-05-30T14:00:00" renders as
 * "2:00 PM" regardless of which timezone the browser is in.
 */
export function fmtVenueTime(naive: string | null | undefined): string {
  if (!naive) return "";
  const m = naive.match(/T(\d{2}):(\d{2})/);
  if (!m) return naive;
  const h = parseInt(m[1], 10);
  if (!Number.isFinite(h)) return naive;
  const meridiem = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m[2]} ${meridiem}`;
}

/**
 * Look up the UTC offset (minutes west of UTC) for an IANA zone at a
 * given instant. Uses `Intl.DateTimeFormat` with `shortOffset` to
 * parse the "GMT-5"/"GMT-4:30" piece. Falls back to the browser's
 * own offset on platforms where shortOffset isn't supported — rare in
 * practice (Chrome 95+, Safari 17+, Firefox 89+).
 */
function venueOffsetMinutes(at: Date, ianaTz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTz,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    const parts = dtf.formatToParts(at);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // Match "GMT-5", "GMT-5:30", "GMT+12", "GMT" (UTC).
    if (tzPart === "GMT") return 0;
    const m = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return at.getTimezoneOffset();
    // getTimezoneOffset returns positive for WEST of UTC. GMT-5 means
    // 5h west, so 300 minutes positive.
    const sign = m[1] === "+" ? -1 : 1;
    const hours = parseInt(m[2], 10);
    const mins = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (hours * 60 + mins);
  } catch {
    return at.getTimezoneOffset();
  }
}

/**
 * Convert a user-typed venue-local (date, time) into a UTC ISO string.
 *
 *   venueLocalToUtcIso("2026-05-30", "12:00", "America/Chicago")
 *     === "2026-05-30T17:00:00.000Z"   // 12pm CDT = 17:00 UTC
 *
 * The browser's own timezone doesn't matter — same return value
 * whether the admin is in PDT, EDT, or CET. When `ianaTz` is null we
 * fall back to browser-local interpretation, matching the legacy
 * behavior (better than refusing to save).
 */
export function venueLocalToUtcIso(
  dateYmd: string,
  timeHm: string,
  ianaTz: string | null,
): string {
  const browserLocal = new Date(`${dateYmd}T${timeHm}:00`);
  if (!ianaTz) return browserLocal.toISOString();
  const browserOffMin = browserLocal.getTimezoneOffset();
  const venueOffMin = venueOffsetMinutes(browserLocal, ianaTz);
  // browserLocal represents `timeHm` in browser tz. The same wall-clock
  // string in venue tz is shifted by (venueOff - browserOff) minutes.
  // Shift the timestamp accordingly and round-trip through Date so the
  // resulting ISO has the standard millisecond precision.
  const adjustedMs =
    browserLocal.getTime() + (venueOffMin - browserOffMin) * 60 * 1000;
  return new Date(adjustedMs).toISOString();
}
