export interface DayStaffingPill {
  ymd: string;
  label: string;
  total: number;
  staffed: number;
  unstaffed: number;
  to: string;
}

export interface SevenDayStaffingSummary {
  days: DayStaffingPill[];
  totalShifts: number;
  staffedShifts: number;
  unstaffedShifts: number;
  fillPct: number;
}

const fmtYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function parseMondayOfDateYmd(rawYmd: string | null | undefined): Date | null {
  if (!rawYmd || !/^\d{4}-\d{2}-\d{2}$/.test(rawYmd)) return null;
  const [y, m, d] = rawYmd.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  const dow = (parsed.getDay() + 6) % 7; // 0 = Monday
  parsed.setDate(parsed.getDate() - dow);
  return parsed;
}

export function buildSevenDayStaffingSummary(
  startDateYmd: string,
  shifts: ReadonlyArray<{
    date?: string | null;
    isStaffed?: boolean | null;
  }>,
): SevenDayStaffingSummary {
  const [y, m, d] = startDateYmd.split("-").map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  base.setHours(0, 0, 0, 0);

  const byDay = new Map<string, { total: number; staffed: number }>();
  let totalShifts = 0;
  let staffedShifts = 0;

  for (const s of shifts) {
    totalShifts += 1;
    const staffed = Boolean(s.isStaffed);
    if (staffed) staffedShifts += 1;
    const key = String(s.date ?? "").slice(0, 10);
    if (!key) continue;
    const cur = byDay.get(key) ?? { total: 0, staffed: 0 };
    cur.total += 1;
    if (staffed) cur.staffed += 1;
    byDay.set(key, cur);
  }

  const days: DayStaffingPill[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() + i);
    const key = fmtYmd(dt);
    const counts = byDay.get(key) ?? { total: 0, staffed: 0 };
    const unstaffed = counts.total - counts.staffed;
    const label =
      i === 0
        ? "Today"
        : dt.toLocaleDateString("en-US", { weekday: "short" });
    days.push({
      ymd: key,
      label,
      total: counts.total,
      staffed: counts.staffed,
      unstaffed,
      to:
        unstaffed > 0
          ? `/schedule?filter=unstaffed&date=${key}`
          : `/schedule?date=${key}`,
    });
  }

  const unstaffedShifts = totalShifts - staffedShifts;
  const fillPct =
    totalShifts > 0 ? Math.round((staffedShifts / totalShifts) * 100) : 100;

  return {
    days,
    totalShifts,
    staffedShifts,
    unstaffedShifts,
    fillPct,
  };
}
