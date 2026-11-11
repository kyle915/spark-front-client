import type { FmEvent } from "./fieldMarketingTypes";
import { isBooked, rowStatus } from "./fieldMarketingRules";

type Props = {
  month: string;
  events: FmEvent[];
  onMonth: (month: string) => void;
};

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const cursor = new Date(y, (m || 1) - 1 + delta, 1);
  return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function FieldMarketingCalendar({ month, events, onMonth }: Props) {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(year, (mon || 1) - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, mon || 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<number, FmEvent[]>();
  for (const row of events) {
    if (!row.startsOn.startsWith(month)) continue;
    const day = Number(row.startsOn.slice(8, 10));
    const list = byDay.get(day) ?? [];
    list.push(row);
    byDay.set(day, list);
  }

  return (
    <section className="rounded-xl border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          className="spark-btn-ghost"
          onClick={() => onMonth(shiftMonth(month, -1))}
        >
          Prev
        </button>
        <p className="spark-title text-lg">{monthLabel(month)}</p>
        <button
          type="button"
          className="spark-btn-ghost"
          onClick={() => onMonth(shiftMonth(month, 1))}
        >
          Next
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px] uppercase tracking-wider opacity-50 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="px-1 py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          const rows = day ? byDay.get(day) ?? [] : [];
          return (
            <div
              key={`${month}-${index}`}
              className="min-h-24 rounded-lg border border-white/10 p-1.5"
              style={{ background: day ? "var(--spark-bg)" : "transparent" }}
            >
              {day ? (
                <>
                  <p className="text-xs tabular-nums opacity-60">{day}</p>
                  <ul className="mt-1 space-y-1">
                    {rows.map((row) => {
                      const booked = isBooked(row);
                      return (
                        <li
                          key={row.id}
                          className="text-[11px] leading-snug rounded px-1 py-0.5"
                          style={{
                            color: booked ? "#f2f3ee" : "rgba(var(--spark-ink-rgb),0.72)",
                            background: "rgba(var(--spark-ink-rgb),0.04)",
                          }}
                          title={`${row.activityLabel} · ${row.marketLabel}`}
                        >
                          <span className="block truncate">{row.name}</span>
                          <span className="block opacity-70">
                            {booked ? "Booked" : rowStatus(row)}
                            {row.marketLabel ? ` · ${row.marketLabel}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
