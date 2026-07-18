import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { StaffingBoardQuery } from "@/api/queries/StaffingBoardQuery";
import type { StaffingBoardQuery as StaffingBoardQueryType } from "@api/queries/__generated__/StaffingBoardQuery.graphql";
import InviteBAModal from "@/requests/InviteBAModal";

/**
 * Staffing Board — a week grid of shifts × dates so an admin can see who's
 * assigned where at a glance and fill gaps fast. Rows = venue (store/event),
 * columns = the 7 days in view. An empty/under-staffed cell opens the existing
 * assign flow (InviteBAModal, which defaults to "Assign now"). Unstaffed shifts
 * are counted + highlighted so gaps can't hide.
 */
type Shift = StaffingBoardQueryType["response"]["staffingBoard"][number];

// Local YYYY-MM-DD for a Date (grid columns + query range), no tz surprises.
const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Bucket key for a shift's date — take the calendar day verbatim off the ISO
// string (event.date is midnight UTC; slicing avoids a tz shift).
const shiftDayKey = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  return String(iso).slice(0, 10);
};

const fmtTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(":00", "");
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "BA";

type AssignTarget = {
  eventId: string;
  eventDate: string | null;
  eventAddress: string | null;
  alreadyIds: string[];
};

const Inner: React.FC<{
  weekStart: Date;
  refreshKey: number;
  onAssigned: () => void;
}> = ({ weekStart, refreshKey, onAssigned }) => {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );
  const startDate = ymd(days[0]);
  const endDate = ymd(days[6]);

  const data = useLazyLoadQuery<StaffingBoardQueryType>(
    StaffingBoardQuery,
    { startDate, endDate },
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );
  const shifts: Shift[] = (data?.staffingBoard ?? []).filter(Boolean) as Shift[];

  const [assign, setAssign] = useState<AssignTarget | null>(null);

  // Group into rows by venue (store || event name), keep the brand for the
  // row label, and index each shift by its day so cell lookup is O(1).
  const { rows, byRowDay, unstaffed } = useMemo(() => {
    const rowMap = new Map<
      string,
      { key: string; label: string; brand: string }
    >();
    const cell = new Map<string, Shift[]>(); // `${rowKey}|${dayKey}` → shifts
    let unstaffedCount = 0;
    for (const s of shifts) {
      const label = s.store || s.eventName || "(shift)";
      const rowKey = `${s.brandName}::${label}`;
      if (!rowMap.has(rowKey))
        rowMap.set(rowKey, { key: rowKey, label, brand: s.brandName });
      const dayKey = shiftDayKey(s.date);
      if (dayKey) {
        const k = `${rowKey}|${dayKey}`;
        const arr = cell.get(k) ?? [];
        arr.push(s);
        cell.set(k, arr);
      }
      if (!s.isStaffed) unstaffedCount += 1;
    }
    const rowList = [...rowMap.values()].sort((a, b) =>
      (a.brand + a.label).localeCompare(b.brand + b.label),
    );
    return { rows: rowList, byRowDay: cell, unstaffed: unstaffedCount };
  }, [shifts]);

  const openAssign = (s: Shift) =>
    setAssign({
      eventId: s.eventId,
      eventDate: s.date ?? null,
      eventAddress: s.address ?? null,
      alreadyIds: s.assigned.map((a) => a.ambassadorId),
    });

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span
          className="mono text-[11px]"
          style={{
            letterSpacing: "0.14em",
            color:
              unstaffed > 0 ? "var(--spark-orange)" : "var(--spark-lime)",
            background:
              unstaffed > 0 ? "rgba(239,90,42,0.12)" : "rgba(197,245,70,0.1)",
            border: `1px solid ${unstaffed > 0 ? "rgba(239,90,42,0.35)" : "rgba(197,245,70,0.3)"}`,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {unstaffed > 0
            ? `${unstaffed} SHIFT${unstaffed === 1 ? "" : "S"} UNSTAFFED`
            : "ALL SHIFTS STAFFED ✓"}
        </span>
        <span
          className="mono text-[11px]"
          style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}
        >
          {shifts.length} SHIFT{shifts.length === 1 ? "" : "S"} THIS WEEK
        </span>
      </div>

      {rows.length === 0 ? (
        <p
          className="p-10 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          No shifts scheduled this week.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 900 }}>
            {/* Header row: venue + 7 days */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: "200px repeat(7, minmax(112px, 1fr))",
                borderBottom: "1px solid var(--spark-border)",
              }}
            >
              <div
                className="mono text-[10px] px-3 py-2"
                style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.4)" }}
              >
                VENUE
              </div>
              {days.map((d) => (
                <div
                  key={ymd(d)}
                  className="mono text-[10px] px-2 py-2 text-center"
                  style={{
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.55)",
                    borderLeft: "1px solid var(--spark-border)",
                  }}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                  <br />
                  <span style={{ color: "rgba(255,255,255,0.35)" }}>
                    {d.toLocaleDateString(undefined, {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>

            {/* Body rows */}
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid"
                style={{
                  gridTemplateColumns: "200px repeat(7, minmax(112px, 1fr))",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                <div className="px-3 py-2 min-w-0">
                  <p className="text-sm font-medium truncate">{row.label}</p>
                  <p
                    className="mono text-[9px] truncate"
                    style={{
                      letterSpacing: "0.1em",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    {row.brand}
                  </p>
                </div>
                {days.map((d) => {
                  const cellShifts =
                    byRowDay.get(`${row.key}|${ymd(d)}`) ?? [];
                  return (
                    <div
                      key={ymd(d)}
                      className="px-1.5 py-1.5 flex flex-col gap-1.5"
                      style={{ borderLeft: "1px solid var(--spark-border)" }}
                    >
                      {cellShifts.map((s) => (
                        <div
                          key={s.eventUuid}
                          className="rounded-lg p-1.5"
                          style={{
                            background: s.isStaffed
                              ? "rgba(197,245,70,0.06)"
                              : "rgba(239,90,42,0.06)",
                            border: `1px solid ${s.isStaffed ? "rgba(197,245,70,0.2)" : "rgba(239,90,42,0.25)"}`,
                          }}
                        >
                          {s.startTime ? (
                            <p
                              className="mono text-[9px] mb-1"
                              style={{ color: "rgba(255,255,255,0.5)" }}
                            >
                              {fmtTime(s.startTime)}
                              {s.endTime ? `–${fmtTime(s.endTime)}` : ""}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-1 mb-1">
                            {s.assigned.map((a) => (
                              <span
                                key={a.ambassadorUuid}
                                title={`${a.name}${a.isApproved ? "" : " (pending)"}`}
                                className="grid place-items-center rounded-full text-[9px] font-bold"
                                style={{
                                  width: 20,
                                  height: 20,
                                  background: a.isApproved
                                    ? "var(--spark-lime)"
                                    : "rgba(255,196,0,0.2)",
                                  color: a.isApproved
                                    ? "#0a0d09"
                                    : "var(--spark-gold)",
                                  border: a.isApproved
                                    ? "none"
                                    : "1px solid var(--spark-gold)",
                                }}
                              >
                                {initials(a.name)}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => openAssign(s)}
                            className="mono text-[9px] w-full rounded"
                            style={{
                              letterSpacing: "0.08em",
                              padding: "3px 0",
                              color: s.isStaffed
                                ? "rgba(255,255,255,0.55)"
                                : "var(--spark-lime)",
                              background: s.isStaffed
                                ? "transparent"
                                : "rgba(197,245,70,0.1)",
                              border: `1px solid ${s.isStaffed ? "var(--spark-border)" : "rgba(197,245,70,0.3)"}`,
                            }}
                          >
                            {s.assigned.length === 0 ? "+ ASSIGN" : "+ ADD"}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {assign && (
        <InviteBAModal
          eventId={assign.eventId}
          alreadyInvitedAmbassadorIds={assign.alreadyIds}
          eventDate={assign.eventDate}
          eventAddress={assign.eventAddress}
          onClose={() => setAssign(null)}
          onInvited={() => {
            onAssigned();
          }}
        />
      )}
    </>
  );
};

export default function SparkStaffingBoard() {
  // Start the window on the Monday of the current week.
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - dow);
    return d;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  const shift = (weeks: number) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + weeks * 7);
    setWeekStart(d);
  };

  const rangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(weekStart)} – ${fmt(end)}`;
  }, [weekStart]);

  return (
    <div className="p-5 md:p-8">
      <p
        className="mono text-[10px] mb-1"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        WORKSPACE
      </p>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="display text-2xl font-bold">Staffing Board</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Who's on which shift this week. Tap a slot to assign.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            ← Prev
          </button>
          <span
            className="mono text-[12px] px-2"
            style={{ letterSpacing: "0.06em", color: "var(--spark-text)" }}
          >
            {rangeLabel}
          </span>
          <button
            onClick={() => shift(1)}
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Next →
          </button>
        </div>
      </div>

      <Suspense
        fallback={
          <p
            className="p-10 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading the week…
          </p>
        }
      >
        <Inner weekStart={weekStart} refreshKey={refreshKey} onAssigned={bump} />
      </Suspense>
    </div>
  );
}
