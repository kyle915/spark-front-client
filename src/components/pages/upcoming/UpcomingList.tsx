import { Link } from "react-router";
import { Store } from "lucide-react";
import { dayToDate } from "@/utils/venueDay";

/**
 * The Upcoming schedule: one list per day, a row per event. Time first in a
 * fixed column, then the store, then where it is. Approved is the normal
 * state, so only rows that are not (pending, cancelled, …) carry a status.
 */

export type UpcomingRow = {
  uuid: string;
  name: string;
  /** The venue's day, YYYY-MM-DD. */
  date: string;
  /** Venue wall-clock start, for ordering within a day. */
  sortAt: string;
  /** Venue wall-clock start / end as the API sends them. */
  startRaw: string | null;
  endRaw: string | null;
  /** Retailer and/or address, already de-duplicated against the name. */
  location: string;
  /** Status name as the API sends it. */
  status: string;
  statusSlug: string;
  source: "event" | "request";
  /** False when the event/request has no street address yet. */
  hasAddress?: boolean;
  /** Venue timezone display label for inline rescheduling. */
  timezoneLabel?: string | null;
  /** Raw street address for StoreSheet drill-down. */
  address?: string | null;
};

const fmtDay = (iso: string) =>
  dayToDate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

/** Hour/minute of a venue wall-clock string ("2026-05-29T07:00:00" or "07:00"). */
function clock(raw: string | null | undefined): { h: number; m: string } | null {
  if (!raw) return null;
  const match = String(raw).match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return { h: parseInt(match[1], 10), m: match[2] };
}

function fmtClock(c: { h: number; m: string }, withMeridiem: boolean): string {
  const h12 = ((c.h + 11) % 12) + 1;
  const base = c.m === "00" ? `${h12}` : `${h12}:${c.m}`;
  return withMeridiem ? `${base} ${c.h >= 12 ? "PM" : "AM"}` : base;
}

/**
 * "6:30 – 9 AM", "10:30 AM – 2 PM"; the start alone when there is no end.
 * `startFull` always carries AM/PM, for the phone layout where start and end
 * stack on two lines and a bare "7" would not read as a time.
 */
function fmtTimeRange(
  startRaw: string | null | undefined,
  endRaw: string | null | undefined,
): { start: string; startFull: string; end: string } {
  const s = clock(startRaw);
  const e = clock(endRaw);
  if (!s) return { start: "Time TBD", startFull: "Time TBD", end: "" };
  const full = fmtClock(s, true);
  if (!e) return { start: full, startFull: full, end: "" };
  const sameHalf = s.h >= 12 === e.h >= 12;
  return { start: fmtClock(s, !sameHalf), startFull: full, end: fmtClock(e, true) };
}

/** Statuses that are the normal state of a scheduled event: no pill. */
const QUIET = new Set(["", "approved", "scheduled", "confirmed", "booked"]);

function StatusPill({ row }: { row: UpcomingRow }) {
  const slug = row.statusSlug;
  const showStatus = !QUIET.has(slug);
  const pending = slug === "pending" || slug === "queue";
  const missingAddress = row.hasAddress === false;
  if (!showStatus && !missingAddress) return null;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap justify-end">
      {showStatus ? (
        <span className={`chip chip-sm ${pending ? "chip-orange" : "chip-muted"}`}>
          {pending ? "Needs approval" : row.status}
        </span>
      ) : null}
      {missingAddress ? (
        <span className="chip chip-sm chip-orange">Needs address</span>
      ) : null}
    </span>
  );
}

const NON_RESCHEDULABLE = new Set(["cancelled", "canceled", "declined", "done", "completed"]);

function Row({
  row,
  onReschedule,
  onPeekStore,
}: {
  row: UpcomingRow;
  onReschedule?: (row: UpcomingRow) => void;
  onPeekStore?: (row: UpcomingRow) => void;
}) {
  const t = fmtTimeRange(row.startRaw, row.endRaw);
  const to =
    row.source === "event" ? `/event/view/${row.uuid}` : `/request/view/${row.uuid}`;
  const name = row.name.trim() || "Untitled";
  const canReschedule =
    Boolean(onReschedule) &&
    row.source === "event" &&
    !NON_RESCHEDULABLE.has(row.statusSlug);
  return (
    <li className="flex items-center justify-between gap-2">
      <Link
        to={to}
        state={row.source === "request" ? { from: "/upcoming" } : undefined}
        className="spark-upcoming-row flex-1 min-w-0"
      >
        <span className="spark-upcoming-time">
          {t.start === t.startFull ? (
            <span>{t.start}</span>
          ) : (
            <>
              <span className="spark-upcoming-start-short">{t.start}</span>
              <span className="spark-upcoming-start-full">{t.startFull}</span>
            </>
          )}
          {t.end ? (
            <>
              <span className="spark-upcoming-dash" aria-hidden>
                {" – "}
              </span>
              <span className="sr-only"> to </span>
              <span className="spark-upcoming-end">{t.end}</span>
            </>
          ) : null}
        </span>
        <span className="spark-upcoming-what">
          <span className="spark-upcoming-name">{name}</span>
          {row.location ? (
            <span className="spark-upcoming-where">{row.location}</span>
          ) : null}
        </span>
        <span className="spark-upcoming-status">
          <StatusPill row={row} />
        </span>
      </Link>
      <div className="shrink-0 mr-3 flex items-center gap-1.5">
        {onPeekStore ? (
          <button
            type="button"
            onClick={() => onPeekStore(row)}
            className="p-1.5 rounded-lg text-xs transition hover:opacity-80 cursor-pointer"
            style={{
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text-secondary)",
              background: "transparent",
            }}
            aria-label={`Peek store profile for ${name}`}
            title="Store profile & history"
          >
            <Store size={14} strokeWidth={1.8} />
          </button>
        ) : null}
        {canReschedule ? (
          <button
            type="button"
            onClick={() => onReschedule?.(row)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-80 cursor-pointer"
            style={{
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text-secondary)",
              background: "transparent",
            }}
          >
            Change date
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function UpcomingList({
  rows,
  today,
  onReschedule,
  onPeekStore,
}: {
  rows: UpcomingRow[];
  today: string;
  onReschedule?: (row: UpcomingRow) => void;
  onPeekStore?: (row: UpcomingRow) => void;
}) {
  const groups = new Map<string, UpcomingRow[]>();
  for (const r of rows) {
    const key = r.date.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const days = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      {days.map(([key, items]) => {
        const headingId = `upcoming-day-${key}`;
        return (
          <section key={key} aria-labelledby={headingId}>
            <h2 id={headingId} className="spark-upcoming-day">
              {fmtDay(key)}
              <span className="spark-upcoming-day-meta">
                {key === today ? " · Today" : ""} · {items.length}{" "}
                {items.length === 1 ? "event" : "events"}
              </span>
            </h2>
            <ul className="spark-upcoming-list">
              {items.map((r) => (
                <Row
                  key={`${r.source}-${r.uuid}`}
                  row={r}
                  onReschedule={onReschedule}
                  onPeekStore={onPeekStore}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Loading placeholder with the same shape as the list. */
export function UpcomingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading upcoming events">
      {[4, 3].map((n, g) => (
        <div key={g}>
          <div className="skeleton-block h-4 w-48 mb-3" />
          <div className="spark-upcoming-list">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="spark-upcoming-row" aria-hidden>
                <span className="skeleton-block h-3.5 w-24" />
                <span className="skeleton-block h-3.5 w-3/5" />
                <span />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default UpcomingList;
