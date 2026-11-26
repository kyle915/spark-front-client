import { Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAllEventPages } from "@/hooks/useAllEventPages";
import { venueDayOf } from "@/utils/venueDay";
import { useAuthStore } from "@/store/authStore";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { layoutOverlappingShifts } from "./layoutOverlappingShifts";
import {
  type CalendarViewMode,
  buildScheduleHref,
  calendarQueryWindow,
  cleanCalendarShiftTitle,
  computeCalendarHourBounds,
  stepCalendarAnchor,
  ymdOf,
} from "./calendarGridUtils";

/**
 * Spark v2 — Shifts Board, Google-Calendar style.
 *
 * Hourly time column on the left, day columns across. Events are
 * absolutely positioned in their day column based on start/end times
 * (height = duration). Concurrent shifts pack into side-by-side columns
 * so text never paints through another chip. Each chip stacks time →
 * title → market in a flex column with truncation.
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

const HOUR_PX = 56; // 56px per hour row (matches Google's compact week view)

const monthLabel = (d: Date) =>
  d.toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();

const dayHeaderLabel = (d: Date) =>
  d
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();

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

const TimeGrid: React.FC<{
  shifts: Shift[];
  days: Date[];
  hourStart: number;
  hourEnd: number;
  onScheduleSlot: (day: Date, hour?: number) => void;
}> = ({ shifts, days, hourStart, hourEnd, onScheduleSlot }) => {
  const navigate = useNavigate();
  const today = new Date();
  const hours = useMemo(
    () =>
      Array.from(
        { length: hourEnd - hourStart + 1 },
        (_, i) => hourStart + i,
      ),
    [hourStart, hourEnd],
  );
  const gridColumns = `70px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div
      className="spark-card overflow-hidden"
      style={{ borderRadius: 22 }}
    >
      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length === 1 ? 360 : 720 }}>
          {/* Day headers */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: gridColumns,
              borderBottom: "1px solid var(--spark-border)",
            }}
          >
            <div />
            {days.map((d, i) => {
              const isToday = isSameDay(d, today);
              return (
                <div
                  key={i}
                  className="px-3 py-3 text-center relative group"
                  style={{
                    borderLeft: "1px solid var(--spark-border)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onScheduleSlot(d)}
                    title={`Schedule demo on ${ymdOf(d)}`}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                    style={{
                      border: "1px solid var(--spark-border)",
                      color: "var(--spark-text-secondary)",
                    }}
                  >
                    <Plus size={12} />
                  </button>
                  <p
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      color: isToday
                        ? "var(--spark-lime)"
                        : "rgba(var(--spark-ink-rgb),0.45)",
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
              gridTemplateColumns: gridColumns,
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
                      color: "var(--spark-text-meta)",
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
                isToday && nowH >= hourStart && nowH <= hourEnd;
              const nowTop = (nowH - hourStart) * HOUR_PX;

              return (
                <div
                  key={dayIdx}
                  style={{
                    position: "relative",
                    borderLeft: "1px solid var(--spark-border)",
                    background: isToday
                      ? "linear-gradient(180deg, rgba(var(--spark-accent-rgb),0.025), transparent)"
                      : "transparent",
                    height: hours.length * HOUR_PX,
                  }}
                >
                  {/* Hour gridlines + click-to-schedule slots */}
                  {hours.map((h, idx) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onScheduleSlot(day, h)}
                      title={`Schedule demo on ${ymdOf(day)} at ${fmtHourLabel(h)}`}
                      aria-label={`Schedule demo on ${ymdOf(day)} at ${fmtHourLabel(h)}`}
                      className="w-full text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: idx * HOUR_PX,
                        height: HOUR_PX,
                        borderTop:
                          idx === 0 ? "none" : "1px solid var(--spark-border)",
                        background: "transparent",
                        cursor: "pointer",
                        zIndex: 0,
                      }}
                    />
                  ))}

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

                  {/* Events — packed so concurrent chips sit side-by-side */}
                  {layoutOverlappingShifts(dayShifts).map((s) => {
                    const top = Math.max(0, (s.startHour - hourStart) * HOUR_PX);
                const heightRaw = Math.max(
                  24,
                  (s.endHour - s.startHour) * HOUR_PX - 4,
                );
                const color = KIND_COLOR[s.kind];
                const gutter = 4;
                const colGap = 2;
                // Percentage widths keep chips readable when a day is busy.
                const widthPct = 100 / s.cols;
                const leftPct = (s.col / s.cols) * 100;
                const showMarket = heightRaw > 56 && Boolean(s.market);
                const titleLines = heightRaw > 72 ? 2 : 1;
                const chipTitle = [s.startLabel + "–" + s.endLabel, s.title, s.market]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={s.uuid}
                    type="button"
                    onClick={() => navigate(`/event/view/${s.uuid}`)}
                    style={{
                      position: "absolute",
                      top: top + 2,
                      left: `calc(${leftPct}% + ${gutter}px)`,
                      width: `calc(${widthPct}% - ${gutter * 2}px - ${colGap}px)`,
                      height: heightRaw,
                      // Opaque surface so text from a neighbor never bleeds through.
                      background: "var(--spark-surface)",
                      boxShadow: `inset 0 0 0 1px var(--spark-border)`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 6,
                      padding: "3px 6px 3px 7px",
                      textAlign: "left",
                      color: "var(--spark-text)",
                      cursor: "pointer",
                      overflow: "hidden",
                      zIndex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      justifyContent: "flex-start",
                      gap: 1,
                      minWidth: 0,
                      transition: "transform 150ms ease, box-shadow 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.02)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 16px rgba(0,0,0,0.18), inset 0 0 0 1px var(--spark-border)";
                      e.currentTarget.style.zIndex = "5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow =
                        "inset 0 0 0 1px var(--spark-border)";
                      e.currentTarget.style.zIndex = "1";
                    }}
                    title={chipTitle}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.06em",
                        lineHeight: 1.25,
                        color,
                        flexShrink: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.startLabel}–{s.endLabel}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1.25,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        // Single-line truncate by default; taller chips may wrap once.
                        ...(titleLines > 1
                          ? {
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical" as const,
                              whiteSpace: "normal" as const,
                            }
                          : { whiteSpace: "nowrap" as const }),
                        minWidth: 0,
                      }}
                    >
                      {s.title}
                    </span>
                    {showMarket && (
                      <span
                        style={{
                          fontSize: 10,
                          lineHeight: 1.25,
                          color: "var(--spark-text-meta)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                          flexShrink: 0,
                        }}
                      >
                        {s.market}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
          </div>
        </div>
      </div>
    </div>
  );
};

const MonthGrid: React.FC<{
  anchor: Date;
  days: Date[];
  shifts: Shift[];
  onSelectDay: (day: Date) => void;
  onScheduleSlot: (day: Date) => void;
}> = ({ anchor, days, shifts, onSelectDay, onScheduleSlot }) => {
  const navigate = useNavigate();
  const today = new Date();
  const activeMonth = anchor.getMonth();
  const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  return (
    <div className="spark-card overflow-hidden" style={{ borderRadius: 22 }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 720 }}>
          <div
            className="grid grid-cols-7"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            {weekdays.map((w, idx) => (
              <div
                key={w}
                className="px-3 py-2.5 text-center mono text-[10px]"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-text-meta)",
                  borderLeft: idx === 0 ? "none" : "1px solid var(--spark-border)",
                }}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, dayIdx) => {
              const inMonth = day.getMonth() === activeMonth;
              const isToday = isSameDay(day, today);
              const dayShifts = shifts.filter((s) => s.dayIndex === dayIdx);
              const visibleShifts = dayShifts.slice(0, 3);
              const hiddenCount = dayShifts.length - visibleShifts.length;
              return (
                <div
                  key={dayIdx}
                  className="min-h-[124px] p-2.5 flex flex-col gap-1 group"
                  style={{
                    borderLeft:
                      dayIdx % 7 === 0 ? "none" : "1px solid var(--spark-border)",
                    borderTop:
                      dayIdx < 7 ? "none" : "1px solid var(--spark-border)",
                    opacity: inMonth ? 1 : 0.45,
                    background: isToday
                      ? "rgba(var(--spark-accent-rgb), 0.04)"
                      : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onSelectDay(day)}
                      className="display tab-num text-sm font-bold hover:underline"
                      style={{
                        color: isToday ? "var(--spark-lime)" : "var(--spark-text)",
                      }}
                    >
                      {day.getDate()}
                    </button>
                    <button
                      type="button"
                      onClick={() => onScheduleSlot(day)}
                      title={`Schedule demo on ${ymdOf(day)}`}
                      aria-label={`Schedule demo on ${ymdOf(day)}`}
                      className="w-5 h-5 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                      style={{
                        border: "1px solid var(--spark-border)",
                        color: "var(--spark-text-secondary)",
                      }}
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {visibleShifts.map((s) => (
                      <button
                        key={s.uuid}
                        type="button"
                        onClick={() => navigate(`/event/view/${s.uuid}`)}
                        title={`${s.startLabel} ${s.title}${s.market ? " · " + s.market : ""}`}
                        className="w-full text-left px-1.5 py-1 rounded text-[11px] truncate block transition hover:opacity-80"
                        style={{
                          background: "var(--spark-surface)",
                          borderLeft: `3px solid ${KIND_COLOR[s.kind]}`,
                          boxShadow: "inset 0 0 0 1px var(--spark-border)",
                          color: "var(--spark-text)",
                        }}
                      >
                        <span
                          className="mono text-[9px] mr-1"
                          style={{ color: "var(--spark-text-meta)" }}
                        >
                          {s.startLabel}
                        </span>
                        {s.title}
                      </button>
                    ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectDay(day)}
                        className="mono text-[10px] hover:underline px-1"
                        style={{ color: "var(--spark-text-secondary)" }}
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────────────── inner ───────────────── */

const SparkCalendarInner: React.FC<{
  anchor: Date;
  view: CalendarViewMode;
  onSelectDay: (d: Date) => void;
}> = ({ anchor, view, onSelectDay }) => {
  const navigate = useNavigate();
  const { visibleDays, startDate, endDate } = useMemo(
    () => calendarQueryWindow(anchor, view),
    [anchor, view],
  );
  const dayKeys = useMemo(() => visibleDays.map(ymdOf), [visibleDays]);
  const { tenantId } = useAuthStore();

  // Only the window on screen, every page of it. This used to ask for 500
  // events with no dates; the list returns at most 100, newest date first,
  // so a busy brand's current week could come back empty. The API filters
  // by UTC day, so a day either side catches evening shifts out west.
  const { events } = useAllEventPages({
    ...(tenantId ? { tenantId } : {}),
    startDate,
    endDate,
  });

  const shifts: Shift[] = useMemo(() => {
    return events
      .map((n) => {
        // The venue's day, read off the server / the venue clock string,
        // never through the browser's zone.
        const day = venueDayOf(n);
        const dayIndex = day ? dayKeys.indexOf(day) : -1;
        if (dayIndex < 0) return null;
        let sh = parseHour(n.startTime) ?? 12;
        let eh = parseHour(n.endTime) ?? sh + 1;
        if (eh <= sh) eh = sh + 1; // minimum 1h block
        sh = Math.max(0, Math.min(23.75, sh));
        eh = Math.max(sh + 0.25, Math.min(24, eh));
        return {
          uuid: String(n.uuid),
          title: cleanCalendarShiftTitle(n.name),
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
      .filter((s): s is Shift => s !== null);
  }, [events, dayKeys]);

  const { hourStart, hourEnd } = useMemo(
    () => computeCalendarHourBounds(shifts),
    [shifts],
  );

  const handleScheduleSlot = (day: Date, hour?: number) => {
    navigate(buildScheduleHref(day, hour));
  };

  if (view === "month") {
    return (
      <MonthGrid
        anchor={anchor}
        days={visibleDays}
        shifts={shifts}
        onSelectDay={onSelectDay}
        onScheduleSlot={handleScheduleSlot}
      />
    );
  }

  return (
    <TimeGrid
      shifts={shifts}
      days={visibleDays}
      hourStart={hourStart}
      hourEnd={hourEnd}
      onScheduleSlot={handleScheduleSlot}
    />
  );
};

/* ───────────────── page ───────────────── */

export default function SparkCalendar() {
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarViewMode>("week");
  const [anchor, setAnchor] = useState(new Date());

  const stepAnchor = (delta: number) => {
    setAnchor((cur) => stepCalendarAnchor(cur, view, delta));
  };

  const rangeHeading =
    view === "day" ? dayHeaderLabel(anchor) : monthLabel(anchor);

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
                color: "var(--spark-text-meta)",
              }}
            >
              SHIFTS BOARD · {rangeHeading}
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
                onClick={() => stepAnchor(-1)}
                className="w-9 h-9 rounded-full grid place-items-center transition"
                style={{
                  background: "transparent",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                }}
                title={`Previous ${view}`}
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
                onClick={() => stepAnchor(1)}
                className="w-9 h-9 rounded-full grid place-items-center transition"
                style={{
                  background: "transparent",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                }}
                title={`Next ${view}`}
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
            <button
              type="button"
              onClick={() => navigate(buildScheduleHref(anchor))}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
              style={{
                background: "var(--spark-text)",
                color: "var(--spark-surface)",
              }}
            >
              <Plus size={14} />
              Schedule demo
            </button>
          </div>
        </div>

        {/* Stats — hidden until backend exposes shift counts */}

        {/* Grid */}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Loading shifts…
            </div>
          }
        >
          <SparkCalendarInner
            anchor={anchor}
            view={view}
            onSelectDay={(d) => {
              setAnchor(d);
              setView("day");
            }}
          />
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
