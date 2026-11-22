/**
 * Client-side `.ics` generator + Google / Apple Calendar deep-link builders
 * for booked `/jobs/:token` shifts.
 *
 * Field URLs embedded in calendar invites ALWAYS use `CLIENT_ORIGIN`
 * (`https://client.igniteproductions.co`) from `publicHosts.ts` — never
 * `window.location.origin` or stale `spark.` / `admin.` hosts, because a
 * calendar invite saved today will be tapped days later in the field.
 */

import { CLIENT_ORIGIN } from "@/utils/publicHosts";

export type BookedShiftCalendarData = {
  id?: string;
  title: string;
  brandLabel?: string;
  typeLabel?: string;
  venue: string;
  address?: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  dateLabel?: string;
  timeLabel?: string;
  brief?: string;
  checkinCode?: string;
  checkinUrl?: string;
  trainingUrl?: string;
  releaseToken?: string;
  releaseUrl?: string;
};

const DEFAULT_SHIFT_DURATION_MS = 4 * 60 * 60 * 1000;

/** Canonicalize a BA field link onto `CLIENT_ORIGIN` (`https://client.igniteproductions.co`). */
export function canonicalFieldUrl(rawUrl: string | undefined | null): string {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) {
    return `${CLIENT_ORIGIN}${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.hostname === "spark.igniteproductions.co" ||
      parsed.hostname === "admin.igniteproductions.co" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    ) {
      return `${CLIENT_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

/** Resolve canonical check-in URL on `CLIENT_ORIGIN` (`https://client.igniteproductions.co/checkin/<code>`). */
export function resolveShiftCheckinUrl(shift: BookedShiftCalendarData): string {
  if (shift.checkinUrl?.trim()) {
    return canonicalFieldUrl(shift.checkinUrl);
  }
  const code = (shift.checkinCode ?? "").trim();
  if (!code) return "";
  return `${CLIENT_ORIGIN}/checkin/${encodeURIComponent(code)}`;
}

/** Resolve canonical BA training / prep link on `CLIENT_ORIGIN` (or external CDN/Drive URL). */
export function resolveShiftTrainingUrl(shift: BookedShiftCalendarData): string {
  return canonicalFieldUrl(shift.trainingUrl);
}

function parseShiftWindow(shift: BookedShiftCalendarData): { start: Date; end: Date } {
  const startMs = Date.parse(shift.startsAt);
  const start = Number.isFinite(startMs) ? new Date(startMs) : new Date();
  const rawEndMs = shift.endsAt ? Date.parse(shift.endsAt) : Number.NaN;
  const end =
    Number.isFinite(rawEndMs) && rawEndMs > start.getTime()
      ? new Date(rawEndMs)
      : new Date(start.getTime() + DEFAULT_SHIFT_DURATION_MS);
  return { start, end };
}

/** Format `Date` as RFC 5545 / Google Calendar UTC timestamp (`YYYYMMDDTHHMMSSZ`). */
export function formatCalendarUtcTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

export function resolveShiftLocation(shift: BookedShiftCalendarData): string {
  const venue = (shift.venue ?? "").trim();
  const address = (shift.address ?? "").trim();
  if (venue && address) {
    return address.toLowerCase().includes(venue.toLowerCase()) ? address : `${venue}, ${address}`;
  }
  return address || venue;
}

export function buildShiftCalendarDescription(shift: BookedShiftCalendarData): string {
  const lines: string[] = [];
  const summaryParts = [shift.brandLabel, shift.typeLabel].filter(Boolean).join(" · ");
  if (summaryParts) {
    lines.push(summaryParts);
  }
  if (shift.venue?.trim()) {
    lines.push(`Venue: ${shift.venue.trim()}`);
  }
  if (shift.address?.trim()) {
    lines.push(`Address: ${shift.address.trim()}`);
  }
  if (shift.brief?.trim()) {
    lines.push("", `Shift notes: ${shift.brief.trim()}`);
  }

  const checkin = resolveShiftCheckinUrl(shift);
  const training = resolveShiftTrainingUrl(shift);
  const release = canonicalFieldUrl(shift.releaseUrl);

  if (checkin || training || release) {
    lines.push("");
    if (checkin) {
      lines.push(`Clock in & file recap: ${checkin}`);
    }
    if (training) {
      lines.push(`BA training & prep guide: ${training}`);
    }
    if (release) {
      lines.push(`Can't make this shift? ${release}`);
    }
  }
  return lines.join("\n");
}

/** Build a pre-populated Google Calendar `TEMPLATE` URL for a booked shift. */
export function buildGoogleCalendarUrl(shift: BookedShiftCalendarData): string {
  const { start, end } = parseShiftWindow(shift);
  const dates = `${formatCalendarUtcTimestamp(start)}/${formatCalendarUtcTimestamp(end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: shift.title || `${shift.brandLabel || "Ignite"} Shift — ${shift.venue}`,
    dates,
    location: resolveShiftLocation(shift),
    details: buildShiftCalendarDescription(shift),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold RFC 5545 content lines at <=75 UTF-8 octets using CRLF + single space. */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;

  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > limit && current.length > 0) {
      chunks.push(current);
      current = ` ${ch}`;
      currentBytes = 1 + chBytes;
      limit = 75;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks.join("\r\n");
}

function uidSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 64) || "shift";
}

/** Generate RFC 5545 `.ics` content for one or more booked shifts. */
export function buildShiftsIcs(
  shifts: ReadonlyArray<BookedShiftCalendarData>,
  now: Date = new Date(),
): string {
  const dtstamp = formatCalendarUtcTimestamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ignite Productions//Spark Field Shifts//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  shifts.forEach((shift, index) => {
    const { start, end } = parseShiftWindow(shift);
    const uidBase = shift.id || `${formatCalendarUtcTimestamp(start)}-${index + 1}-${shift.venue}`;
    const summary = shift.title || `${shift.brandLabel || "Ignite"} Shift — ${shift.venue}`;
    const location = resolveShiftLocation(shift);
    const description = buildShiftCalendarDescription(shift);
    const checkin = resolveShiftCheckinUrl(shift);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uidSlug(uidBase)}@client.igniteproductions.co`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${formatCalendarUtcTimestamp(start)}`);
    lines.push(`DTEND:${formatCalendarUtcTimestamp(end)}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (location) {
      lines.push(`LOCATION:${escapeIcsText(location)}`);
    }
    if (description) {
      lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    }
    if (checkin) {
      lines.push(`URL:${checkin}`);
    }
    lines.push("STATUS:CONFIRMED");
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT2H");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeIcsText(`Upcoming shift: ${summary}`)}`);
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/**
 * Data-URI `.ics` href so iOS Safari / macOS opens Apple Calendar's native
 * "Add to Calendar" sheet in a single tap without needing a server round-trip.
 */
export function buildAppleCalendarHref(shifts: ReadonlyArray<BookedShiftCalendarData>): string {
  const ics = buildShiftsIcs(shifts);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function suggestIcsFilename(shifts: ReadonlyArray<BookedShiftCalendarData>): string {
  if (shifts.length === 1) {
    const first = shifts[0];
    const slug = `${first.brandLabel || "ignite"}-${first.venue || "shift"}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return `${slug || "ignite-shift"}.ics`;
  }
  return `ignite-shifts-${shifts.length}.ics`;
}

/** Trigger an instant browser `.ics` file download for one or more shifts. */
export function downloadShiftsIcs(shifts: ReadonlyArray<BookedShiftCalendarData>): void {
  if (typeof document === "undefined" || shifts.length === 0) return;
  const ics = buildShiftsIcs(shifts);
  const filename = suggestIcsFilename(shifts);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
