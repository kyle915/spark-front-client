import { Fragment, Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import { PayrollTimesheetShiftsQuery } from "@/api/queries/PayrollTimesheetShiftsQuery";
import type { PayrollTimesheetShiftsQuery as ShiftsQueryType } from "@api/queries/__generated__/PayrollTimesheetShiftsQuery.graphql";
import AdminPunchControls from "@/components/staffing/AdminPunchControls";
import { fmtTimeInZone, zoneShortName } from "@/utils/venueDay";
import { ShiftFlagChip, ShiftFlagList } from "./HoursCheck";
import type { HoursShift } from "./hoursCheckData";

// Punch times on the venue's clock: a 9 PM Eastern clock-out reads 9 PM for a
// Pacific admin too.
const fmtTime = (iso: string | null | undefined, timeZone: string | null | undefined) =>
  fmtTimeInZone(iso, timeZone);
const fmtDay = (ymd: string | null | undefined) => {
  if (!ymd) return "—";
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? ymd
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
/** "ET" after a venue time, so nobody reads it as their own clock. */
const ZoneTag: React.FC<{ iso: string | null | undefined; timeZone: string | null | undefined }> = ({
  iso,
  timeZone,
}) =>
  iso && timeZone ? (
    <span style={{ color: "var(--spark-text-meta)" }}>
      {" "}
      {zoneShortName(timeZone, new Date(iso))}
    </span>
  ) : null;

const money = (v: number | null | undefined) =>
  typeof v === "number" ? `$${v.toFixed(2)}` : "—";

type Props = {
  startDate: string;
  endDate: string;
  tenantId: string | null;
  ambassadorUuid: string;
  /** This BA's flagged shifts from the hours check (absent = none flagged). */
  hoursShifts?: readonly HoursShift[];
  /** Called after a punch edit so the parent totals refetch. */
  onChanged: () => void;
};

const Body: React.FC<Props> = ({ startDate, endDate, tenantId, ambassadorUuid, hoursShifts, onChanged }) => {
  const [fetchKey, setFetchKey] = useState(0);
  const flagged = new Map((hoursShifts ?? []).map((h) => [h.eventUuid, h]));
  // Which shift's flags are open; shifts that still need a look start open.
  const [openFlags, setOpenFlags] = useState<Set<string>>(
    () => new Set((hoursShifts ?? []).filter((h) => h.needsLook).map((h) => h.eventUuid)),
  );
  const toggleFlags = (uuid: string) =>
    setOpenFlags((cur) => {
      const next = new Set(cur);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
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
          {["Date", "Shift", "In", "Out", "Hours", "Rate", "Pay", "Check", ""].map((h) => (
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
          const hs = flagged.get(s.eventUuid);
          const flagsOpen = !!hs && openFlags.has(s.eventUuid);
          return (
            <Fragment key={s.eventUuid}>
            <tr style={{ borderTop: "1px solid var(--spark-border)" }}>
              <td className="px-2 py-2 whitespace-nowrap">{fmtDay(s.date)}</td>
              <td className="px-2 py-2 min-w-0">
                <Link to={`/event/view/${s.eventUuid}`} className="underline">
                  {s.eventName || "Shift"}
                </Link>
                {s.tenantName ? (
                  <span style={{ color: "var(--spark-text-meta)" }}> · {s.tenantName}</span>
                ) : null}
                {s.address && !(s.eventName || "").includes(s.address) ? (
                  <div className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                    Location: {s.address}
                  </div>
                ) : null}
              </td>
              <td className="px-2 py-2 whitespace-nowrap">
                {fmtTime(s.clockInAt, s.timeZone)}
                <ZoneTag iso={s.clockInAt} timeZone={s.timeZone} />
              </td>
              <td className="px-2 py-2 whitespace-nowrap">
                {s.onTheClock ? (
                  <span style={{ color: "var(--spark-orange)" }}>Still on the clock</span>
                ) : (
                  <>
                    {fmtTime(s.clockOutAt, s.timeZone)}
                    <ZoneTag iso={s.clockOutAt} timeZone={s.timeZone} />
                  </>
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
                <ShiftFlagChip shift={hs} open={flagsOpen} onToggle={() => toggleFlags(s.eventUuid)} />
              </td>
              <td className="px-2 py-2">
                <AdminPunchControls
                  eventUuid={s.eventUuid}
                  ambassadorUuid={ambassadorUuid}
                  clockInAt={s.clockInAt}
                  clockOutAt={s.clockOutAt}
                  clockInAttendanceUuid={s.clockInAttendanceUuid}
                  clockOutAttendanceUuid={s.clockOutAttendanceUuid}
                  timeZone={s.timeZone}
                  onDone={() => {
                    setFetchKey((k) => k + 1);
                    onChanged();
                  }}
                />
              </td>
            </tr>
            {hs && flagsOpen ? (
              <tr>
                <td colSpan={9} className="px-2 pb-2">
                  <ShiftFlagList shift={hs} tenantId={tenantId || ""} onChanged={onChanged} />
                </td>
              </tr>
            ) : null}
            </Fragment>
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
