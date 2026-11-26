export type CalendarViewMode = "day" | "week" | "month";

export const DEFAULT_HOUR_START = 7;
export const DEFAULT_HOUR_END = 23;

export const ymdOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (d: Date, delta: number): Date => {
  const next = new Date(d);
  next.setDate(d.getDate() + delta);
  return next;
};

export const startOfWeek = (d: Date): Date => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const weekDays = (anchor: Date): Date[] => {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const monthGridDays = (anchor: Date): Date[] => {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridStart = startOfWeek(firstOfMonth);
  const endOffset = (6 - ((lastOfMonth.getDay() + 6) % 7));
  const gridEnd = addDays(lastOfMonth, endOffset);
  const days: Date[] = [];
  for (let cur = new Date(gridStart); cur <= gridEnd; cur = addDays(cur, 1)) {
    days.push(new Date(cur));
  }
  return days;
};

export const stepCalendarAnchor = (
  anchor: Date,
  view: CalendarViewMode,
  delta: number,
): Date => {
  const next = new Date(anchor);
  if (view === "day") {
    next.setDate(anchor.getDate() + delta);
    return next;
  }
  if (view === "week") {
    next.setDate(anchor.getDate() + 7 * delta);
    return next;
  }
  const targetMonth = anchor.getMonth() + delta;
  const day = anchor.getDate();
  next.setDate(1);
  next.setMonth(targetMonth);
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, maxDay));
  return next;
};

export const calendarQueryWindow = (
  anchor: Date,
  view: CalendarViewMode,
): { visibleDays: Date[]; startDate: string; endDate: string } => {
  const visibleDays =
    view === "day"
      ? [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())]
      : view === "week"
        ? weekDays(anchor)
        : monthGridDays(anchor);
  const first = visibleDays[0];
  const last = visibleDays[visibleDays.length - 1];
  return {
    visibleDays,
    startDate: ymdOf(addDays(first, -1)),
    endDate: ymdOf(addDays(last, 1)),
  };
};

export const computeCalendarHourBounds = (
  shifts: ReadonlyArray<{ startHour: number; endHour: number }>,
  defaultStart = DEFAULT_HOUR_START,
  defaultEnd = DEFAULT_HOUR_END,
): { hourStart: number; hourEnd: number } => {
  let hourStart = defaultStart;
  let hourEnd = defaultEnd;
  for (const s of shifts) {
    if (Number.isFinite(s.startHour) && s.startHour < hourStart) {
      hourStart = Math.max(0, Math.floor(s.startHour));
    }
    if (Number.isFinite(s.endHour) && s.endHour > hourEnd) {
      hourEnd = Math.min(24, Math.ceil(s.endHour));
    }
  }
  return { hourStart, hourEnd };
};

export const buildScheduleHref = (day: Date, startHour?: number): string => {
  const params = new URLSearchParams({ date: ymdOf(day) });
  if (startHour != null && Number.isFinite(startHour)) {
    const clampedStart = Math.max(0, Math.min(22, Math.floor(startHour)));
    const clampedEnd = Math.min(23, clampedStart + 3);
    params.set("startTime", `${String(clampedStart).padStart(2, "0")}:00`);
    params.set("endTime", `${String(clampedEnd).padStart(2, "0")}:00`);
  }
  return `/requests/create?${params.toString()}`;
};
