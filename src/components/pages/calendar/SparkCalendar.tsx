import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { LeafTabs } from "@/motion/LeafTabs";
import { SCHEDULE_HUB_TABS } from "@/shared/sparkHubNav";
import Layout from "@/layout/Layout";
import { useAllEventPages } from "@/hooks/useAllEventPages";
import { venueDayOf } from "@/utils/venueDay";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import EventQuickPeekSheet from "@/components/dashboard/EventQuickPeekSheet";
import {
  fetchCalendarShiftSignals,
  invalidateEventPeekCache,
  type CalendarShiftSignal,
  type EventPeekDetail,
} from "@/components/dashboard/eventPeekClient";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { layoutOverlappingShifts } from "./layoutOverlappingShifts";
import {
  type CalendarViewMode,
  type ShiftOpsState,
  buildScheduleHref,
  calendarQueryWindow,
  cleanCalendarShiftTitle,
  computeCalendarHourBounds,
  deriveShiftOpsState,
  formatGhostSlotLabel,
  stepCalendarAnchor,
  stepCalendarPeekIndex,
  ymdOf,
} from "./calendarGridUtils";

const InviteBAModal = lazy(() => import("@/requests/InviteBAModal"));
const BAProfileModal = lazy(
  () => import("@/components/pages/talent/BAProfileModal"),
);

/**
 * Spark v2 — Shifts Board, Studio Calendar.
 *
 * Hourly time column on the left, day columns across, concurrent shift packing,
 * live operational micro-badges (LIVE clock-in, UNSTAFFED, ✓ RECAP), hover
 * ghost-slot scheduling previews, and in-place EventQuickPeekSheet stepping (j / k).
 */

type ShiftKind = "retail" | "onprem" | "event";

const KIND_COLOR: Record<ShiftKind, string> = {
  retail: "var(--spark-lime)",
  onprem: "var(--spark-purple)",
  event: "var(--spark-sky)",
};

const VIEW_TABS: readonly { key: CalendarViewMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

type Shift = {
  uuid: string;
  title: string;
  market: string;
  startHour: number;
  endHour: number;
  startLabel: string;
  endLabel: string;
  kind: ShiftKind;
  dayIndex: number;
  dayYmd: string;
  opsState: ShiftOpsState;
};

const HOUR_PX = 56;

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

const CalendarGridSkeleton: React.FC = () => (
  <div
    className="spark-card overflow-hidden p-4 space-y-3"
    aria-busy="true"
    aria-label="Loading shifts"
  >
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="skeleton-block" style={{ height: 44 }} />
      ))}
    </div>
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton-block" style={{ height: 52 }} />
      ))}
    </div>
  </div>
);

const OpsStateBadge: React.FC<{ state: ShiftOpsState }> = ({ state }) => {
  if (state === "live") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1 py-0.5 rounded mono text-[8.5px] font-semibold shrink-0"
        style={{
          background: "var(--spark-ok-bg, rgba(var(--spark-accent-rgb), 0.14))",
          color: "var(--spark-ok-ink, var(--spark-lime))",
        }}
      >
        <span className="spark-live-clock-dot" aria-hidden />
        LIVE
      </span>
    );
  }
  if (state === "unstaffed") {
    return (
      <span
        className="inline-flex items-center px-1 py-0.5 rounded mono text-[8.5px] font-semibold shrink-0"
        style={{
          background: "rgba(239, 90, 42, 0.14)",
          color: "var(--spark-orange)",
        }}
      >
        OPEN
      </span>
    );
  }
  if (state === "recap_filed") {
    return (
      <span
        className="inline-flex items-center px-1 py-0.5 rounded mono text-[8.5px] font-semibold shrink-0"
        style={{
          background: "rgba(var(--spark-ink-rgb), 0.06)",
          color: "var(--spark-ok-ink, var(--spark-text-secondary))",
        }}
      >
        ✓ RECAP
      </span>
    );
  }
  return null;
};

/* ───────────────── grid ───────────────── */

const TimeGrid: React.FC<{
  shifts: Shift[];
  days: Date[];
  hourStart: number;
  hourEnd: number;
  onScheduleSlot: (day: Date, hour?: number) => void;
  onOpenShift: (uuid: string, e: React.MouseEvent) => void;
}> = ({ shifts, days, hourStart, hourEnd, onScheduleSlot, onOpenShift }) => {
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
    <div className="spark-card overflow-hidden">
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
                    className="absolute top-2 right-2 w-6 h-6 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
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
            <div style={{ position: "relative" }}>
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
                  {/* Hour gridlines + ghost-slot hover preview */}
                  {hours.map((h, idx) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onScheduleSlot(day, h)}
                      title={`Schedule demo on ${ymdOf(day)} at ${fmtHourLabel(h)}`}
                      aria-label={`Schedule demo on ${ymdOf(day)} at ${fmtHourLabel(h)}`}
                      className="group/slot w-full text-left transition-colors"
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
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none opacity-0 group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100 transition-opacity duration-150 block mx-1 mt-1 px-2 py-1 rounded-md mono text-[10px] font-semibold truncate"
                        style={{
                          border: "1px dashed rgba(var(--spark-ink-rgb), 0.28)",
                          background: "rgba(var(--spark-ink-rgb), 0.04)",
                          color: "var(--spark-text-secondary)",
                        }}
                      >
                        {formatGhostSlotLabel(h)}
                      </span>
                    </button>
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
                    const color =
                      s.opsState === "unstaffed"
                        ? "var(--spark-orange)"
                        : KIND_COLOR[s.kind];
                    const gutter = 4;
                    const colGap = 2;
                    const widthPct = 100 / s.cols;
                    const leftPct = (s.col / s.cols) * 100;
                    const showMarket = heightRaw > 56 && Boolean(s.market);
                    const titleLines = heightRaw > 72 ? 2 : 1;
                    const chipTitle = [
                      s.startLabel + "–" + s.endLabel,
                      s.title,
                      s.market,
                      s.opsState === "unstaffed"
                        ? "Unstaffed"
                        : s.opsState === "live"
                          ? "On the clock"
                          : s.opsState === "recap_filed"
                            ? "Recap filed"
                            : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <button
                        key={s.uuid}
                        type="button"
                        onClick={(e) => onOpenShift(s.uuid, e)}
                        style={{
                          position: "absolute",
                          top: top + 2,
                          left: `calc(${leftPct}% + ${gutter}px)`,
                          width: `calc(${widthPct}% - ${gutter * 2}px - ${colGap}px)`,
                          height: heightRaw,
                          background: "var(--spark-surface)",
                          boxShadow: `inset 0 0 0 1px var(--spark-border)`,
                          borderLeft:
                            s.opsState === "unstaffed"
                              ? "3px dashed var(--spark-orange)"
                              : `3px solid ${color}`,
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
                        title={`${chipTitle} (click to quick-peek, ⌘-click for full page)`}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <span
                            className="mono"
                            style={{
                              fontSize: 9,
                              letterSpacing: "0.06em",
                              lineHeight: 1.25,
                              color,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.startLabel}–{s.endLabel}
                          </span>
                          <OpsStateBadge state={s.opsState} />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            lineHeight: 1.25,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
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
  onOpenShift: (uuid: string, e: React.MouseEvent) => void;
}> = ({ anchor, days, shifts, onSelectDay, onScheduleSlot, onOpenShift }) => {
  const today = new Date();
  const activeMonth = anchor.getMonth();
  const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  return (
    <div className="spark-card overflow-hidden">
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
                      className="display tab-num text-sm font-bold hover:underline cursor-pointer"
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
                      className="w-5 h-5 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
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
                        onClick={(e) => onOpenShift(s.uuid, e)}
                        title={`${s.startLabel} ${s.title}${s.market ? " · " + s.market : ""}`}
                        className="w-full text-left px-1.5 py-1 rounded text-[11px] flex items-center gap-1 transition hover:opacity-85 cursor-pointer"
                        style={{
                          background: "var(--spark-surface)",
                          borderLeft:
                            s.opsState === "unstaffed"
                              ? "3px dashed var(--spark-orange)"
                              : `3px solid ${KIND_COLOR[s.kind]}`,
                          boxShadow: "inset 0 0 0 1px var(--spark-border)",
                          color: "var(--spark-text)",
                        }}
                      >
                        {s.opsState === "live" ? (
                          <span className="spark-live-clock-dot shrink-0" aria-hidden />
                        ) : null}
                        <span
                          className="mono text-[9px] shrink-0"
                          style={{ color: "var(--spark-text-meta)" }}
                        >
                          {s.startLabel}
                        </span>
                        <span className="truncate flex-1">{s.title}</span>
                        {s.opsState === "recap_filed" ? (
                          <span
                            className="mono text-[9px] shrink-0"
                            style={{ color: "var(--spark-ok-ink, var(--spark-text-meta))" }}
                          >
                            ✓
                          </span>
                        ) : null}
                      </button>
                    ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectDay(day)}
                        className="mono text-[10px] hover:underline px-1 cursor-pointer"
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
  const { isClient } = useSparkRole();
  const { visibleDays, startDate, endDate } = useMemo(
    () => calendarQueryWindow(anchor, view),
    [anchor, view],
  );
  const dayKeys = useMemo(() => visibleDays.map(ymdOf), [visibleDays]);
  const todayKey = useMemo(() => ymdOf(new Date()), []);
  const { tenantId } = useAuthStore();

  const [refreshKey, setRefreshKey] = useState(0);
  const { events } = useAllEventPages(
    {
      ...(tenantId ? { tenantId } : {}),
      startDate,
      endDate,
    },
    { fetchKey: refreshKey },
  );

  // Operational shift signals (live clock-in, unstaffed count, recap filed).
  const [signals, setSignals] = useState<Map<string, CalendarShiftSignal>>(
    () => new Map(),
  );
  useEffect(() => {
    let active = true;
    const todayInWindow = dayKeys.includes(todayKey) ? todayKey : null;
    fetchCalendarShiftSignals({
      tenantId: tenantId ? String(tenantId) : null,
      startDate,
      endDate,
      todayYmd: todayInWindow,
      isClient,
    })
      .then((map) => {
        if (active) setSignals(map);
      })
      .catch(() => {
        if (active) setSignals(new Map());
      });
    return () => {
      active = false;
    };
  }, [tenantId, startDate, endDate, dayKeys, todayKey, isClient, refreshKey]);

  const shifts: Shift[] = useMemo(() => {
    return events
      .map((n) => {
        const day = venueDayOf(n);
        const dayIndex = day ? dayKeys.indexOf(day) : -1;
        if (dayIndex < 0 || !day) return null;
        let sh = parseHour(n.startTime) ?? 12;
        let eh = parseHour(n.endTime) ?? sh + 1;
        if (eh <= sh) eh = sh + 1;
        sh = Math.max(0, Math.min(23.75, sh));
        eh = Math.max(sh + 0.25, Math.min(24, eh));
        const uuid = String(n.uuid);
        const sig = signals.get(uuid);
        const opsState = deriveShiftOpsState({
          onClock: Boolean(sig?.onClock),
          isClient,
          hasSignal: Boolean(sig),
          ambassadorCount: sig?.ambassadorCount ?? 0,
          recapsFiledCount: sig?.recapsFiledCount ?? 0,
          isPastDay: day < todayKey,
        });
        return {
          uuid,
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
          dayYmd: day,
          opsState,
        } as Shift;
      })
      .filter((s): s is Shift => s !== null);
  }, [events, dayKeys, signals, isClient, todayKey]);

  // Chronological order for j / k quick-peek stepping.
  const orderedShifts = useMemo(
    () =>
      [...shifts].sort(
        (a, b) =>
          a.dayIndex - b.dayIndex ||
          a.startHour - b.startHour ||
          a.title.localeCompare(b.title),
      ),
    [shifts],
  );

  const [peekUuid, setPeekUuid] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<EventPeekDetail | null>(null);
  const [nudgeTarget, setNudgeTarget] = useState<{
    uuid: string;
    name?: string;
  } | null>(null);

  const peekIndex = useMemo(
    () =>
      peekUuid
        ? orderedShifts.findIndex((s) => s.uuid === peekUuid)
        : -1,
    [orderedShifts, peekUuid],
  );

  const handleOpenShift = (uuid: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      navigate(`/event/view/${uuid}`);
      return;
    }
    setPeekUuid(uuid);
  };

  const handleStepPeek = (delta: -1 | 1) => {
    if (orderedShifts.length === 0) return;
    const cur = peekIndex >= 0 ? peekIndex : 0;
    const next = stepCalendarPeekIndex(cur, orderedShifts.length, delta);
    setPeekUuid(orderedShifts[next]?.uuid ?? null);
  };

  const { hourStart, hourEnd } = useMemo(
    () => computeCalendarHourBounds(shifts),
    [shifts],
  );

  const handleScheduleSlot = (day: Date, hour?: number) => {
    navigate(buildScheduleHref(day, hour));
  };

  const activeLiveShift = peekUuid ? (signals.get(peekUuid)?.liveShift ?? null) : null;

  return (
    <>
      {view === "month" ? (
        <MonthGrid
          anchor={anchor}
          days={visibleDays}
          shifts={shifts}
          onSelectDay={onSelectDay}
          onScheduleSlot={handleScheduleSlot}
          onOpenShift={handleOpenShift}
        />
      ) : (
        <TimeGrid
          shifts={shifts}
          days={visibleDays}
          hourStart={hourStart}
          hourEnd={hourEnd}
          onScheduleSlot={handleScheduleSlot}
          onOpenShift={handleOpenShift}
        />
      )}

      <EventQuickPeekSheet
        open={peekUuid !== null}
        onOpenChange={(next) => {
          if (!next) setPeekUuid(null);
        }}
        shift={activeLiveShift}
        eventUuid={peekUuid}
        index={peekIndex >= 0 ? peekIndex : 0}
        total={orderedShifts.length}
        onStep={handleStepPeek}
        onNudgeBa={
          !isClient
            ? (uuid, name) => setNudgeTarget({ uuid, name })
            : undefined
        }
        onAssignBa={
          !isClient
            ? (detail) => {
                setPeekUuid(null);
                setAssignTarget(detail);
              }
            : undefined
        }
      />

      {!isClient && assignTarget ? (
        <Suspense fallback={null}>
          <InviteBAModal
            eventId={assignTarget.id}
            eventDate={assignTarget.date}
            eventAddress={assignTarget.address}
            onClose={() => setAssignTarget(null)}
            onInvited={() => {
              invalidateEventPeekCache(assignTarget.uuid);
              setRefreshKey((k) => k + 1);
            }}
          />
        </Suspense>
      ) : null}

      {!isClient && nudgeTarget ? (
        <Suspense fallback={null}>
          <BAProfileModal
            ambassadorUuid={nudgeTarget.uuid}
            fallbackName={nudgeTarget.name}
            autoOpenDm
            onClose={() => setNudgeTarget(null)}
          />
        </Suspense>
      ) : null}
    </>
  );
};

/* ───────────────── page ───────────────── */

export default function SparkCalendar() {
  const navigate = useNavigate();
  const { isClient } = useSparkRole();
  const [view, setView] = useState<CalendarViewMode>("week");
  const [anchor, setAnchor] = useState(new Date());

  const stepAnchor = (delta: number) => {
    setAnchor((cur) => stepCalendarAnchor(cur, view, delta));
  };

  const rangeHeading =
    view === "day" ? dayHeaderLabel(anchor) : monthLabel(anchor);

  return (
    <Layout>
      <div className="space-y-5 max-w-7xl spark-scale">
        <SparkHubTabs tabs={SCHEDULE_HUB_TABS} ariaLabel="Schedule views" />
        <SparkPageHeader
          title="Calendar"
          support={rangeHeading}
          action={
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => stepAnchor(-1)}
                  className="w-9 h-9 rounded-lg grid place-items-center transition cursor-pointer"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                  title={`Previous ${view}`}
                  aria-label={`Previous ${view}`}
                >
                  <ChevronLeft size={16} strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setAnchor(new Date())}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
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
                  className="w-9 h-9 rounded-lg grid place-items-center transition cursor-pointer"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                  title={`Next ${view}`}
                  aria-label={`Next ${view}`}
                >
                  <ChevronRight size={16} strokeWidth={1.75} />
                </button>
              </div>
              <LeafTabs
                options={VIEW_TABS}
                value={view}
                onChange={setView}
                ariaLabel="Calendar grid view"
              />
              <button
                type="button"
                onClick={() => navigate(buildScheduleHref(anchor))}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                style={{
                  background: "var(--spark-text)",
                  color: "var(--spark-surface)",
                }}
              >
                <Plus size={14} strokeWidth={1.75} />
                Schedule demo
              </button>
            </div>
          }
        />

        {/* Grid */}
        <Suspense fallback={<CalendarGridSkeleton />}>
          <SparkCalendarInner
            anchor={anchor}
            view={view}
            onSelectDay={(d) => {
              setAnchor(d);
              setView("day");
            }}
          />
        </Suspense>

        {/* Legend — channel tones + operational status markers */}
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
          {!isClient ? (
            <>
              <span className="chip chip-sm chip-muted inline-flex items-center gap-1.5">
                <span className="spark-live-clock-dot" aria-hidden />
                On the clock
              </span>
              <span
                className="chip chip-sm"
                style={{
                  color: "var(--spark-orange)",
                  borderColor: "rgba(239, 90, 42, 0.45)",
                }}
              >
                Open / Unstaffed
              </span>
            </>
          ) : null}
          <span className="chip chip-sm chip-muted">✓ Recap filed</span>
        </div>
      </div>
    </Layout>
  );
}
