import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { LiveShiftBoardQuery } from "@/api/queries/LiveShiftBoardQuery";
import type { LiveShiftBoardQuery as LiveShiftBoardQueryType } from "@api/queries/__generated__/LiveShiftBoardQuery.graphql";

/**
 * Live "on the clock" board — today's shifts and who's actually working right
 * now. Each BA is a status-colored chip: green = on the clock, blue = done,
 * red = no-show, amber = not clocked in yet, grey = upcoming. The read-side
 * companion to the no-show radar. Auto-refreshes every 60s.
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
  upcoming: { label: "Upcoming", fg: "rgba(255,255,255,0.6)", bg: "rgba(255,255,255,0.05)", border: "var(--spark-border)" },
};

const fmtTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(":00", "");
};

const BAChip: React.FC<{ ba: BA }> = ({ ba }) => {
  const s = STATUS[ba.status] ?? STATUS.upcoming;
  const clock =
    ba.status === "clocked_in" && ba.clockInAt
      ? ` · in ${fmtTime(ba.clockInAt)}`
      : ba.status === "clocked_out" && ba.workedHours != null
        ? ` · ${ba.workedHours}h`
        : "";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-[12px]"
      style={{
        padding: "4px 10px",
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
      }}
      title={`${ba.name} — ${s.label}`}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: s.fg,
          opacity: ba.status === "clocked_in" ? 1 : 0.8,
        }}
      />
      {ba.name}
      <span style={{ opacity: 0.7 }}>{clock}</span>
    </span>
  );
};

const Inner: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const data = useLazyLoadQuery<LiveShiftBoardQueryType>(
    LiveShiftBoardQuery,
    {},
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );
  const shifts: Shift[] = (data?.liveShiftBoard ?? []).filter(Boolean) as Shift[];

  const { onClock, noShows } = useMemo(() => {
    let oc = 0;
    let ns = 0;
    for (const s of shifts) {
      oc += s.onClock;
      ns += s.noShows;
    }
    return { onClock: oc, noShows: ns };
  }, [shifts]);

  return (
    <>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span
          className="mono text-[11px]"
          style={{
            letterSpacing: "0.12em",
            color: "var(--spark-lime)",
            background: "rgba(197,245,70,0.1)",
            border: "1px solid rgba(197,245,70,0.3)",
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
            color: noShows > 0 ? "var(--spark-orange)" : "rgba(255,255,255,0.45)",
            background: noShows > 0 ? "rgba(239,90,42,0.12)" : "transparent",
            border: `1px solid ${noShows > 0 ? "rgba(239,90,42,0.4)" : "var(--spark-border)"}`,
            padding: "4px 12px",
            borderRadius: 999,
          }}
        >
          {noShows} NO-SHOW{noShows === 1 ? "" : "S"}
        </span>
      </div>

      {shifts.length === 0 ? (
        <p
          className="p-10 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          No staffed shifts today.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {shifts.map((s) => (
            <div
              key={s.eventUuid}
              className="rounded-2xl p-4"
              style={{
                background: "var(--spark-panel, rgba(255,255,255,0.02))",
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
                    style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)" }}
                  >
                    {s.brandName}
                    {s.startTime ? ` · ${fmtTime(s.startTime)}` : ""}
                    {s.endTime ? `–${fmtTime(s.endTime)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.assigned.map((ba) => (
                  <BAChip key={ba.ambassadorUuid} ba={ba} />
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
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        WORKSPACE
      </p>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="display text-2xl font-bold">On the clock</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
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

      <Suspense
        fallback={
          <p
            className="p-10 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading today…
          </p>
        }
      >
        <Inner refreshKey={refreshKey} />
      </Suspense>
    </div>
  );
}
