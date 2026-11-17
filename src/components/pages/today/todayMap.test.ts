import { describe, expect, it } from "vitest";
import {
  LEGEND_ORDER,
  SINGLE_PIN_ZOOM,
  STATUS_META,
  baMarkerTitle,
  baMarkers,
  buildTodayEvents,
  cardLines,
  directionsUrl,
  eventPins,
  eventStatus,
  fitKey,
  fitTarget,
  isPlottable,
  localDayIso,
  locationAgeWords,
  mapCoverage,
  peopleLines,
  toInstant,
  todayCounts,
  type BoardRow,
  type EventStatus,
  type ListedEvent,
  type MapAssignee,
} from "./todayMap";
import { clientSafeBaName } from "@/utils/clientSafeBaName";

// Local-time fixtures, so the suite reads the same in any zone.
const NOW = new Date(2026, 10, 14, 12, 0, 0); // 14 Nov 2026, noon
const DAY = "2026-11-14";
const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m).getTime();
const MIN = 60_000;

const ba = (over: Partial<MapAssignee> = {}): MapAssignee => ({
  ambassadorUuid: "ba-1",
  name: "Alicia Gomez",
  status: "upcoming",
  clockInAt: null,
  clockOutAt: null,
  lat: null,
  lng: null,
  locationAt: null,
  ...over,
});

const row = (over: Partial<BoardRow> = {}): BoardRow => ({
  eventUuid: "evt-1",
  eventName: "Harris Teeter demo",
  brandName: "Resort Beverage",
  store: "Harris Teeter #12",
  address: "100 Main St, Charlotte, NC",
  date: DAY,
  startTime: null,
  endTime: null,
  startLocal: `${DAY}T09:00:00`,
  endLocal: `${DAY}T13:00:00`,
  lat: null,
  lng: null,
  locationSource: null,
  assigned: [],
  ...over,
});

const listed = (over: Partial<ListedEvent> = {}): ListedEvent => ({
  uuid: "evt-1",
  name: "Harris Teeter demo",
  retailer: "Harris Teeter",
  address: "100 Main St, Charlotte, NC",
  date: DAY,
  startTime: "09:00:00",
  endTime: "13:00:00",
  coords: null,
  ...over,
});

const status = (
  assigned: MapAssignee[],
  opts: { startAt?: number | null; endAt?: number | null; now?: number; hasBoard?: boolean } = {},
): EventStatus =>
  eventStatus(
    {
      assigned,
      startAt: opts.startAt === undefined ? at(9) : opts.startAt,
      endAt: opts.endAt === undefined ? at(13) : opts.endAt,
      hasBoard: opts.hasBoard ?? true,
    },
    opts.now ?? NOW.getTime(),
  );

describe("eventStatus", () => {
  it("is not started before the start, with someone booked", () => {
    expect(status([ba()], { now: at(8) })).toBe("not_started");
  });

  it("gives ten minutes of grace before calling an event late", () => {
    expect(status([ba()], { now: at(9) + 10 * MIN })).toBe("not_started");
    expect(status([ba()], { now: at(9) + 10 * MIN + 1 })).toBe("late");
  });

  it("is late only when someone is booked and nobody has clocked in", () => {
    expect(status([ba({ status: "awaiting" })])).toBe("late");
    expect(status([])).toBe("unstaffed");
    expect(
      status([ba({ status: "awaiting" }), ba({ ambassadorUuid: "b", status: "clocked_in", clockInAt: "x" })]),
    ).toBe("on_clock");
  });

  it("does not call an event late once someone clocked in and out again", () => {
    expect(
      status([
        ba({ status: "clocked_out", clockInAt: "x", clockOutAt: "y" }),
        ba({ ambassadorUuid: "b", status: "awaiting" }),
      ]),
    ).toBe("not_started");
  });

  it("cannot be late without a readable start time", () => {
    expect(status([ba({ status: "awaiting" })], { startAt: null })).toBe("not_started");
  });

  it("is on the clock when anyone is clocked in", () => {
    expect(status([ba({ status: "clocked_in", clockInAt: "x" })])).toBe("on_clock");
  });

  it("is done when everyone booked has clocked out", () => {
    expect(
      status([
        ba({ status: "clocked_out" }),
        ba({ ambassadorUuid: "b", status: "clocked_out" }),
      ]),
    ).toBe("done");
  });

  it("is done after the end time with at least one clock-out", () => {
    const crew = [
      ba({ status: "clocked_out", clockInAt: "x", clockOutAt: "y" }),
      ba({ ambassadorUuid: "b", status: "awaiting" }),
    ];
    expect(status(crew, { now: at(12) })).toBe("not_started");
    expect(status(crew, { now: at(14) })).toBe("done");
  });

  it("puts a no-show above everything else", () => {
    expect(
      status([
        ba({ status: "no_show" }),
        ba({ ambassadorUuid: "b", status: "clocked_in", clockInAt: "x" }),
      ]),
    ).toBe("no_show");
    expect(status([ba({ status: "missed" })], { now: at(8) })).toBe("no_show");
  });

  it("puts on-the-clock above done", () => {
    expect(
      status(
        [
          ba({ status: "clocked_out", clockOutAt: "y" }),
          ba({ ambassadorUuid: "b", status: "clocked_in", clockInAt: "x" }),
        ],
        { now: at(14) },
      ),
    ).toBe("on_clock");
  });

  it("is nobody booked whether or not the event has started", () => {
    expect(status([], { now: at(8) })).toBe("unstaffed");
    expect(status([], { now: at(15) })).toBe("unstaffed");
  });

  it("does not guess at bookings for an event the board has no row for", () => {
    expect(status([], { hasBoard: false })).toBe("not_started");
  });
});

describe("status marks", () => {
  it("has a plain-words label for every status, in the legend", () => {
    expect(LEGEND_ORDER.map((s) => STATUS_META[s].label)).toEqual([
      "Not started",
      "On the clock",
      "Late",
      "Done",
      "No-show",
      "Nobody booked",
    ]);
    expect([...LEGEND_ORDER].sort()).toEqual(Object.keys(STATUS_META).sort());
  });

  it("never relies on colour alone: each status has its own glyph and colour", () => {
    const metas = Object.values(STATUS_META);
    expect(new Set(metas.map((m) => m.glyph)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.color)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.shape)).size).toBeGreaterThanOrEqual(3);
  });
});

describe("toInstant", () => {
  it("reads a zoned value as the instant it is", () => {
    expect(toInstant("2026-11-14T17:00:00+00:00", DAY)).toBe(Date.UTC(2026, 10, 14, 17));
    expect(toInstant("2026-11-14T17:00:00Z", null)).toBe(Date.UTC(2026, 10, 14, 17));
  });

  it("reads a wall-clock value on the given day", () => {
    expect(toInstant("09:30:00", DAY)).toBe(at(9, 30));
    expect(toInstant("2026-11-14T09:30:00", null)).toBe(at(9, 30));
  });

  it("is null when there is nothing to read", () => {
    expect(toInstant(null, DAY)).toBeNull();
    expect(toInstant("", DAY)).toBeNull();
    expect(toInstant("09:30", null)).toBeNull();
    expect(toInstant("soon", DAY)).toBeNull();
  });
});

describe("isPlottable", () => {
  it("rejects nulls, zeros, and out-of-range values", () => {
    expect(isPlottable(35.2, -80.8)).toBe(true);
    expect(isPlottable(null, -80.8)).toBe(false);
    expect(isPlottable(undefined, undefined)).toBe(false);
    expect(isPlottable(0, 0)).toBe(false);
    expect(isPlottable(91, 10)).toBe(false);
    expect(isPlottable(10, 181)).toBe(false);
    expect(isPlottable(Number.NaN, 10)).toBe(false);
  });
});

describe("buildTodayEvents", () => {
  it("takes the event's position from the board", () => {
    const [e] = buildTodayEvents({
      listed: [listed()],
      board: [row({ lat: 35.2, lng: -80.8, locationSource: "geocoded" })],
      now: NOW,
    });
    expect(e.position).toEqual({ lat: 35.2, lng: -80.8 });
    expect(e.positionSource).toBe("geocoded");
  });

  it("falls back to coordinates stored on the event", () => {
    const [e] = buildTodayEvents({
      listed: [listed({ coords: { lat: 33.7, lng: -84.4 } })],
      board: [row()],
      now: NOW,
    });
    expect(e.position).toEqual({ lat: 33.7, lng: -84.4 });
    expect(e.positionSource).toBe("event");
  });

  it("keeps working when every position comes back null", () => {
    const events = buildTodayEvents({
      listed: [listed(), listed({ uuid: "evt-2", name: "Publix demo" })],
      board: [row(), row({ eventUuid: "evt-2" })],
      now: NOW,
    });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.position === null && e.positionSource === null)).toBe(true);
    expect(eventPins(events)).toEqual([]);
    expect(mapCoverage(events).layout).toBe("list-only");
  });

  it("ignores an unusable position instead of pinning the Gulf of Guinea", () => {
    const [e] = buildTodayEvents({
      listed: [listed()],
      board: [row({ lat: 0, lng: 0 })],
      now: NOW,
    });
    expect(e.position).toBeNull();
  });

  it("prints venue wall-clock time and derives status from the board", () => {
    const [e] = buildTodayEvents({
      listed: [listed()],
      board: [
        row({
          startTime: "2026-11-14T17:00:00+00:00",
          assigned: [ba({ status: "clocked_in", clockInAt: "x" })],
        }),
      ],
      now: NOW,
    });
    expect(e.timeLabel).toBe("9 AM – 1 PM");
    expect(e.startAt).toBe(Date.UTC(2026, 10, 14, 17));
    expect(e.status).toBe("on_clock");
    expect(e.hasBoard).toBe(true);
  });

  it("keeps a listed event the board does not know, without guessing bookings", () => {
    const [e] = buildTodayEvents({ listed: [listed()], board: [], now: NOW });
    expect(e.hasBoard).toBe(false);
    expect(e.status).toBe("not_started");
    expect(e.timeLabel).toBe("9 AM – 1 PM");
  });

  it("adds a board row dated today that the list missed, and skips other days", () => {
    const events = buildTodayEvents({
      listed: [listed()],
      board: [
        row(),
        row({ eventUuid: "evt-9", eventName: "Walk-up at Kroger", store: "Kroger #4" }),
        row({ eventUuid: "evt-tomorrow", date: "2026-11-15" }),
        row({ eventUuid: "evt-undated", date: null }),
      ],
      now: NOW,
    });
    expect(events.map((e) => e.uuid).sort()).toEqual(["evt-1", "evt-9"]);
    expect(events.find((e) => e.uuid === "evt-9")?.name).toBe("Walk-up at Kroger");
  });

  it("dates a board row by the venue's day, not the UTC day", () => {
    // 6 PM Pacific on the 14th is 02:00 UTC on the 15th.
    const evening = row({
      eventUuid: "evt-evening",
      date: "2026-11-15T02:00:00+00:00",
      localDate: DAY,
    });
    const tomorrowMorning = row({
      eventUuid: "evt-next",
      date: "2026-11-15T14:00:00+00:00",
      localDate: "2026-11-15",
    });
    const events = buildTodayEvents({
      listed: [],
      board: [evening, tomorrowMorning],
      now: NOW,
      today: DAY,
    });
    expect(events.map((e) => e.uuid)).toEqual(["evt-evening"]);
  });

  it("lists each event once", () => {
    const events = buildTodayEvents({
      listed: [listed(), listed()],
      board: [row(), row()],
      now: NOW,
    });
    expect(events).toHaveLength(1);
  });

  it("sorts by start time, untimed events last", () => {
    const events = buildTodayEvents({
      listed: [
        listed({ uuid: "c", name: "C", startTime: null, endTime: null }),
        listed({ uuid: "b", name: "B", startTime: "14:00:00", endTime: "18:00:00" }),
        listed({ uuid: "a", name: "A", startTime: "08:00:00", endTime: "12:00:00" }),
      ],
      board: [],
      now: NOW,
    });
    expect(events.map((e) => e.uuid)).toEqual(["a", "b", "c"]);
    expect(events[2].timeLabel).toBe("");
  });

  it("treats an end before the start as the next day", () => {
    const [e] = buildTodayEvents({
      listed: [listed({ startTime: "20:00:00", endTime: "01:00:00" })],
      board: [],
      now: NOW,
    });
    expect((e.endAt as number) - (e.startAt as number)).toBe(5 * 60 * MIN);
  });

  it("names an event that has no name", () => {
    const [e] = buildTodayEvents({
      listed: [listed({ name: "", retailer: "" })],
      board: [row({ eventName: "", store: "" })],
      now: NOW,
    });
    expect(e.name).toBe("Untitled event");
    expect(e.place).toBe("");
  });
});

describe("todayCounts", () => {
  const events = buildTodayEvents({
    listed: [],
    board: [
      // Started, booked, nobody in → counts.
      row({ eventUuid: "a", assigned: [ba({ status: "awaiting" })] }),
      // Started one minute ago: inside the late grace, still counts here.
      row({
        eventUuid: "b",
        startLocal: `${DAY}T11:59:00`,
        assigned: [ba({ status: "upcoming" })],
      }),
      // Not started yet.
      row({
        eventUuid: "c",
        startLocal: `${DAY}T15:00:00`,
        endLocal: `${DAY}T19:00:00`,
        assigned: [ba()],
      }),
      // Started, someone in.
      row({
        eventUuid: "d",
        assigned: [
          ba({ status: "clocked_in", clockInAt: "x" }),
          ba({ ambassadorUuid: "b2", status: "clocked_in", clockInAt: "x" }),
        ],
      }),
      // Started, nobody booked: a staffing problem, not a clock-in one.
      row({ eventUuid: "e" }),
    ],
    now: NOW,
  });

  it("counts events, people on the clock, and started events with nobody in", () => {
    expect(todayCounts(events, NOW)).toEqual({ events: 5, onClock: 2, notClockedIn: 2 });
  });

  it("is a plain zero when nothing is waiting", () => {
    expect(todayCounts([], NOW)).toEqual({ events: 0, onClock: 0, notClockedIn: 0 });
  });
});

describe("baMarkers", () => {
  const events = buildTodayEvents({
    listed: [],
    board: [
      row({
        assigned: [
          ba({
            ambassadorUuid: "in",
            status: "clocked_in",
            lat: 35.21,
            lng: -80.81,
            locationAt: new Date(NOW.getTime() - 4 * MIN).toISOString(),
          }),
          ba({ ambassadorUuid: "out", status: "clocked_out", lat: 35.3, lng: -80.9 }),
          ba({ ambassadorUuid: "due", status: "awaiting", lat: 35.4, lng: -80.7 }),
          ba({ ambassadorUuid: "in-no-fix", name: "", status: "clocked_in" }),
          ba({ ambassadorUuid: "in-ping", name: "Jordan Lee", status: "clocked_in" }),
        ],
      }),
    ],
    now: NOW,
  });
  const pings = [
    {
      ambassadorUuid: "in-ping",
      eventUuid: "evt-1",
      lat: 35.0,
      lng: -80.0,
      recordedAt: new Date(NOW.getTime() - 40 * MIN).toISOString(),
    },
    {
      ambassadorUuid: "in-ping",
      eventUuid: "evt-1",
      lat: 35.5,
      lng: -80.5,
      recordedAt: new Date(NOW.getTime() - 20 * MIN).toISOString(),
    },
    // Someone the board does not have on the clock: never drawn.
    {
      ambassadorUuid: "out",
      eventUuid: "evt-1",
      lat: 36,
      lng: -81,
      recordedAt: NOW.toISOString(),
    },
  ];

  it("draws only people who are on the clock right now", () => {
    const markers = baMarkers(events, pings, NOW);
    expect(markers.map((m) => m.ambassadorUuid)).toEqual(["in", "in-ping"]);
  });

  it("uses the board position, else that person's newest ping", () => {
    const [fresh, pinged] = baMarkers(events, pings, NOW);
    expect(fresh.position).toEqual({ lat: 35.21, lng: -80.81 });
    expect(fresh.ageMin).toBe(4);
    expect(fresh.stale).toBe(false);
    expect(pinged.position).toEqual({ lat: 35.5, lng: -80.5 });
    expect(pinged.ageMin).toBe(20);
    expect(pinged.stale).toBe(true);
  });

  it("explains freshness in words", () => {
    const [fresh, pinged] = baMarkers(events, pings, NOW);
    expect(baMarkerTitle(fresh)).toBe(
      "Alicia Gomez · on the clock at Harris Teeter demo. Phone location from 4 minutes ago.",
    );
    expect(baMarkerTitle(pinged)).toContain("20 minutes ago, may be out of date");
    expect(locationAgeWords(0)).toBe("Phone location from just now");
    expect(locationAgeWords(1)).toBe("Phone location from 1 minute ago");
    expect(locationAgeWords(130)).toBe(
      "Phone location from over 2 hours ago, may be out of date",
    );
    expect(locationAgeWords(null)).toBe("Phone location, time unknown");
  });
});

describe("fitTarget", () => {
  it("has nothing to fit with no points", () => {
    expect(fitTarget([])).toEqual({ kind: "none" });
    expect(fitTarget([{ lat: 0, lng: 0 }])).toEqual({ kind: "none" });
  });

  it("zooms to street level for one pin", () => {
    expect(fitTarget([{ lat: 35.2, lng: -80.8 }])).toEqual({
      kind: "single",
      center: { lat: 35.2, lng: -80.8 },
      zoom: SINGLE_PIN_ZOOM,
    });
    expect(SINGLE_PIN_ZOOM).toBe(12);
  });

  it("treats several pins at one store as one pin", () => {
    const t = fitTarget([
      { lat: 35.2, lng: -80.8 },
      { lat: 35.2004, lng: -80.8003 },
    ]);
    expect(t.kind).toBe("single");
  });

  it("boxes pins that are apart, ignoring unusable ones", () => {
    expect(
      fitTarget([
        { lat: 35.2, lng: -80.8 },
        { lat: 33.7, lng: -84.4 },
        { lat: 0, lng: 0 },
      ]),
    ).toEqual({ kind: "bounds", north: 35.2, south: 33.7, east: -80.8, west: -84.4 });
  });
});

describe("fitKey", () => {
  const build = (assigned: MapAssignee[], pos = { lat: 35.2, lng: -80.8 }) => {
    const events = buildTodayEvents({
      listed: [],
      board: [row({ ...pos, assigned })],
      now: NOW,
    });
    return fitKey("tenant-1|2026-11-14", eventPins(events), baMarkers(events, [], NOW));
  };
  const onClockAt = (lat: number) =>
    ba({ status: "clocked_in", clockInAt: "x", lat, lng: -80.8 });

  it("does not change when a poll only flips a status or moves a phone", () => {
    expect(build([ba({ status: "awaiting" })])).toBe(build([ba({ status: "no_show" })]));
    expect(build([onClockAt(35.21)])).toBe(build([onClockAt(35.29)]));
  });

  it("changes when a pin appears, moves, or someone clocks in", () => {
    const base = build([ba({ status: "awaiting" })]);
    expect(build([ba({ status: "awaiting" })], { lat: 36, lng: -80.8 })).not.toBe(base);
    expect(build([onClockAt(35.21)])).not.toBe(base);
  });

  it("changes with the brand or the day", () => {
    const events = buildTodayEvents({ listed: [], board: [row({ lat: 35, lng: -80 })], now: NOW });
    const pins = eventPins(events);
    expect(fitKey("tenant-1|2026-11-14", pins, [])).not.toBe(
      fitKey("tenant-2|2026-11-14", pins, []),
    );
  });
});

describe("mapCoverage", () => {
  const make = (positions: Array<boolean>) =>
    buildTodayEvents({
      listed: [],
      board: positions.map((has, i) =>
        row({ eventUuid: `e${i}`, ...(has ? { lat: 35 + i, lng: -80 } : {}) }),
      ),
      now: NOW,
    });

  it("collapses the map when there are no events", () => {
    expect(mapCoverage([])).toEqual({
      total: 0,
      onMap: 0,
      missing: 0,
      layout: "empty",
      note: "",
    });
  });

  it("gives the list the width when nothing has a position", () => {
    const c = mapCoverage(make([false, false]));
    expect(c.layout).toBe("list-only");
    expect(c.note).toBe("Map positions for today's events are still being looked up.");
    expect(mapCoverage(make([false])).note).toBe(
      "This event's map position is still being looked up.",
    );
  });

  it("keeps the map for staff when people are on the clock but no event is placed", () => {
    expect(mapCoverage(make([false, false]), 1).layout).toBe("map");
  });

  it("counts the ones that are not on the map", () => {
    const c = mapCoverage(make([true, true, true, false, false]));
    expect(c.layout).toBe("map");
    expect(c.note).toBe("2 of 5 not on the map");
  });

  it("says nothing when every event is on the map", () => {
    expect(mapCoverage(make([true, true])).note).toBe("");
  });
});

describe("cards", () => {
  const [event] = buildTodayEvents({
    listed: [listed()],
    board: [
      row({
        lat: 35.2,
        lng: -80.8,
        assigned: [
          ba({ status: "clocked_in", clockInAt: "x" }),
          ba({ ambassadorUuid: "b", name: "Jordan Lee", status: "awaiting" }),
          ba({ ambassadorUuid: "c", name: "checkin-5551234567@walkup.spark", status: "weird" }),
          ba({ ambassadorUuid: "d", name: "", status: "clocked_out" }),
        ],
      }),
    ],
    now: NOW,
  });
  const full = (n: string) => n;

  it("says who is booked and where each stands, in words", () => {
    expect(peopleLines(event, full)).toEqual([
      "Alicia Gomez · clocked in",
      "Jordan Lee · not in yet",
      "checkin-5551234567@walkup.spark · booked",
      "Ambassador · clocked out",
    ]);
  });

  it("gives brand clients first name and initial, never an email", () => {
    expect(peopleLines(event, clientSafeBaName)).toEqual([
      "Alicia G. · clocked in",
      "Jordan L. · not in yet",
      "Ambassador · booked",
      "Ambassador · clocked out",
    ]);
  });

  it("builds the card: name, status, time, people, address, directions", () => {
    expect(cardLines(event, full)).toEqual({
      title: "Harris Teeter demo",
      place: "Harris Teeter",
      status: "On the clock",
      time: "9 AM – 1 PM",
      people: peopleLines(event, full),
      peopleNote: "",
      address: "100 Main St, Charlotte, NC",
      directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=35.2,-80.8",
    });
  });

  it("says so when nobody is booked, or when bookings are unknown", () => {
    const [unstaffed] = buildTodayEvents({ listed: [], board: [row()], now: NOW });
    expect(cardLines(unstaffed, full).peopleNote).toBe("Nobody booked");
    expect(cardLines(unstaffed, full).directionsUrl).toBeNull();
    const [unknown] = buildTodayEvents({
      listed: [listed({ startTime: null, endTime: null })],
      board: [],
      now: NOW,
    });
    expect(cardLines(unknown, full).peopleNote).toBe("No booking details for this event");
    expect(cardLines(unknown, full).time).toBe("Time not set");
  });

  it("builds the directions link from the position", () => {
    expect(directionsUrl({ lat: 33.749, lng: -84.388 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=33.749,-84.388",
    );
  });
});

describe("localDayIso", () => {
  it("is the local calendar day, not the UTC one", () => {
    expect(localDayIso(new Date(2026, 10, 14, 23, 30))).toBe("2026-11-14");
    expect(localDayIso(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });
});
