/**
 * Rows for the dashboard's "Starts today" and "Needs attention" panels.
 *
 * Both read the live shift board (the same query On the Clock uses), so a
 * row here always matches a row someone can open and fix. Each attention
 * row carries its reason in words — the panel never shows a bare count for
 * something that has a name.
 */

export type BoardAssignee = {
  ambassadorUuid: string;
  name: string;
  status: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  pendingApproval: boolean;
  /** When the booking was made (for a walk-up: when they entered their details). */
  registeredAt?: string | null;
};

export type BoardShift = {
  eventUuid: string;
  eventName: string;
  brandName: string;
  store: string;
  /** Start as wall-clock time at the venue when the server sends it; else the instant. */
  startTime: string;
  endTime: string;
  /** The start as an instant, for "has it started" — never for display. */
  startInstant?: string | null;
  /** Last time Clock in was pressed on the check-in page, saved or not. */
  lastClockInTapAt?: string | null;
  assigned: ReadonlyArray<BoardAssignee>;
};

export type AttentionRowKind =
  | "open_punch"
  | "not_clocked_in"
  | "no_show"
  | "unbooked"
  | "walkup"
  | "stale_requests"
  | "unscheduled_requests";

export type StartsTodayRow = {
  key: string;
  eventUuid?: string;
  title: string;
  /** Who is on it and where they stand; empty when nobody is booked. */
  detail: string;
  /** True when `detail` describes a problem (nobody booked, a no-show). */
  flagged: boolean;
  unbooked?: boolean;
  primaryAmbassadorUuid?: string | null;
  primaryAmbassadorName?: string | null;
  time: string;
  to: string;
};

export type AttentionRow = {
  key: string;
  kind?: AttentionRowKind;
  eventUuid?: string;
  ambassadorUuid?: string;
  subject: string;
  context: string;
  reason: string;
  to: string;
};

const WALL_CLOCK = /(?:T|\s|^)(\d{1,2}):(\d{2})/;
// An instant: an ISO stamp that says which zone it is in ("…Z", "…+00:00").
const HAS_ZONE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

const clock = (hh: number, mm: string): string => {
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return mm === "00" ? `${h12} ${ampm}` : `${h12}:${mm} ${ampm}`;
};

/**
 * "4 PM" / "4:30 PM".
 *
 * A value with no zone ("16:30", "2026-11-14T16:30:00") is already the
 * venue's wall-clock time and is printed as written. A value WITH a zone is
 * an instant: its digits are UTC's (or some other zone's), not the venue's,
 * so it is converted — to the viewer's clock, the best available without
 * the venue's zone. Reading the digits of "23:00:00+00:00" as "11 PM" is
 * the bug this guards against.
 */
export function shiftTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const text = String(raw).trim();
  if (HAS_ZONE.test(text)) {
    const d = new Date(text);
    if (isNaN(d.getTime())) return "";
    return clock(d.getHours(), String(d.getMinutes()).padStart(2, "0"));
  }
  const match = text.match(WALL_CLOCK);
  if (!match) return "";
  return clock(parseInt(match[1], 10), match[2]);
}

/** Clock time in the viewer's zone, from an ISO stamp. */
export function punchTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Sort key: real instants order by time; wall-clock values by time of day. */
const startOrder = (raw: string): number => {
  const text = String(raw ?? "").trim();
  if (HAS_ZONE.test(text)) {
    const t = new Date(text).getTime();
    return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  }
  const match = text.match(WALL_CLOCK);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

const place = (s: BoardShift): string => s.store || s.eventName || "Unnamed event";

const isNoShow = (status: string): boolean =>
  status === "no_show" || status === "missed";

const STATE_WORDS: Record<string, string> = {
  clocked_in: "clocked in",
  clocked_out: "clocked out",
  no_show: "no-show",
  missed: "no-show",
  awaiting: "not in yet",
  upcoming: "booked",
};

const named = (a: BoardAssignee): string => a.name.trim() || "Unnamed ambassador";

function assigneeLine(assigned: ReadonlyArray<BoardAssignee>): string {
  if (assigned.length === 1) {
    const a = assigned[0];
    return `${named(a)} · ${STATE_WORDS[a.status] ?? "booked"}`;
  }
  const on = assigned.filter((a) => a.status === "clocked_in").length;
  const missing = assigned.filter((a) => isNoShow(a.status)).length;
  const parts = [`${assigned.length} ambassadors`];
  if (on > 0) parts.push(`${on} clocked in`);
  if (missing > 0) parts.push(`${missing} no-show${missing === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Today's shifts in start-time order, one row per event. */
export function startsTodayRows(
  shifts: ReadonlyArray<BoardShift>,
  opts: { showBrand: boolean },
): StartsTodayRow[] {
  return [...shifts]
    .sort((a, b) => startOrder(a.startTime) - startOrder(b.startTime))
    .map((s) => {
      const unbooked = s.assigned.length === 0;
      const who = unbooked ? "No ambassador booked" : assigneeLine(s.assigned);
      const detail =
        opts.showBrand && s.brandName ? `${s.brandName} · ${who}` : who;
      const flaggedBa =
        s.assigned.find((a) => isNoShow(a.status) || !a.clockInAt) ??
        s.assigned[0] ??
        null;
      return {
        key: s.eventUuid,
        eventUuid: s.eventUuid,
        title: place(s),
        detail,
        flagged: unbooked || s.assigned.some((a) => isNoShow(a.status)),
        unbooked,
        primaryAmbassadorUuid: flaggedBa ? flaggedBa.ambassadorUuid : null,
        primaryAmbassadorName: flaggedBa ? named(flaggedBa) : null,
        time: shiftTime(s.startTime),
        to: `/event/view/${s.eventUuid}`,
      };
    });
}

const plural = (n: number, one: string, many: string): string =>
  n === 1 ? one : many;

/**
 * Everything that needs a person, most urgent first: yesterday's open
 * punches (they block payroll), today's no-shows, today's unbooked shifts,
 * walk-ups waiting for approval, then the request queues.
 */
/** How long after registering before "not clocked in" is worth a row. */
export const REGISTERED_GRACE_MS = 10 * 60_000;
/** Older bookings are staff scheduling ahead, not someone standing in a store. */
const REGISTERED_WINDOW_MS = 12 * 3_600_000;

export function attentionRows(input: {
  today: ReadonlyArray<BoardShift>;
  yesterday: ReadonlyArray<BoardShift>;
  staleRequests: number;
  unscheduledRequests: number;
  now?: Date;
}): AttentionRow[] {
  const rows: AttentionRow[] = [];
  const now = (input.now ?? new Date()).getTime();

  for (const s of input.yesterday) {
    for (const a of s.assigned) {
      if (a.clockInAt && !a.clockOutAt) {
        const at = punchTime(a.clockInAt);
        rows.push({
          key: `open:${s.eventUuid}:${a.ambassadorUuid}`,
          kind: "open_punch",
          eventUuid: s.eventUuid,
          ambassadorUuid: a.ambassadorUuid,
          subject: named(a),
          context: place(s),
          reason: at
            ? `No clock-out · in ${at} yesterday`
            : "No clock-out yesterday",
          to: "/timesheet",
        });
      }
    }
  }

  // Registered on the check-in page (or booked today) and still no clock-in
  // ten minutes on. If Clock in was pressed and nothing saved, say so: that
  // is a different conversation from "they haven't tapped it".
  for (const s of input.today) {
    const startAt = s.startInstant ? new Date(s.startInstant).getTime() : NaN;
    if (!isNaN(startAt) && startAt > now) continue; // not due yet
    for (const a of s.assigned) {
      if (a.clockInAt || isNoShow(a.status) || !a.registeredAt) continue;
      const since = now - new Date(a.registeredAt).getTime();
      if (isNaN(since) || since < REGISTERED_GRACE_MS || since > REGISTERED_WINDOW_MS) {
        continue;
      }
      const pressed = punchTime(s.lastClockInTapAt);
      const registered = punchTime(a.registeredAt);
      rows.push({
        key: `notin:${s.eventUuid}:${a.ambassadorUuid}`,
        kind: "not_clocked_in",
        eventUuid: s.eventUuid,
        ambassadorUuid: a.ambassadorUuid,
        subject: named(a),
        context: place(s),
        reason: pressed
          ? `Pressed Clock in at ${pressed}, nothing saved`
          : `Registered ${registered}, not clocked in`,
        to: "/live-board",
      });
    }
  }

  for (const s of input.today) {
    const start = shiftTime(s.startTime);
    for (const a of s.assigned) {
      if (isNoShow(a.status)) {
        rows.push({
          key: `noshow:${s.eventUuid}:${a.ambassadorUuid}`,
          kind: "no_show",
          eventUuid: s.eventUuid,
          ambassadorUuid: a.ambassadorUuid,
          subject: named(a),
          context: place(s),
          reason: start ? `No-show · due ${start}` : "No-show",
          to: "/live-board",
        });
      }
    }
  }

  for (const s of input.today) {
    if (s.assigned.length === 0) {
      const start = shiftTime(s.startTime);
      rows.push({
        key: `unbooked:${s.eventUuid}`,
        kind: "unbooked",
        eventUuid: s.eventUuid,
        subject: place(s),
        context: s.brandName,
        reason: start
          ? `No ambassador booked · starts ${start}`
          : "No ambassador booked",
        to: `/event/view/${s.eventUuid}`,
      });
    }
  }

  for (const s of input.today) {
    for (const a of s.assigned) {
      if (a.pendingApproval) {
        rows.push({
          key: `walkup:${s.eventUuid}:${a.ambassadorUuid}`,
          kind: "walkup",
          eventUuid: s.eventUuid,
          ambassadorUuid: a.ambassadorUuid,
          subject: named(a),
          context: place(s),
          reason: "Walk-up waiting for approval",
          to: "/walkups",
        });
      }
    }
  }

  if (input.staleRequests > 0) {
    const n = input.staleRequests;
    rows.push({
      key: "stale-requests",
      kind: "stale_requests",
      subject: `${n.toLocaleString()} ${plural(n, "request", "requests")}`,
      context: "",
      reason: "Waiting more than 24 hours",
      to: "/approvals",
    });
  }
  if (input.unscheduledRequests > 0) {
    const n = input.unscheduledRequests;
    rows.push({
      key: "unscheduled-requests",
      kind: "unscheduled_requests",
      subject: `${n.toLocaleString()} ${plural(n, "request", "requests")} in the next 7 days`,
      context: "",
      reason: "Not scheduled yet",
      to: "/requests/list",
    });
  }

  return rows;
}
