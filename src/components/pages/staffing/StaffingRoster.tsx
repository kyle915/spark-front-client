import { useMemo, useState } from "react";
import {
  byPersonRows,
  staffingFooter,
  type BoardShiftLike,
} from "./staffingByPerson";

/**
 * The week by person: "Needs someone" on top, then one row per ambassador,
 * each shift a card with its venue and hours. Tapping a card opens the same
 * assign sheet the by-venue grid uses.
 */

const SHOWN_PER_CELL = 3;

const ymd = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Props<T extends BoardShiftLike> = {
  days: ReadonlyArray<Date>;
  shifts: ReadonlyArray<T>;
  showBrand: boolean;
  venueOf: (shift: T) => string;
  hoursOf: (shift: T) => string;
  onOpen: (shift: T) => void;
};

export function StaffingRoster<T extends BoardShiftLike>({
  days,
  shifts,
  showBrand,
  venueOf,
  hoursOf,
  onOpen,
}: Props<T>) {
  const { rows, counts } = useMemo(() => byPersonRows(shifts), [shifts]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <div className="overflow-x-auto">
        <div className="spark-roster" role="table" aria-label="Shifts this week by person">
          <div className="spark-roster-row spark-roster-head" role="row">
            <div className="spark-roster-who" role="columnheader">
              Person
            </div>
            {days.map((d) => (
              <div key={ymd(d)} className="spark-roster-day" role="columnheader">
                {d.toLocaleDateString(undefined, { weekday: "short" })}{" "}
                {d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <div key={row.key} className="spark-roster-row" role="row">
              <div className="spark-roster-who" role="rowheader">
                <p className={`spark-roster-name${row.unassigned ? " is-flagged" : ""}`}>
                  {row.name}
                </p>
                <p className="spark-roster-sub">
                  {row.total} {row.total === 1 ? "shift" : "shifts"}
                </p>
              </div>
              {days.map((d) => {
                const day = ymd(d);
                const cellKey = `${row.key}|${day}`;
                const all = row.byDay.get(day) ?? [];
                const open = expanded.has(cellKey);
                const shown = open ? all : all.slice(0, SHOWN_PER_CELL);
                return (
                  <div key={day} className="spark-roster-cell" role="cell">
                    {shown.map((s) => {
                      const hours = hoursOf(s);
                      const pending = row.pending.has(s.eventUuid);
                      return (
                        <button
                          key={s.eventUuid}
                          type="button"
                          onClick={() => onOpen(s)}
                          className={`spark-shiftcard${row.unassigned ? " is-open" : ""}`}
                          title={row.unassigned ? "Assign someone to this shift" : "Open this shift"}
                        >
                          <span className="spark-shiftcard-venue">{venueOf(s)}</span>
                          {hours ? <span className="spark-shiftcard-meta">{hours}</span> : null}
                          {showBrand && s.brandName ? (
                            <span className="spark-shiftcard-meta">{s.brandName}</span>
                          ) : null}
                          {pending ? (
                            <span className="spark-shiftcard-meta is-flagged">
                              Waiting for approval
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                    {all.length > SHOWN_PER_CELL ? (
                      <button
                        type="button"
                        className="spark-roster-more"
                        onClick={() => toggle(cellKey)}
                        aria-expanded={open}
                      >
                        {open ? "Show fewer" : `${all.length - SHOWN_PER_CELL} more`}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="spark-roster-foot">{staffingFooter(counts)}</p>
    </>
  );
}

export default StaffingRoster;
