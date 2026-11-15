/**
 * Everything the Today map derives, kept free of React and of Relay's
 * generated files so it can be unit-tested before `relay-compiler` runs.
 *
 * The page joins two reads: the event list (today's events) and the live
 * shift board (who is booked, their clock state, and where the EVENT is).
 * One status per event drives the pin, the legend and the list row.
 */
import { shiftTime } from "@/components/dashboard/todayAttention";
import {
  fitTarget,
  isPlottable,
  SINGLE_PIN_ZOOM,
  US_DEFAULT,
  type FitTarget,
  type LatLng,
} from "@/shared/map/mapFit";

// The camera maths is shared with the Account Map (src/shared/map/mapFit.ts).
export { fitTarget, isPlottable, SINGLE_PIN_ZOOM, US_DEFAULT };
export type { FitTarget, LatLng };

export type MapAssignee = {
  ambassadorUuid: string;
  name: string;
  status: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  /** The ambassador's last phone location, when the board has one. */
  lat: number | null;
  lng: number | null;
  locationAt: string | null;
};

/** One `liveShiftBoard` row, nulls preserved. */
export type BoardRow = {
  eventUuid: string;
  eventName: string;
  brandName: string;
  store: string;
  address: string;
  date: string | null;
  /** The start as the server sends it: an instant when it carries a zone. */
  startTime: string | null;
  endTime: string | null;
  /** Wall-clock time at the venue, for display. */
  startLocal: string | null;
  endLocal: string | null;
  /** Position of the EVENT (not of anyone's phone). Null until looked up. */
  lat: number | null;
  lng: number | null;
  locationSource: string | null;
  assigned: ReadonlyArray<MapAssignee>;
};

/** One event from the event list. */
export type ListedEvent = {
  uuid: string;
  name: string;
  retailer: string;
  address: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  coords: LatLng | null;
};

/** A recent phone location, used when the board row has none for that BA. */
export type PingRow = {
  ambassadorUuid: string;
  eventUuid: string;
  lat: number;
  lng: number;
  recordedAt: string;
};

export type EventStatus =
  | "no_show"
  | "late"
  | "on_clock"
  | "done"
  | "unstaffed"
  | "not_started";

export type PinShape = "circle" | "diamond" | "square" | "ring";
export type PinGlyph = "cross" | "bang" | "play" | "check" | "dash" | "dot";

/**
 * Each status differs in hue AND in shape or glyph, so the map still reads
 * without colour. The hues are fixed (not theme tokens) because they sit on
 * Google's map tiles, which do not follow the app's light/dark appearance;
 * every pin carries its own white edge and dark keyline so it holds up on
 * either surface, including the legend.
 */
export const STATUS_META: Record<
  EventStatus,
  { label: string; color: string; shape: PinShape; glyph: PinGlyph; rank: number }
> = {
  no_show: { label: "No-show", color: "#b3261e", shape: "square", glyph: "cross", rank: 6 },
  late: { label: "Late", color: "#e69f00", shape: "diamond", glyph: "bang", rank: 5 },
  on_clock: { label: "On the clock", color: "#00795c", shape: "circle", glyph: "play", rank: 4 },
  unstaffed: { label: "Nobody booked", color: "#ffffff", shape: "ring", glyph: "dash", rank: 3 },
  not_started: { label: "Not started", color: "#5f6b7a", shape: "circle", glyph: "dot", rank: 2 },
  done: { label: "Done", color: "#1f5fa8", shape: "circle", glyph: "check", rank: 1 },
};

/** Legend order: the day as it unfolds, then the two that need someone. */
export const LEGEND_ORDER: ReadonlyArray<EventStatus> = [
  "not_started",
  "on_clock",
  "late",
  "done",
  "no_show",
  "unstaffed",
];

export type TodayEvent = {
  uuid: string;
  name: string;
  /** Store / retailer line under the name; may be empty. */
  place: string;
  brandName: string;
  address: string;
  /** "9 AM – 1 PM", "9 AM", or "". */
  timeLabel: string;
  startLabel: string;
  endLabel: string;
  startAt: number | null;
  endAt: number | null;
  position: LatLng | null;
  /** "event" | "geocoded" from the board, "event" for list coordinates. */
  positionSource: string | null;
  /** False when the board has no row for this event: bookings unknown. */
  hasBoard: boolean;
  assigned: ReadonlyArray<MapAssignee>;
  status: EventStatus;
};

export const LATE_GRACE_MS = 10 * 60_000;
/** A phone location older than this is drawn faded and described as old. */
export const STALE_LOCATION_MIN = 15;

const HAS_ZONE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const WALL_CLOCK = /(?:T|\s|^)(\d{1,2}):(\d{2})/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

const point = (
  lat: number | null | undefined,
  lng: number | null | undefined,
): LatLng | null =>
  isPlottable(lat, lng) ? { lat: lat as number, lng: lng as number } : null;

/** Local calendar day as YYYY-MM-DD (not the UTC day). */
export function localDayIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * A time as an instant, for "has it started" — never for display.
 *
 * A value with a zone is already an instant. A value without one is the
 * venue's wall clock; without the venue's zone the best available reading
 * is that wall clock on `day` in the viewer's zone. Null when unreadable.
 */
export function toInstant(
  raw: string | null | undefined,
  day: string | null | undefined,
): number | null {
  if (!raw) return null;
  const text = String(raw).trim();
  if (HAS_ZONE.test(text)) {
    const t = new Date(text).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const clock = text.match(WALL_CLOCK);
  const date = text.match(ISO_DAY) ?? String(day ?? "").match(ISO_DAY);
  if (!clock || !date) return null;
  const t = new Date(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    Number(clock[1]),
    Number(clock[2]),
  ).getTime();
  return Number.isNaN(t) ? null : t;
}

const isNoShow = (status: string): boolean =>
  status === "no_show" || status === "missed";

/** Has this person clocked in at any point today (still in, or out again)? */
const hasClockedIn = (a: MapAssignee): boolean =>
  Boolean(a.clockInAt) || a.status === "clocked_in" || a.status === "clocked_out";

const hasClockedOut = (a: MapAssignee): boolean =>
  Boolean(a.clockOutAt) || a.status === "clocked_out";

/**
 * One status per event, first match wins:
 *  1. no_show     — any booked ambassador is marked no-show.
 *  2. late        — started more than 10 minutes ago, someone is booked,
 *                   and nobody has clocked in.
 *  3. on_clock    — anyone is clocked in right now.
 *  4. done        — everyone booked has clocked out, or the end time has
 *                   passed and at least one person clocked out.
 *  5. unstaffed   — nobody is booked.
 *  6. not_started — everything else (including events the board has no
 *                   row for, where bookings are unknown).
 */
export function eventStatus(
  e: {
    assigned: ReadonlyArray<MapAssignee>;
    startAt: number | null;
    endAt: number | null;
    hasBoard: boolean;
  },
  now: number,
): EventStatus {
  if (!e.hasBoard) return "not_started";
  const booked = e.assigned;
  if (booked.some((a) => isNoShow(a.status))) return "no_show";
  if (
    e.startAt !== null &&
    now - e.startAt > LATE_GRACE_MS &&
    booked.length > 0 &&
    !booked.some(hasClockedIn)
  ) {
    return "late";
  }
  if (booked.some((a) => a.status === "clocked_in")) return "on_clock";
  if (booked.length > 0 && booked.every(hasClockedOut)) return "done";
  if (e.endAt !== null && now > e.endAt && booked.some(hasClockedOut)) return "done";
  if (booked.length === 0) return "unstaffed";
  return "not_started";
}

const timeLabel = (start: string, end: string): string =>
  start && end ? `${start} – ${end}` : start || end;

/**
 * Today's events: every listed event, joined to its board row, plus any
 * board row dated today that the list missed. Sorted by start time.
 *
 * The event's position is the board's `lat`/`lng` when it has one, else the
 * coordinates stored on the event, else none.
 */
export function buildTodayEvents(input: {
  listed: ReadonlyArray<ListedEvent>;
  board: ReadonlyArray<BoardRow>;
  now: Date;
}): TodayEvent[] {
  const nowMs = input.now.getTime();
  const today = localDayIso(input.now);
  const boardByUuid = new Map(input.board.map((r) => [r.eventUuid, r]));
  const out: TodayEvent[] = [];
  const seen = new Set<string>();

  const push = (listed: ListedEvent | null, row: BoardRow | null) => {
    const uuid = listed?.uuid ?? row?.eventUuid ?? "";
    if (!uuid || seen.has(uuid)) return;
    seen.add(uuid);
    const day = row?.date ?? listed?.date ?? today;
    const startRaw = row?.startLocal ?? row?.startTime ?? listed?.startTime ?? null;
    const endRaw = row?.endLocal ?? row?.endTime ?? listed?.endTime ?? null;
    const startAt =
      toInstant(row?.startTime, day) ?? toInstant(row?.startLocal, day) ??
      toInstant(listed?.startTime, day);
    let endAt =
      toInstant(row?.endTime, day) ?? toInstant(row?.endLocal, day) ??
      toInstant(listed?.endTime, day);
    // A shift that runs past midnight ends the next day.
    if (startAt !== null && endAt !== null && endAt < startAt) endAt += 86_400_000;
    const boardPos = point(row?.lat, row?.lng);
    const position = boardPos ?? point(listed?.coords?.lat, listed?.coords?.lng);
    const assigned = row?.assigned ?? [];
    const startLabel = shiftTime(startRaw);
    const endLabel = shiftTime(endRaw);
    const place = (listed?.retailer || row?.store || "").trim();
    const name =
      (listed?.name || row?.eventName || row?.store || "").trim() || "Untitled event";
    out.push({
      uuid,
      name,
      place: place === name || place === "—" ? "" : place,
      brandName: row?.brandName ?? "",
      address: (row?.address || listed?.address || "").trim(),
      timeLabel: timeLabel(startLabel, endLabel),
      startLabel,
      endLabel,
      startAt,
      endAt,
      position,
      positionSource: position
        ? boardPos
          ? (row?.locationSource ?? "event")
          : "event"
        : null,
      hasBoard: row !== null,
      assigned,
      status: eventStatus(
        { assigned, startAt, endAt, hasBoard: row !== null },
        nowMs,
      ),
    });
  };

  for (const e of input.listed) push(e, boardByUuid.get(e.uuid) ?? null);
  for (const r of input.board) {
    if (String(r.date ?? "").slice(0, 10) === today) push(null, r);
  }

  const order = (e: TodayEvent) => e.startAt ?? Number.MAX_SAFE_INTEGER;
  return out.sort(
    (a, b) => order(a) - order(b) || a.name.localeCompare(b.name),
  );
}

export type EventPin = TodayEvent & { position: LatLng };

export function eventPins(events: ReadonlyArray<TodayEvent>): EventPin[] {
  return events.filter((e): e is EventPin => e.position !== null);
}

export type BaMarker = {
  key: string;
  ambassadorUuid: string;
  eventUuid: string;
  name: string;
  eventName: string;
  position: LatLng;
  /** Minutes since the phone reported this location; null when unknown. */
  ageMin: number | null;
  stale: boolean;
};

const minutesSince = (iso: string | null | undefined, now: number): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 60_000));
};

/**
 * Phone locations for people who are clocked in RIGHT NOW — nobody else.
 * Position comes from the board row; when it has none, from that person's
 * most recent ping for the same event.
 */
export function baMarkers(
  events: ReadonlyArray<TodayEvent>,
  pings: ReadonlyArray<PingRow>,
  now: Date,
): BaMarker[] {
  const nowMs = now.getTime();
  const latestPing = new Map<string, PingRow>();
  for (const p of pings) {
    if (!isPlottable(p.lat, p.lng)) continue;
    const key = `${p.eventUuid}:${p.ambassadorUuid}`;
    const prev = latestPing.get(key);
    if (!prev || String(p.recordedAt) > String(prev.recordedAt)) latestPing.set(key, p);
  }
  const out: BaMarker[] = [];
  for (const e of events) {
    for (const a of e.assigned) {
      if (a.status !== "clocked_in") continue;
      const key = `${e.uuid}:${a.ambassadorUuid}`;
      let position = point(a.lat, a.lng);
      let at = a.locationAt;
      if (!position) {
        const ping = latestPing.get(key);
        if (!ping) continue;
        position = { lat: ping.lat, lng: ping.lng };
        at = ping.recordedAt;
      }
      const ageMin = minutesSince(at, nowMs);
      out.push({
        key,
        ambassadorUuid: a.ambassadorUuid,
        eventUuid: e.uuid,
        name: a.name.trim() || "Ambassador",
        eventName: e.name,
        position,
        ageMin,
        stale: ageMin !== null && ageMin > STALE_LOCATION_MIN,
      });
    }
  }
  return out;
}

/** How old a phone location is, in words, for the marker's tooltip. */
export function locationAgeWords(ageMin: number | null): string {
  if (ageMin === null) return "Phone location, time unknown";
  if (ageMin < 1) return "Phone location from just now";
  if (ageMin === 1) return "Phone location from 1 minute ago";
  if (ageMin < 60) {
    return ageMin > STALE_LOCATION_MIN
      ? `Phone location from ${ageMin} minutes ago, may be out of date`
      : `Phone location from ${ageMin} minutes ago`;
  }
  const h = Math.floor(ageMin / 60);
  return `Phone location from over ${h} hour${h === 1 ? "" : "s"} ago, may be out of date`;
}

export function baMarkerTitle(m: BaMarker): string {
  return `${m.name} · on the clock at ${m.eventName}. ${locationAgeWords(m.ageMin)}.`;
}

/**
 * Identity of "the set of pins". The camera re-fits only when this changes:
 * a different brand or day, an event gaining a position, someone clocking
 * in or out. It does NOT include statuses or phone positions, so a routine
 * poll that only moves a phone or flips a colour leaves the camera alone.
 */
export function fitKey(
  scope: string,
  pins: ReadonlyArray<EventPin>,
  bas: ReadonlyArray<BaMarker>,
): string {
  const ev = pins
    .map((p) => `${p.uuid}@${p.position.lat.toFixed(5)},${p.position.lng.toFixed(5)}`)
    .sort();
  const ba = bas.map((b) => b.key).sort();
  return `${scope}|${ev.join(";")}|${ba.join(";")}`;
}

export type TodayCounts = {
  events: number;
  /** Ambassadors clocked in right now. */
  onClock: number;
  /** Events that have started, with someone booked and nobody clocked in. */
  notClockedIn: number;
};

export function todayCounts(events: ReadonlyArray<TodayEvent>, now: Date): TodayCounts {
  const nowMs = now.getTime();
  let onClock = 0;
  let notClockedIn = 0;
  for (const e of events) {
    onClock += e.assigned.filter((a) => a.status === "clocked_in").length;
    if (
      e.startAt !== null &&
      nowMs > e.startAt &&
      e.assigned.length > 0 &&
      !e.assigned.some(hasClockedIn)
    ) {
      notClockedIn += 1;
    }
  }
  return { events: events.length, onClock, notClockedIn };
}

export type MapLayout = "empty" | "list-only" | "map";

export type MapCoverage = {
  total: number;
  onMap: number;
  missing: number;
  layout: MapLayout;
  /** One quiet line under the map or above the list; "" when all are mapped. */
  note: string;
};

/**
 * What the map area should be:
 *  - no events                         → "empty" (a short line, no map)
 *  - events, nothing at all to plot    → "list-only"
 *  - anything to plot                  → "map", with a count of the rest
 * `liveMarkers` keeps the map open for staff when people are on the clock
 * but no event has a position yet.
 */
export function mapCoverage(
  events: ReadonlyArray<TodayEvent>,
  liveMarkers = 0,
): MapCoverage {
  const total = events.length;
  const onMap = events.filter((e) => e.position !== null).length;
  const missing = total - onMap;
  if (total === 0) {
    return { total, onMap, missing, layout: "empty", note: "" };
  }
  if (onMap === 0) {
    return {
      total,
      onMap,
      missing,
      layout: liveMarkers > 0 ? "map" : "list-only",
      note:
        total === 1
          ? "This event's map position is still being looked up."
          : "Map positions for today's events are still being looked up.",
    };
  }
  return {
    total,
    onMap,
    missing,
    layout: "map",
    note: missing > 0 ? `${missing} of ${total} not on the map` : "",
  };
}

const PERSON_WORDS: Record<string, string> = {
  clocked_in: "clocked in",
  clocked_out: "clocked out",
  no_show: "no-show",
  missed: "no-show",
  awaiting: "not in yet",
  upcoming: "booked",
};

export type NameFormatter = (name: string) => string;

/** "Alicia Gomez · clocked in" for each person booked on the event. */
export function peopleLines(e: TodayEvent, nameOf: NameFormatter): string[] {
  return e.assigned.map((a) => {
    const name = nameOf(a.name).trim() || "Ambassador";
    return `${name} · ${PERSON_WORDS[a.status] ?? "booked"}`;
  });
}

export function directionsUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

export type CardLines = {
  title: string;
  place: string;
  status: string;
  time: string;
  people: string[];
  /** Shown instead of `people` when it is empty. */
  peopleNote: string;
  address: string;
  directionsUrl: string | null;
};

/** The words on a pin's card. */
export function cardLines(e: TodayEvent, nameOf: NameFormatter): CardLines {
  const people = peopleLines(e, nameOf);
  return {
    title: e.name,
    place: e.place,
    status: STATUS_META[e.status].label,
    time: e.timeLabel || "Time not set",
    people,
    peopleNote:
      people.length > 0
        ? ""
        : e.hasBoard
          ? "Nobody booked"
          : "No booking details for this event",
    address: e.address,
    directionsUrl: e.position ? directionsUrl(e.position) : null,
  };
}
