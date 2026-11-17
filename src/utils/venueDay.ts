/**
 * Days and clock times at the venue, never the viewer's browser.
 *
 * Event `date` / `startTime` come from the API as the venue's wall clock with
 * no zone ("2026-11-16T19:00:00"). Putting them through `new Date()` reads
 * them in the viewer's zone, and the API's date filters work on the UTC day,
 * so a 7 PM shift out west could sit on the next day depending on who looked.
 *
 * "Today" is the ops day (Pacific), the same day the server uses for the live
 * board (`events.live_board._ops_today`).
 */

export const OPS_TZ = "America/Los_Angeles";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Calendar day of `at` in `timeZone`, as YYYY-MM-DD. */
export function ymdInZone(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today in the ops zone (Pacific), as YYYY-MM-DD. */
export function opsTodayIso(now: Date = new Date()): string {
  return ymdInZone(now, OPS_TZ);
}

/** YYYY-MM-DD plus `days` (negative to go back). Pure calendar arithmetic. */
export function addDaysIso(iso: string, days: number): string {
  const m = iso.match(ISO_DAY);
  if (!m) return iso;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return new Date(t).toISOString().slice(0, 10);
}

/** A local Date for a YYYY-MM-DD, at noon so no zone can move its day. For
 *  formatting the day's name only. */
export function dayToDate(iso: string): Date {
  const m = iso.match(ISO_DAY);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

/**
 * The venue's day for an event or request row: the server's `localDate` when
 * the row carries it, else the day part of its venue wall-clock start, else
 * of its date. Never converted through the browser.
 */
export function venueDayOf(row: {
  localDate?: string | null;
  startTime?: string | null;
  date?: string | null;
}): string | null {
  for (const raw of [row.localDate, row.startTime, row.date]) {
    const m = String(raw ?? "").match(ISO_DAY);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

/* ───────────── instants shown and typed at the venue ───────────── */

/** Milliseconds `timeZone` is ahead of UTC at `instant` (negative in the US). */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const isZone = (tz: string | null | undefined): tz is string => {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * An instant as a `datetime-local` value ("YYYY-MM-DDTHH:MM") on the venue's
 * clock. Without a usable zone, the browser's clock (the old behaviour).
 */
export function instantToZoneInput(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
): string {
  const d = iso ? new Date(iso) : new Date();
  const src = Number.isNaN(d.getTime()) ? new Date() : d;
  if (!isZone(timeZone)) {
    return `${src.getFullYear()}-${pad(src.getMonth() + 1)}-${pad(src.getDate())}T${pad(src.getHours())}:${pad(src.getMinutes())}`;
  }
  const local = new Date(src.getTime() + zoneOffsetMs(src.getTime(), timeZone));
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/**
 * A `datetime-local` value typed as the venue's clock, as a UTC ISO instant.
 * The inverse of `instantToZoneInput`, DST-correct on both sides of a change.
 * Null when the text is not a date and time.
 */
export function zoneInputToIso(
  local: string,
  timeZone: string | null | undefined,
): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  if (!isZone(timeZone)) {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // First guess with the offset at the wall time read as UTC, then once more
  // with the offset at that guess, which settles it across a DST change.
  let t = wall - zoneOffsetMs(wall, timeZone);
  const second = wall - zoneOffsetMs(t, timeZone);
  if (second !== t) t = second;
  return new Date(t).toISOString();
}

/** "3:05 PM" for an instant on the venue's clock (browser clock without one). */
export function fmtTimeInZone(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(isZone(timeZone) ? { timeZone } : {}),
  });
}

/** "ET", "PT", … for a zone, for a short label beside venue times. */
export function zoneShortName(timeZone: string | null | undefined, at: Date = new Date()): string {
  if (!isZone(timeZone)) return "";
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return part ?? "";
}
