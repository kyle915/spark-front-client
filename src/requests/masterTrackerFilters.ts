export type TrackerDateRange =
  | "all"
  | "next7"
  | "next30"
  | "next90"
  | "past7"
  | "past30"
  | "month";

export type TrackerSortMode = "date-desc" | "date-asc" | "venue" | "status";

export const VALID_TRACKER_DATE_RANGES: readonly TrackerDateRange[] = [
  "all",
  "next7",
  "next30",
  "next90",
  "past7",
  "past30",
  "month",
] as const;

export const VALID_TRACKER_STATUSES = [
  "active",
  "pending",
  "queue",
  "approved",
  "scheduled",
  "done",
  "all",
] as const;

export type TrackerUrlState = {
  status: string;
  dateRange: TrackerDateRange;
  market: string;
  planId: string | null;
};

/** Parse Master Tracker filter state from URL query params (`?status=`, `?when=`, `?market=`, `?plan=`). */
export function parseTrackerUrlParams(
  params: URLSearchParams,
): TrackerUrlState {
  const rawStatus = (params.get("status") || "").trim().toLowerCase();
  const status = (VALID_TRACKER_STATUSES as readonly string[]).includes(
    rawStatus,
  )
    ? rawStatus
    : "active";

  const rawWhen = (params.get("when") || "").trim().toLowerCase();
  const dateRange = (VALID_TRACKER_DATE_RANGES as readonly string[]).includes(
    rawWhen,
  )
    ? (rawWhen as TrackerDateRange)
    : "all";

  const rawMarket = (params.get("market") || "").trim().toUpperCase();
  const market = rawMarket && rawMarket !== "ALL" ? rawMarket : "all";

  const rawPlan = (params.get("plan") || "").trim();
  const planId = rawPlan || null;

  return { status, dateRange, market, planId };
}

/** Merge updated Master Tracker filter values into URLSearchParams, omitting defaults to keep URLs clean. */
export function buildTrackerUrlParams(
  current: URLSearchParams,
  patch: Partial<TrackerUrlState>,
): URLSearchParams {
  const next = new URLSearchParams(current);

  if (patch.status !== undefined) {
    const s = patch.status.trim().toLowerCase();
    if (s && s !== "active") next.set("status", s);
    else next.delete("status");
  }

  if (patch.dateRange !== undefined) {
    if (patch.dateRange && patch.dateRange !== "all") {
      next.set("when", patch.dateRange);
    } else {
      next.delete("when");
    }
  }

  if (patch.market !== undefined) {
    const m = patch.market.trim().toUpperCase();
    if (m && m !== "ALL") next.set("market", m);
    else next.delete("market");
  }

  if (patch.planId !== undefined) {
    if (patch.planId) next.set("plan", patch.planId);
    else next.delete("plan");
  }

  return next;
}

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
