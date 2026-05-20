import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";

/**
 * Calendar view for Master Tracker. 7-column monthly grid, each day
 * cell stacks request chips colored by status. Pairs with the
 * existing list view via the LIST / CALENDAR toggle on Master
 * Tracker.
 *
 * Why a separate component (not inline in MasterTracker): the table
 * and the calendar share zero layout, so keeping them apart lets
 * each iterate on its own ergonomics without one bloating the other.
 *
 * The empty-day "+" click navigates to /requests/create with a
 * ?date=YYYY-MM-DD query so the create form can prefill. (Form-side
 * prefill ships in a sibling commit; until then the URL is harmless.)
 */

export type CalendarRow = {
  uuid: string;
  date: string; // ISO; first 10 chars are YYYY-MM-DD
  venue: string;
  statusSlug: string;
  eventUuid: string | null;
  recapStatus: "submitted" | "due" | "none";
  recapCount: number;
};

// Background+border tints by status. Mono palette so the calendar
// stays scannable — the tracker table is the place to read every
// field; the calendar just needs to say "what kind of thing is on
// this day."
const STATUS_BG: Record<string, { bg: string; bd: string; fg: string }> = {
  done: {
    bg: "rgba(197,245,70,0.10)",
    bd: "rgba(197,245,70,0.35)",
    fg: "var(--spark-lime)",
  },
  scheduled: {
    bg: "rgba(116,192,252,0.10)",
    bd: "rgba(116,192,252,0.30)",
    fg: "var(--spark-sky)",
  },
  approved: {
    bg: "rgba(189,148,255,0.10)",
    bd: "rgba(189,148,255,0.30)",
    fg: "var(--spark-purple)",
  },
  queue: {
    bg: "rgba(245,201,79,0.10)",
    bd: "rgba(245,201,79,0.30)",
    fg: "var(--spark-gold)",
  },
  pending: {
    bg: "rgba(245,140,79,0.10)",
    bd: "rgba(245,140,79,0.30)",
    fg: "var(--spark-orange)",
  },
};
const STATUS_BG_FALLBACK = {
  bg: "rgba(255,255,255,0.06)",
  bd: "rgba(255,255,255,0.15)",
  fg: "rgba(255,255,255,0.7)",
};

// Build the 6x7 grid for the given month — JS Date is 0-indexed by
// month. We include trailing days of prev month + leading days of
// next month to fill the 42 cells so the grid never reflows.
type Cell = { iso: string; inMonth: boolean; day: number };
const buildGrid = (year: number, month0: number): Cell[] => {
  const first = new Date(Date.UTC(year, month0, 1));
  // Start on Sunday. getUTCDay() returns 0 (Sun) - 6 (Sat).
  const startOffset = first.getUTCDay();
  const cells: Cell[] = [];
  // Leading days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month0, -i));
    cells.push({
      iso: d.toISOString().slice(0, 10),
      inMonth: false,
      day: d.getUTCDate(),
    });
  }
  // Days in this month
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, month0, d));
    cells.push({
      iso: dt.toISOString().slice(0, 10),
      inMonth: true,
      day: d,
    });
  }
  // Trailing days from next month to fill 42
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    const dt = new Date(last.iso + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + 1);
    cells.push({
      iso: dt.toISOString().slice(0, 10),
      inMonth:
        dt.getUTCMonth() === month0 && dt.getUTCFullYear() === year,
      day: dt.getUTCDate(),
    });
  }
  return cells;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_HEADER = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const TrackerCalendar: React.FC<{ rows: CalendarRow[] }> = ({ rows }) => {
  const navigate = useNavigate();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  // Group rows by their YYYY-MM-DD. Memoized so reshuffling month
  // doesn't redo this each render.
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarRow[]>();
    for (const r of rows) {
      if (!r.date) continue;
      const key = r.date.slice(0, 10);
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    }
    return m;
  }, [rows]);

  const cells = useMemo(
    () => buildGrid(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  const prev = () =>
    setCursor((c) => {
      const m = c.m - 1;
      return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m };
    });
  const next = () =>
    setCursor((c) => {
      const m = c.m + 1;
      return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
    });
  const jumpToday = () => {
    const d = new Date();
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const clickRow = (r: CalendarRow) => {
    if (r.statusSlug === "done" && r.eventUuid) {
      navigate(`/event/view/${r.eventUuid}`);
    } else if (r.eventUuid) {
      navigate(`/event/view/${r.eventUuid}`);
    } else {
      navigate(`/request/view/${r.uuid}`, {
        state: { from: "/requests/list" },
      });
    }
  };

  return (
    <div className="spark-card overflow-hidden" style={{ borderRadius: 20 }}>
      {/* Month header + nav */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--spark-border)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            className="mono text-[11px] px-2.5 py-1.5 rounded-lg"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid var(--spark-border)",
              background: "transparent",
            }}
            aria-label="Previous month"
          >
            ‹ PREV
          </button>
          <button
            onClick={jumpToday}
            className="mono text-[11px] px-2.5 py-1.5 rounded-lg"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-lime)",
              border: "1px solid rgba(197,245,70,0.4)",
              background: "rgba(197,245,70,0.05)",
            }}
          >
            TODAY
          </button>
          <button
            onClick={next}
            className="mono text-[11px] px-2.5 py-1.5 rounded-lg"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid var(--spark-border)",
              background: "transparent",
            }}
            aria-label="Next month"
          >
            NEXT ›
          </button>
        </div>
        <h3 className="display text-lg font-bold">
          {MONTH_NAMES[cursor.m]} {cursor.y}
        </h3>
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {rows.length} REQUEST{rows.length === 1 ? "" : "S"} IN VIEW
        </span>
      </div>

      {/* Weekday strip */}
      <div
        className="grid grid-cols-7 mono text-[10px]"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
          borderBottom: "1px solid var(--spark-border)",
          background: "var(--spark-surface-2)",
        }}
      >
        {WEEKDAY_HEADER.map((d) => (
          <div key={d} className="px-3 py-2">
            {d}
          </div>
        ))}
      </div>

      {/* 6×7 grid */}
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(96px, 1fr)" }}>
        {cells.map((cell, idx) => {
          const dayRows = byDate.get(cell.iso) ?? [];
          const isToday = cell.iso === today;
          const isWeekStart = idx % 7 === 0;
          return (
            <div
              key={cell.iso + "-" + idx}
              className="px-2 py-2 flex flex-col gap-1 relative group"
              style={{
                borderBottom: "1px solid var(--spark-border)",
                borderLeft: isWeekStart
                  ? "none"
                  : "1px solid var(--spark-border)",
                background: cell.inMonth
                  ? "transparent"
                  : "rgba(255,255,255,0.02)",
                minHeight: 96,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="mono text-[11px]"
                  style={{
                    letterSpacing: "0.06em",
                    color: isToday
                      ? "var(--spark-lime)"
                      : cell.inMonth
                        ? "rgba(255,255,255,0.85)"
                        : "rgba(255,255,255,0.35)",
                    fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {cell.day}
                  {isToday && (
                    <span
                      className="ml-1"
                      style={{ color: "var(--spark-lime)" }}
                      title="Today"
                    >
                      •
                    </span>
                  )}
                </span>
                {cell.inMonth && (
                  <button
                    onClick={() =>
                      navigate(`/requests/create?date=${cell.iso}`)
                    }
                    className="mono text-[10px] opacity-0 group-hover:opacity-100 transition"
                    style={{
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,0.55)",
                    }}
                    title={`Create request on ${cell.iso}`}
                  >
                    + NEW
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayRows.slice(0, 3).map((r) => {
                  const palette =
                    STATUS_BG[r.statusSlug.toLowerCase()] ?? STATUS_BG_FALLBACK;
                  return (
                    <button
                      key={r.uuid}
                      onClick={() => clickRow(r)}
                      className="text-left rounded-md px-1.5 py-1 text-[11px] truncate transition"
                      style={{
                        background: palette.bg,
                        border: `1px solid ${palette.bd}`,
                        color: palette.fg,
                      }}
                      title={`${r.venue} · ${r.statusSlug}`}
                    >
                      {r.recapStatus === "submitted" ? "● " : ""}
                      {r.venue || "Untitled"}
                    </button>
                  );
                })}
                {dayRows.length > 3 && (
                  <button
                    onClick={() => clickRow(dayRows[3])}
                    className="mono text-[10px] text-left"
                    style={{
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,0.55)",
                    }}
                    title={dayRows
                      .slice(3)
                      .map((r) => r.venue)
                      .join(", ")}
                  >
                    +{dayRows.length - 3} MORE
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackerCalendar;
