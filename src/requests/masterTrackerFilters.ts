export type TrackerDateRange =
  | "all"
  | "next7"
  | "next30"
  | "next90"
  | "past7"
  | "past30"
  | "month"
  | "custom";

/** Inclusive YYYY-MM-DD bounds for `when=custom&from=…&to=…`. */
export type TrackerCustomRange = {
  startDate: string;
  endDate: string;
};

export type TrackerSortMode = "date-desc" | "date-asc" | "venue" | "status";

export const VALID_TRACKER_DATE_RANGES: readonly TrackerDateRange[] = [
  "all",
  "next7",
  "next30",
  "next90",
  "past7",
  "past30",
  "month",
  "custom",
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
  /** Set only when `dateRange === "custom"` and from/to are valid. */
  customRange: TrackerCustomRange | null;
};

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isTrackerIsoDay(value: string | null | undefined): boolean {
  if (!value || !ISO_DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
  );
}

function parseCustomRange(
  params: URLSearchParams,
): TrackerCustomRange | null {
  const from = (params.get("from") || "").trim();
  const to = (params.get("to") || "").trim();
  if (!isTrackerIsoDay(from) || !isTrackerIsoDay(to)) return null;
  if (from > to) return null;
  return { startDate: from, endDate: to };
}

/** Parse Master Tracker filter state from URL query params (`?status=`, `?when=`, `?market=`, `?plan=`, plus `?from=&to=` for `when=custom`). */
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
  let dateRange = (VALID_TRACKER_DATE_RANGES as readonly string[]).includes(
    rawWhen,
  )
    ? (rawWhen as TrackerDateRange)
    : "all";

  // `when=custom` is only meaningful with a valid inclusive from/to pair;
  // otherwise fall back to "all" rather than inventing a range.
  let customRange: TrackerCustomRange | null = null;
  if (dateRange === "custom") {
    customRange = parseCustomRange(params);
    if (!customRange) dateRange = "all";
  }

  const rawMarket = (params.get("market") || "").trim().toUpperCase();
  const market = rawMarket && rawMarket !== "ALL" ? rawMarket : "all";

  const rawPlan = (params.get("plan") || "").trim();
  const planId = rawPlan || null;

  return { status, dateRange, market, planId, customRange };
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
    // A preset range supersedes any custom bounds carried in the URL.
    if (patch.dateRange !== "custom") {
      next.delete("from");
      next.delete("to");
    }
  }

  if (patch.customRange !== undefined) {
    if (patch.customRange) {
      next.set("when", "custom");
      next.set("from", patch.customRange.startDate);
      next.set("to", patch.customRange.endDate);
    } else {
      next.delete("from");
      next.delete("to");
      if (patch.dateRange === undefined && next.get("when") === "custom") {
        next.delete("when");
      }
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
export function trackerDateRangeToServer(
  dateRange: TrackerDateRange,
  customRange?: TrackerCustomRange | null,
): {
  startDate?: string;
  endDate?: string;
} {
  if (dateRange === "all") return {};
  if (dateRange === "custom") {
    return customRange &&
      isTrackerIsoDay(customRange.startDate) &&
      isTrackerIsoDay(customRange.endDate) &&
      customRange.startDate <= customRange.endDate
      ? { startDate: customRange.startDate, endDate: customRange.endDate }
      : {};
  }

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

/** Chip count for a tracker status, including the rolled-up Active bucket. */
export function trackerStatusCount(
  key: string,
  counts: Record<string, number>,
  total: number,
): number {
  if (key === "all") return total;
  if (key === "active") {
    return ACTIVE_STATUS_SLUGS.reduce((sum, slug) => sum + (counts[slug] ?? 0), 0);
  }
  return counts[key] ?? 0;
}

/**
 * REQ-#### is matched on the loaded rows (id suffix), not by the status
 * totals. Those totals stay the whole tracker and must not be the export
 * denominator.
 */
export function isTrackerReqLookup(search: string): boolean {
  return /^req[-\s]*[a-z0-9]{1,4}$/i.test(search.trim());
}

/**
 * How many requests the export is being compared with.
 * A REQ lookup's match set is the loaded rows; every other search uses
 * the status-chip total.
 */
export function trackerExportMatching(
  search: string,
  loaded: number,
  statusCount: number,
): number {
  return isTrackerReqLookup(search) ? loaded : statusCount;
}

/**
 * What an export of the loaded rows actually contains.
 * A bare "50" reads as the tracker; name the loaded slice when more match.
 */
export function trackerExportScope(loaded: number, matching: number): string {
  if (loaded <= 0) return "";
  const loadedLabel = loaded.toLocaleString("en-US");
  if (matching > loaded) {
    return `${loadedLabel} loaded of ${matching.toLocaleString("en-US")}`;
  }
  return loadedLabel;
}
