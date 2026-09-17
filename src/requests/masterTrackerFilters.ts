export type TrackerDateRange =
  | "all"
  | "next7"
  | "next30"
  | "next90"
  | "past7"
  | "past30"
  | "month";

export type TrackerSortMode = "date-desc" | "date-asc" | "venue" | "status";

const ACTIVE_STATUS_SLUGS = ["pending", "queue", "approved", "scheduled"] as const;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Map tracker date chips to inclusive YYYY-MM-DD bounds for RequestFiltersInput. */
export function trackerDateRangeToServer(dateRange: TrackerDateRange): {
  startDate?: string;
  endDate?: string;
} {
  if (dateRange === "all") return {};

  const today = new Date();
  const todayIso = isoDate(today);

  switch (dateRange) {
    case "next7": {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      return { startDate: todayIso, endDate: isoDate(end) };
    }
    case "next30": {
      const end = new Date(today);
      end.setDate(end.getDate() + 30);
      return { startDate: todayIso, endDate: isoDate(end) };
    }
    case "next90": {
      const end = new Date(today);
      end.setDate(end.getDate() + 90);
      return { startDate: todayIso, endDate: isoDate(end) };
    }
    case "past7": {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { startDate: isoDate(start), endDate: todayIso };
    }
    case "past30": {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { startDate: isoDate(start), endDate: todayIso };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { startDate: isoDate(start), endDate: isoDate(end) };
    }
    default: {
      const _exhaustive: never = dateRange;
      return _exhaustive;
    }
  }
}

/** Map tracker status chip to server filter slugs (null = no status filter). */
export function trackerStatusToServer(
  activeStatus: string,
): { statusSlug?: string; statusSlugs?: string[] } {
  if (activeStatus === "all") return {};
  if (activeStatus === "active") {
    return { statusSlugs: [...ACTIVE_STATUS_SLUGS] };
  }
  return { statusSlug: activeStatus };
}

/** Map sort mode to RequestFiltersInput.dateSort when date-based. */
export function trackerSortToServer(
  sortMode: TrackerSortMode,
): { dateSort?: string } {
  if (sortMode === "date-asc") return { dateSort: "asc" };
  if (sortMode === "date-desc") return { dateSort: "desc" };
  return {};
}

export { ACTIVE_STATUS_SLUGS };
