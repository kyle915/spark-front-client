import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Spark v2 — Shifts Board, Google-Calendar style.
 *
 * Hourly time column on the left, day columns across. Events are
 * absolutely positioned in their day column based on start/end times
 * (height = duration). Each event chip shows its own time range inline,
 * the way Google Calendar does.
 */

type ShiftKind = "retail" | "onprem" | "event";

const KIND_COLOR: Record<ShiftKind, string> = {
  retail: "var(--spark-lime)",
  onprem: "var(--spark-purple)",
  event: "var(--spark-sky)",
};

type Shift = {
  uuid: string;
  title: string;
  market: string;
  startHour: number; // float hours (e.g. 13.5)
  endHour: number;
  startLabel: string;
  endLabel: string;
  kind: ShiftKind;
  dayIndex: number;
};

const HOUR_START = 7; // 7 AM
const HOUR_END = 23; // 11 PM
const HOUR_PX = 56; // 56px per hour row (matches Google's compact week view)

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

const weekDays = (anchor: Date) => {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const monthLabel = (d: Date) =>
  d.toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const parseHour = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  // startTime/endTime arrive as a full venue-local datetime (e.g.
  // "2026-05-29T07:00:00") or a bare "HH:MM". Grab the time-of-day portion —
  // a plain split(":") turned "2026-05-29T07:00:00" into parseInt("…T07")=2026,
  // which clamped every event to the bottom of the grid (~10:45p).
  const match = String(raw).match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (Number.isNaN(hh)) return null;
  return hh + mm / 60;
};

const fmtHour12 = (h: number): string => {
  const wholeH = Math.floor(h);
  const mins = Math.round((h - wholeH) * 60);
  const ampm = wholeH >= 12 ? "p" : "a";
  const h12 = ((wholeH + 11) % 12) + 1;
  return mins === 0 ? `${h12}${ampm}` : `${h12}:${String(mins).padStart(2, "0")}${ampm}`;
};

const fmtHourLabel = (h: number): string => {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12} ${ampm}`;
};

const inferKind = (label: string | null | undefined): ShiftKind => {
  const s = (label ?? "").toLowerCase();
  if (
    s.includes("retail") ||
    s.includes("whole foods") ||
    s.includes("trader joe") ||
    s.includes("kroger") ||
    s.includes("walmart") ||
    s.includes("circle k") ||
    s.includes("7 eleven") ||
    s.includes("target")
  )
    return "retail";
  if (s.includes("on-prem") || s.includes("on prem") || s.includes("bar"))
    return "onprem";
  return "event";
};

/* ───────────────── grid ───────────────── */

const TimeGrid: React.FC<{ shifts: Shift[]; days: Date[] }> = ({
  shifts,
  days,
}) => {
  const navigate = useNavigate();
  const today = new Date();
  const hours = useMemo(
    () =>
      Array.from(
        { length: HOUR_END - HOUR_START + 1 },
        (_, i) => HOUR_START + i,
      ),
    [],
  );

  return (
    <div
      className="spark-card overflow-hidden"
      style={{ borderRadius: 22 }}
    >
      {/* Day headers */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "70px repeat(7, 1fr)",
          borderBottom: "1px solid var(--spark-border)",
        }}
      >
        <div />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className="px-3 py-3 text-center"
              style={{
                borderLeft: "1px solid var(--spark-border)",
              }}
            >
              <p
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: isToday
                    ? "var(--spark-lime)"
                    : "rgba(255,255,255,0.45)",
                }}
              >
                {d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </p>
              <p
                className="display tab-num font-bold mt-0.5"
                style={{
                  fontSize: 22,
                  letterSpacing: "-0.03em",
                  color: isToday
                    ? "var(--spark-lime)"
                    : "var(--spark-text)",
                }}
              >
                {d.getDate()}
              </p>
              {isToday && (
                <p
                  className="mono mt-0.5"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    color: "var(--spark-lime)",
                  }}
                >
                  TODAY
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid + events */}
      <div
        className="grid relative"
        style={{
          gridTemplateColumns: "70px repeat(7, 1fr)",
        }}
      >
        {/* Time column */}
        <div
          style={{
            position: "relative",
          }}
        >
          {hours.map((h, idx) => (
            <div
              key={h}
              className="text-right pr-3"
              style={{
                height: HOUR_PX,
                paddingTop: idx === 0 ? 0 : "0.25rem",
                borderTop:
                  idx === 0 ? "none" : "1px solid var(--spark-border)",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  color: "rgba(255,255,255,0.28)",
                  position: "relative",
                  top: -7,
                }}
              >
                {fmtHourLabel(h)}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, dayIdx) => {
          const isToday = isSameDay(day, today);
          const dayShifts = shifts.filter((s) => s.dayIndex === dayIdx);
          // Now-line position for today
          const nowH = today.getHours() + today.getMinutes() / 60;
          const showNow =
            isToday && nowH >= HOUR_START && nowH <= HOUR_END;
          const nowTop = (nowH - HOUR_START) * HOUR_PX;

          return (
            <div
              key={dayIdx}
              style={{
                position: "relative",
                borderLeft: "1px solid var(--spark-border)",
                background: isToday
                  ? "linear-gradient(180deg, rgba(197,245,70,0.025), transparent)"
                  : "transparent",
                height: hours.length * HOUR_PX,
              }}
            >
              {/* Hour gridlines */}
              {hours.map((_, idx) =>
                idx === 0 ? null : (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: idx * HOUR_PX,
                      borderTop: "1px solid var(--spark-border)",
                    }}
                  />
                ),
              )}

              {/* Now line */}
              {showNow && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      left: -3,
                      top: nowTop - 4,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: "var(--spark-lime)",
                      boxShadow: "0 0 8px var(--spark-lime)",
                      zIndex: 4,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: nowTop,
                      borderTop: "1.5px solid var(--spark-lime)",
                      zIndex: 3,
                    }}
                  />
                </>
              )}

              {/* Events */}
              {dayShifts.map((s) => {
                const top = Math.max(0, (s.startHour - HOUR_START) * HOUR_PX);
                const heightRaw = Math.max(
                  24,
                  (s.endHour - s.startHour) * HOUR_PX - 4,
                );
                const color = KIND_COLOR[s.kind];
                return (
                  <button
                    key={s.uuid}
                    onClick={() => navigate(`/event/view/${s.uuid}`)}
                    style={{
                      position: "absolute",
                      left: 4,
                      right: 4,
                      top: top + 2,
                      height: heightRaw,
                      background: `${color}1a`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 6,
                      padding: "4px 8px",
                      textAlign: "left",
                      color: "var(--spark-text)",
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "transform 150ms ease, box-shadow 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.02)";
                      e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.4)`;
                      e.currentTarget.style.zIndex = "5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.zIndex = "1";
                    }}
                    title={s.title}
                  >
                    <p
                      className="mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        color,
                      }}
                    >
                      {s.startLabel}–{s.endLabel}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1.2,
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: heightRaw > 50 ? 2 : 1,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {s.title}
                    </p>
                    {heightRaw > 70 && s.market && (
                      <p
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.55)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.market}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ───────────────── inner ───────────────── */

const SparkCalendarInner: React.FC<{ anchor: Date }> = ({ anchor }) => {
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const { tenantId } = useAuthStore();

  const data = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    {
      first: 500,
      filters: tenantId ? { tenantId } : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const shifts: Shift[] = useMemo(() => {
    const start = days[0];
    const end = new Date(days[6]);
    end.setHours(23, 59, 59, 999);

    return (
      data?.events?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          if (!n.date) return null;
          // Parse the date portion as a LOCAL date. `new Date("2026-05-29")`
          // parses as UTC midnight, which in US timezones lands on the prior
          // day and mis-buckets events at week edges. Build it from parts.
          const [dy, dmo, dd] = String(n.date)
            .slice(0, 10)
            .split("-")
            .map((p) => parseInt(p, 10));
          const d = new Date(dy, (dmo || 1) - 1, dd || 1);
          if (Number.isNaN(d.getTime())) return null;
          if (d < start || d > end) return null;
          const dayIndex = Math.max(
            0,
            Math.min(6, Math.floor((d.getTime() - start.getTime()) / 86400000)),
          );
          let sh = parseHour(n.startTime) ?? 12;
          let eh = parseHour(n.endTime) ?? sh + 1;
          if (eh <= sh) eh = sh + 1; // minimum 1h block
          // Clamp into visible window
          sh = Math.max(HOUR_START, Math.min(HOUR_END - 0.25, sh));
          eh = Math.max(sh + 0.25, Math.min(HOUR_END, eh));
          return {
            uuid: String(n.uuid),
            title: n.name ?? "Untitled",
            market: n.request?.retailer?.name ?? n.address ?? "",
            startHour: sh,
            endHour: eh,
            startLabel: fmtHour12(sh),
            endLabel: fmtHour12(eh),
            kind: inferKind(
              n.eventType?.name ?? n.request?.retailer?.name ?? n.name,
            ),
            dayIndex,
          } as Shift;
        })
        ?.filter((s): s is Shift => s !== null) ?? []
    );
  }, [data, days]);

  return <TimeGrid shifts={shifts} days={days} />;
};

/* ───────────────── page ───────────────── */

export default function SparkCalendar() {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(new Date());

  const stepWeek = (delta: number) => {
    const next = new Date(anchor);
    next.setDate(anchor.getDate() + 7 * delta);
    setAnchor(next);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              SHIFTS BOARD · {monthLabel(anchor)}
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Every shift, at a glance.
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                onClick={() => stepWeek(-1)}
                className="w-9 h-9 rounded-full grid place-items-center transition"
                style={{
                  background: "transparent",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                }}
                title="Previous week"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setAnchor(new Date())}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                Today
              </button>
              <button
                onClick={() => stepWeek(1)}
                className="w-9 h-9 rounded-full grid place-items-center transition"
                style={{
                  background: "transparent",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                }}
                title="Next week"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="pill-group">
              {(["day", "week", "month"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`pill-btn ${v === view ? "on" : ""}`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats — hidden until backend exposes shift counts */}

        {/* Grid */}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading shifts…
            </div>
          }
        >
          <SparkCalendarInner anchor={anchor} />
        </Suspense>

        {/* Legend — same quiet chip row as Today / Account Map */}
        <div className="flex items-center gap-2 px-1 flex-wrap">
          {(
            [
              { label: "Retail", color: KIND_COLOR.retail },
              { label: "On-prem", color: KIND_COLOR.onprem },
              { label: "Event", color: KIND_COLOR.event },
            ] as const
          ).map((k) => (
            <span
              key={k.label}
              className="chip chip-sm"
              style={{ color: k.color, borderColor: k.color }}
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 9999,
                  background: k.color,
                  display: "inline-block",
                }}
              />
              {k.label}
            </span>
          ))}
        </div>
      </div>
    </Layout>
  );
}
