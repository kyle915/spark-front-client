export type PilotRangeKey = "all" | "30d" | "90d" | "ytd" | "custom";

export const PILOT_RANGE_OPTIONS: ReadonlyArray<{
  key: PilotRangeKey;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];

function formatIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolvePilotPeriod(
  range: PilotRangeKey,
  customStart: string,
  customEnd: string,
  now: Date = new Date(),
): { periodStart: string | null; periodEnd: string | null } {
  if (range === "all") {
    return { periodStart: null, periodEnd: null };
  }
  if (range === "custom") {
    const start = customStart.trim() || null;
    const end = customEnd.trim() || null;
    if (start && end && start > end) {
      return { periodStart: end, periodEnd: start };
    }
    return { periodStart: start, periodEnd: end };
  }
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodEnd = formatIsoDay(end);
  if (range === "ytd") {
    return {
      periodStart: `${end.getFullYear()}-01-01`,
      periodEnd,
    };
  }
  const days = range === "30d" ? 29 : 89;
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    periodStart: formatIsoDay(start),
    periodEnd,
  };
}
