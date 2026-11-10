import { PanelSkeleton } from "@/layout/PageSkeletons";
import { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { EventAttendanceQuery } from "@/api/queries/EventAttendanceQuery";
import type { EventAttendanceQuery as EventAttendanceQueryType } from "@api/queries/__generated__/EventAttendanceQuery.graphql";
import AdminPunchControls from "@/components/staffing/AdminPunchControls";

/**
 * Attendance table for an event — the actual clock log behind the GPS
 * replay: each BA's arrive / clock-in / clock-out times, on-site hours,
 * and a map link to the coords captured at each punch. Admins can
 * manually clock in, clock out open punches, or edit times when a BA's
 * check-in fails.
 *
 * Sits beside ShiftReplayPanel on /request/view + the Event detail page.
 */

const fmtClock = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const mapsHref = (
  coords: readonly number[] | null | undefined,
): string | null => {
  if (!coords || coords.length < 2) return null;
  return `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`;
};

const Cell: React.FC<{
  label: string;
  coords?: readonly number[] | null;
}> = ({ label, coords }) => {
  const href = mapsHref(coords);
  return (
    <span>
      <span style={{ color: label === "—" ? "rgba(255,255,255,0.35)" : "#fff" }}>
        {label}
      </span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1.5"
          style={{ color: "var(--spark-sky, #5fb8ef)", fontSize: 10 }}
          title="View clock-in/out location"
        >
          ⌖ map
        </a>
      )}
    </span>
  );
};

const Inner: React.FC<{ eventUuid: string; refreshKey: number; bump: () => void }> = ({
  eventUuid,
  refreshKey,
  bump,
}) => {
  const data = useLazyLoadQuery<EventAttendanceQueryType>(
    EventAttendanceQuery,
    { eventUuid },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const rows = data.eventAttendance ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="spark-card p-5">
      <p
        className="mono text-[10px] mb-3"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        ATTENDANCE · CLOCK LOG
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                color: "rgba(255,255,255,0.5)",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <th className="text-left py-2 pr-3 font-normal">Ambassador</th>
              <th className="text-left py-2 pr-3 font-normal">Arrived</th>
              <th className="text-left py-2 pr-3 font-normal">Clock in</th>
              <th className="text-left py-2 pr-3 font-normal">Clock out</th>
              <th className="text-right py-2 pr-3 font-normal">Hrs</th>
              <th className="text-left py-2 font-normal">Fix</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.ambassadorUuid}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                <td className="py-2 pr-3 font-semibold">{r.ambassadorName}</td>
                <td className="py-2 pr-3">
                  <Cell label={fmtClock(r.arrivedAt)} />
                </td>
                <td className="py-2 pr-3">
                  <Cell
                    label={fmtClock(r.clockInAt)}
                    coords={r.clockInCoordinates}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Cell
                    label={fmtClock(r.clockOutAt)}
                    coords={r.clockOutCoordinates}
                  />
                </td>
                <td
                  className="py-2 pr-3 text-right mono"
                  style={{ color: "var(--spark-lime, #f2f3ee)" }}
                >
                  {r.hoursOnSite != null ? r.hoursOnSite.toFixed(2) : "—"}
                </td>
                <td className="py-2">
                  <AdminPunchControls
                    eventUuid={eventUuid}
                    ambassadorUuid={r.ambassadorUuid}
                    clockInAt={r.clockInAt}
                    clockOutAt={r.clockOutAt}
                    clockInAttendanceUuid={r.clockInAttendanceUuid}
                    clockOutAttendanceUuid={r.clockOutAttendanceUuid}
                    onDone={bump}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const EventAttendanceTable: React.FC<{ eventUuid: string }> = ({
  eventUuid,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  if (!eventUuid) return null;
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Inner
        eventUuid={eventUuid}
        refreshKey={refreshKey}
        bump={() => setRefreshKey((k) => k + 1)}
      />
    </Suspense>
  );
};

export default EventAttendanceTable;
