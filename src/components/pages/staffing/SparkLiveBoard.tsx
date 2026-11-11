import { Link } from "react-router";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { LiveShiftBoardQuery } from "@/api/queries/LiveShiftBoardQuery";
import type { LiveShiftBoardQuery as LiveShiftBoardQueryType } from "@api/queries/__generated__/LiveShiftBoardQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import AdminPunchControls from "@/components/staffing/AdminPunchControls";

/**
 * Live "on the clock" board — today's shifts and who's actually working right
 * now. One row per BA: status dot (green = on the clock, blue = done, red =
 * no-show, amber = not clocked in yet, grey = upcoming), clock times, worked
 * hours, and their last GPS fix. The read-side companion to the no-show
 * radar. Auto-refreshes every 60s.
 *
 * Scoped to the tenant you're currently viewing. It used to pass no tenantId
 * at all, which for an Ignite admin meant "every client" — so the Total
 * Wireless tab showed Feel Free shifts.
 */
type Shift = LiveShiftBoardQueryType["response"]["liveShiftBoard"][number];
type BA = Shift["assigned"][number];

const STATUS: Record<
  string,
  { label: string; fg: string; bg: string; border: string }
> = {
  clocked_in: { label: "On the clock", fg: "#0a0d09", bg: "var(--spark-lime)", border: "var(--spark-lime)" },
  clocked_out: { label: "Done", fg: "var(--spark-sky, #6db3f2)", bg: "rgba(109,179,242,0.12)", border: "rgba(109,179,242,0.4)" },
  no_show: { label: "No-show", fg: "var(--spark-orange)", bg: "rgba(239,90,42,0.14)", border: "rgba(239,90,42,0.5)" },
  missed: { label: "Missed", fg: "var(--spark-orange)", bg: "rgba(239,90,42,0.1)", border: "rgba(239,90,42,0.35)" },
  awaiting: { label: "Not in yet", fg: "var(--spark-gold)", bg: "rgba(255,196,0,0.12)", border: "rgba(255,196,0,0.45)" },
  upcoming: { label: "Upcoming", fg: "rgba(var(--spark-ink-rgb),0.6)", bg: "rgba(var(--spark-ink-rgb),0.05)", border: "var(--spark-border)" },
};

const fmtTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(":00", "");
};

/** "just now" / "12m ago" / "3h ago" — how stale the GPS fix is. */
const fmtAgo = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

/** Clock times as one readable span: "3:55p → 7:02p" / "in at 3:55p". */
const clockLabel = (ba: BA): string => {
  const inAt = fmtTime(ba.clockInAt);
  const outAt = fmtTime(ba.clockOutAt);
  if (inAt && outAt) return `${inAt} → ${outAt}`;
  if (inAt) return `in at ${inAt}`;
  return "";
};

const BARow: React.FC<{
  ba: BA;
  eventUuid: string;
  onPunchChange: () => void;
}> = ({ ba, eventUuid, onPunchChange }) => {
  const s = STATUS[ba.status] ?? STATUS.upcoming;
  const times = clockLabel(ba);
  const hasFix = ba.lat != null && ba.lng != null;
  return (
    <div
      className="flex items-center gap-3 flex-wrap py-1.5"
      style={{ borderTop: "1px solid var(--spark-border)" }}
    >
      <span
        className="inline-flex items-center gap-1.5 text-[13px] min-w-0"
        style={{ flex: "1 1 11rem" }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: s.fg,
            flexShrink: 0,
            opacity: ba.status === "clocked_in" ? 1 : 0.75,
          }}
        />
        <span className="truncate">{ba.name}</span>
      </span>

      <span
        className="mono text-[10px] whitespace-nowrap"
        style={{ letterSpacing: "0.1em", color: s.fg }}
      >
        {s.label.toUpperCase()}
      </span>

      {times && (
        <span
          className="mono text-[11px] whitespace-nowrap tabular-nums"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {times}
        </span>
      )}

      {ba.workedHours != null && (
        <span
          className="mono text-[11px] whitespace-nowrap tabular-nums"
          style={{ color: "var(--spark-text-meta)" }}
        >
          {ba.workedHours}h
        </span>
      )}

      {hasFix ? (
        <a
          href={`https://www.google.com/maps?q=${ba.lat},${ba.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[11px] whitespace-nowrap"
          style={{ color: "var(--spark-lime)", textDecoration: "underline" }}
          title={`${ba.lat}, ${ba.lng}${
            ba.locationSource ? ` · ${ba.locationSource}` : ""
          }`}
        >
          Map
          {ba.locationAt ? (
            <span style={{ opacity: 0.65 }}> · {fmtAgo(ba.locationAt)}</span>
          ) : null}
        </a>
      ) : (
        <span
          className="mono text-[11px] whitespace-nowrap"
          style={{ color: "var(--spark-text-meta)" }}
          title="No GPS fix — the BA declined location or the browser never got one"
        >
          no GPS
        </span>
      )}

      {ba.pendingApproval && (
        <span
          className="mono text-[9px] whitespace-nowrap"
          style={{
            letterSpacing: "0.12em",
            color: "var(--spark-gold)",
            border: "1px solid rgba(255,196,0,0.4)",
            borderRadius: 999,
            padding: "2px 7px",
          }}
          title="Walk-up — hours log when you approve their recap"
        >
          PENDING RECAP
        </span>
      )}

      <AdminPunchControls
        eventUuid={eventUuid}
        ambassadorUuid={ba.ambassadorUuid}
        status={ba.status}
        clockInAt={ba.clockInAt}
        clockOutAt={ba.clockOutAt}
        onDone={onPunchChange}
      />
    </div>
  );
};

const Inner: React.FC<{
  refreshKey: number;
  tenantId: string;
  bump: () => void;
}> = ({
  refreshKey,
  tenantId,
  bump,
}) => {
  const data = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    { tenantId },
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );
  const shifts: Shift[] = (data?.liveShiftBoard ?? []).filter(Boolean) as Shift[];

  const { onClock, noShows, pending } = useMemo(() => {
    let oc = 0;
    let ns = 0;
    let pa = 0;
    for (const s of shifts) {
      oc += s.onClock;
      ns += s.noShows;
      pa += s.pendingApproval;
    }
    return { onClock: oc, noShows: ns, pending: pa };
  }, [shifts]);

  return (
    <>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span
          className="mono text-[11px]"
          style={{
            letterSpacing: "0.12em",
            color: "var(--spark-lime)",
            background: "rgba(var(--spark-accent-rgb),0.1)",
            border: "1px solid rgba(var(--spark-accent-rgb),0.3)",
            padding: "4px 12px",
            borderRadius: 999,
          }}
        >
          {onClock} ON THE CLOCK
        </span>
        <span
          className="mono text-[11px]"
          style={{
            letterSpacing: "0.12em",
            color: noShows > 0 ? "var(--spark-orange)" : "rgba(var(--spark-ink-rgb),0.45)",
            background: noShows > 0 ? "rgba(239,90,42,0.12)" : "transparent",
            border: `1px solid ${noShows > 0 ? "rgba(239,90,42,0.4)" : "var(--spark-border)"}`,
            padding: "4px 12px",
            borderRadius: 999,
          }}
        >
          {noShows} NO-SHOW{noShows === 1 ? "" : "S"}
        </span>
        {pending > 0 && (
          <span
            className="mono text-[11px]"
            style={{
              letterSpacing: "0.12em",
              color: "var(--spark-gold)",
              background: "rgba(255,196,0,0.1)",
              border: "1px solid rgba(255,196,0,0.35)",
              padding: "4px 12px",
              borderRadius: 999,
            }}
            title="Walk-ups from the check-in link — hours log when you approve their recap"
          >
            {pending} AWAITING RECAP
          </span>
        )}
      </div>

      {shifts.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
            No staffed shifts today.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              to="/schedule"
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
            >
              Open the Staffing Board
            </Link>
            <Link
              to="/upcoming"
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ color: "var(--spark-text)", border: "1px solid var(--spark-border)" }}
            >
              See upcoming events
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shifts.map((s) => (
            <div
              key={s.eventUuid}
              className="rounded-2xl p-4"
              style={{
                background: "var(--spark-panel, rgba(var(--spark-ink-rgb),0.02))",
                border: `1px solid ${s.noShows > 0 ? "rgba(239,90,42,0.3)" : "var(--spark-border)"}`,
              }}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {s.store || s.eventName}
                  </p>
                  <p
                    className="mono text-[10px]"
                    style={{ letterSpacing: "0.1em", color: "var(--spark-text-meta)" }}
                  >
                    {s.brandName}
                    {s.startTime ? ` · ${fmtTime(s.startTime)}` : ""}
                    {s.endTime ? `–${fmtTime(s.endTime)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-col">
                {s.assigned.map((ba) => (
                  <BARow
                    key={ba.ambassadorUuid}
                    ba={ba}
                    eventUuid={s.eventUuid}
                    onPunchChange={bump}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default function SparkLiveBoard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { tenantId } = useAuthStore();

  // Live board: auto-refresh every 60s so it stays current without a reload.
  useEffect(() => {
    const id = window.setInterval(() => setRefreshKey((k) => k + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  return (
    <div className="p-5 md:p-8">
      <p
        className="mono text-[10px] mb-1"
        style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
      >
        WORKSPACE
      </p>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="display text-2xl font-bold">On the clock</h1>
          <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
            Who's working right now — {today}. Live, refreshes on its own.
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="px-3 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {!tenantId ? (
        <p
          className="p-10 text-center text-sm"
          style={{ color: "var(--spark-text-meta)" }}
        >
          Pick a client to see who's on the clock.
        </p>
      ) : (
        <Suspense
          fallback={
            <p
              className="p-10 text-center text-sm"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Loading today…
            </p>
          }
        >
          <Inner
            refreshKey={refreshKey}
            tenantId={tenantId}
            bump={() => setRefreshKey((k) => k + 1)}
          />
        </Suspense>
      )}
    </div>
  );
}
