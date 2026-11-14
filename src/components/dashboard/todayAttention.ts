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
};

export type BoardShift = {
  eventUuid: string;
  eventName: string;
  brandName: string;
  store: string;
  startTime: string;
  endTime: string;
  assigned: ReadonlyArray<BoardAssignee>;
};

export type StartsTodayRow = {
  key: string;
  title: string;
  /** Who is on it and where they stand; empty when nobody is booked. */
  detail: string;
  /** True when `detail` describes a problem (nobody booked, a no-show). */
  flagged: boolean;
  time: string;
  to: string;
};

export type AttentionRow = {
  key: string;
  subject: string;
  context: string;
  reason: string;
  to: string;
};

/** "4 PM" / "4:30 PM" from "16:30" or a full venue-local datetime. */
export function shiftTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const match = String(raw).match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hh = parseInt(match[1], 10);
  const mm = match[2];
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return mm === "00" ? `${h12} ${ampm}` : `${h12}:${mm} ${ampm}`;
}

/** Clock time in the viewer's zone, from an ISO stamp. */
export function punchTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const minutesOfDay = (raw: string): number => {
  const match = String(raw).match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
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
    .sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime))
    .map((s) => {
      const unbooked = s.assigned.length === 0;
      const who = unbooked ? "No ambassador booked" : assigneeLine(s.assigned);
      const detail =
        opts.showBrand && s.brandName ? `${s.brandName} · ${who}` : who;
      return {
        key: s.eventUuid,
        title: place(s),
        detail,
        flagged: unbooked || s.assigned.some((a) => isNoShow(a.status)),
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
export function attentionRows(input: {
  today: ReadonlyArray<BoardShift>;
  yesterday: ReadonlyArray<BoardShift>;
  staleRequests: number;
  unscheduledRequests: number;
}): AttentionRow[] {
  const rows: AttentionRow[] = [];

  for (const s of input.yesterday) {
    for (const a of s.assigned) {
      if (a.clockInAt && !a.clockOutAt) {
        const at = punchTime(a.clockInAt);
        rows.push({
          key: `open:${s.eventUuid}:${a.ambassadorUuid}`,
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

  for (const s of input.today) {
    const start = shiftTime(s.startTime);
    for (const a of s.assigned) {
      if (isNoShow(a.status)) {
        rows.push({
          key: `noshow:${s.eventUuid}:${a.ambassadorUuid}`,
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
      subject: `${n.toLocaleString()} ${plural(n, "request", "requests")} in the next 7 days`,
      context: "",
      reason: "Not scheduled yet",
      to: "/requests/list",
    });
  }

  return rows;
}
