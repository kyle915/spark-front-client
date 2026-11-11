import { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import { PayrollTimesheetShiftsQuery } from "@/api/queries/PayrollTimesheetShiftsQuery";
import type { PayrollTimesheetShiftsQuery as ShiftsQueryType } from "@api/queries/__generated__/PayrollTimesheetShiftsQuery.graphql";
import AdminPunchControls from "@/components/staffing/AdminPunchControls";

const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
const fmtDay = (ymd: string | null | undefined) => {
  if (!ymd) return "—";
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? ymd
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
const money = (v: number | null | undefined) =>
  typeof v === "number" ? `$${v.toFixed(2)}` : "—";

type Props = {
  startDate: string;
  endDate: string;
  tenantId: string | null;
  ambassadorUuid: string;
  /** Called after a punch edit so the parent totals refetch. */
  onChanged: () => void;
};

const Body: React.FC<Props> = ({ startDate, endDate, tenantId, ambassadorUuid, onChanged }) => {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ShiftsQueryType>(
    PayrollTimesheetShiftsQuery,
    { startDate, endDate, ambassadorUuid, tenantId: tenantId || null },
    { fetchPolicy: "network-only", fetchKey },
  );
  const shifts = data.payrollTimesheetShifts ?? [];
  if (shifts.length === 0) {
    return (
      <p className="text-sm py-2" style={{ color: "var(--spark-text-meta)" }}>
        No approved shifts in this period.
      </p>
    );
  }
  return (
    <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["Date", "Shift", "In", "Out", "Hours", "Rate", "Pay", ""].map((h) => (
            <th
              key={h}
              className="text-xs font-medium px-2 py-1.5 text-left"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {shifts.map((s) => {
          const over =
            typeof s.hours === "number" &&
            typeof s.scheduledHours === "number" &&
            s.hours - s.scheduledHours > 1;
          return (
            <tr key={s.eventUuid} style={{ borderTop: "1px solid var(--spark-border)" }}>
              <td className="px-2 py-2 whitespace-nowrap">{fmtDay(s.date)}</td>
              <td className="px-2 py-2 min-w-0">
                <Link to={`/event/view/${s.eventUuid}`} className="underline">
                  {s.eventName || "Shift"}
                </Link>
                {s.tenantName ? (
                  <span style={{ color: "var(--spark-text-meta)" }}> · {s.tenantName}</span>
                ) : null}
              </td>
              <td className="px-2 py-2 whitespace-nowrap">{fmtTime(s.clockInAt)}</td>
              <td className="px-2 py-2 whitespace-nowrap">
                {s.onTheClock ? (
                  <span style={{ color: "var(--spark-orange)" }}>Still on the clock</span>
                ) : (
                  fmtTime(s.clockOutAt)
                )}
              </td>
              <td className="px-2 py-2 whitespace-nowrap">
                {typeof s.hours === "number" ? s.hours.toFixed(2) : "—"}
                {s.estimated ? (
                  <span
                    title="No clock-in/out pair — using the scheduled length"
                    style={{ color: "var(--spark-gold)" }}
                  >
                    {" "}
                    scheduled
                  </span>
                ) : over ? (
                  <span
                    title={`Scheduled for ${s.scheduledHours?.toFixed(2)} h`}
                    style={{ color: "var(--spark-orange)" }}
                  >
                    {" "}
                    over
                  </span>
                ) : null}
              </td>
              <td className="px-2 py-2 whitespace-nowrap">
                {typeof s.rate === "number" ? `$${s.rate.toFixed(2)}/h` : "No rate"}
              </td>
              <td className="px-2 py-2 whitespace-nowrap font-semibold">{money(s.pay)}</td>
              <td className="px-2 py-2">
                <AdminPunchControls
                  eventUuid={s.eventUuid}
                  ambassadorUuid={ambassadorUuid}
                  clockInAt={s.clockInAt}
                  clockOutAt={s.clockOutAt}
                  clockInAttendanceUuid={s.clockInAttendanceUuid}
                  clockOutAttendanceUuid={s.clockOutAttendanceUuid}
                  onDone={() => {
                    setFetchKey((k) => k + 1);
                    onChanged();
                  }}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

/** Expanded detail under a Timesheet row: every shift behind the total. */
export const TimesheetShiftRows: React.FC<Props> = (props) => (
  <div
    className="rounded-xl px-3 py-2 overflow-x-auto"
    style={{ background: "rgba(var(--spark-ink-rgb),0.03)", border: "1px solid var(--spark-border)" }}
  >
    <Suspense
      fallback={
        <p className="text-sm py-2" style={{ color: "var(--spark-text-meta)" }}>
          Loading shifts…
        </p>
      }
    >
      <Body {...props} />
    </Suspense>
  </div>
);

export default TimesheetShiftRows;
