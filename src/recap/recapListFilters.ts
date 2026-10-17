import type { RecapActivationFilter } from "@/lib/activationBucket";
import {
  normalizeRecapActivationFilter,
  recapActivationFilterLabel,
} from "@/lib/activationBucket";

/**
 * Recaps list filter defaults.
 *
 * Client "My Recaps" used to default to `shared` (and the header was
 * hardcoded SHARED). Feel Free had 118 approved recaps and 0 shared, so
 * the Client toggle showed an empty list while Admin → Approved showed
 * the real pile. Clients should see approved recaps — the same set they
 * get emailed — not a second "shared" publish gate.
 */

export type RecapListStatus =
  | "submitted"
  | "needs_review"
  | "approved"
  | "shared"
  | "archived"
  | "all"
  | "draft";

const URL_STATUSES = new Set<string>([
  "needs_review",
  "approved",
  "shared",
  "archived",
  "submitted",
  "all",
]);

export function defaultRecapStatus(
  isClient: boolean,
  statusFromUrl?: string | null,
): RecapListStatus {
  if (isClient) {
    // Ignore ?status=shared / needs_review / archived — those emptied the
    // client view. "all" still means every approved recap (server already
    // hides drafts + archived from clients).
    if (statusFromUrl === "all") return "all";
    return "approved";
  }
  if (statusFromUrl && URL_STATUSES.has(statusFromUrl)) {
    return statusFromUrl as RecapListStatus;
  }
  return "needs_review";
}

/** Server `shared` filter. Null = do not gate on shared_at. */
export function sharedQueryFilter(
  isClient: boolean,
  pipeline: RecapListStatus,
): boolean | null {
  // Clients see every approved recap, shared or not. Admin "Approved"
  // is the full approved pile (shared or not). "Shared" narrows to
  // shared_at set — a subset of approved, not a separate status.
  if (isClient) return null;
  if (pipeline === "shared") return true;
  return null;
}

/**
 * Server `archived` filter. Null = no archive gate.
 * Needs review / Approved / Shared exclude archived; Archived tab
 * requests archived=true; All / Submitted leave the filter open.
 */
export function archivedQueryFilter(
  isClient: boolean,
  pipeline: RecapListStatus,
): boolean | null {
  if (isClient) return false;
  if (pipeline === "archived") return true;
  if (
    pipeline === "needs_review" ||
    pipeline === "draft" ||
    pipeline === "approved" ||
    pipeline === "shared"
  ) {
    return false;
  }
  return null;
}

export function recapMatchesPipeline(opts: {
  isClient: boolean;
  pipeline: RecapListStatus;
  approved: boolean;
  sharedAt: string | null;
  archivedAt?: string | null;
  justApproved: boolean;
  /** Clock-out draft with no photos/metrics — hide from Needs review. */
  emptyShell?: boolean;
}): boolean {
  const {
    isClient,
    pipeline,
    approved,
    sharedAt,
    archivedAt,
    justApproved,
    emptyShell,
  } = opts;
  const archived = Boolean(archivedAt);
  if (isClient) return (approved || justApproved) && !archived;
  if (pipeline === "archived") return archived;
  if (archived) {
    // Parked rows only live on the Archived tab (and All / Submitted).
    return pipeline === "all" || pipeline === "submitted";
  }
  if (pipeline === "all" || pipeline === "submitted") return true;
  if (pipeline === "needs_review") {
    // Filed content only. Empty shells (no photos, no metrics) still live
    // under Submitted / All — they are not an approve queue.
    if (emptyShell) return false;
    return !approved || justApproved;
  }
  if (pipeline === "approved") return approved || justApproved;
  if (pipeline === "shared") return Boolean(sharedAt);
  return true;
}

/** True when a recap row exists but nothing was filed (clock-out stub). */
export function recapIsEmptyShell(opts: {
  heroImage?: string | null;
  fileCount?: number | null;
  engagements?: number | null;
  productsSold?: number | null;
  cansSold?: number | null;
  packsSold?: number | null;
}): boolean {
  const hasPhotos =
    Boolean(opts.heroImage) || (opts.fileCount ?? 0) > 0;
  const hasMetrics =
    opts.engagements != null ||
    opts.productsSold != null ||
    opts.cansSold != null ||
    opts.packsSold != null;
  return !hasPhotos && !hasMetrics;
}

export function recapListStatusWord(
  isClient: boolean,
  pipeline: RecapListStatus,
): string {
  if (isClient) return pipeline === "all" ? "ALL" : "APPROVED";
  switch (pipeline) {
    case "needs_review":
    case "draft":
      return "NEEDS REVIEW";
    case "approved":
      return "APPROVED";
    case "shared":
      return "SHARED";
    case "archived":
      return "ARCHIVED";
    case "submitted":
      return "SUBMITTED";
    default:
      return "ALL";
  }
}

export type RecapEmptyKind = "queue" | "window" | "filters";

/**
 * Detail → list return path.
 *
 * Admin back used to hard-link `/recaps/list`, which re-defaults to
 * Needs review even when you opened the recap from Approved / Shared /
 * Submitted. List cards stash `fromStatus` / `fromActivation` on the
 * detail URL; back rebuilds `/recaps/list?status=…&activation=…` from
 * those (or fallbacks).
 */
export function normalizeRecapListStatus(
  status?: string | null,
): RecapListStatus | null {
  if (!status) return null;
  if (status === "draft") return "needs_review";
  if (URL_STATUSES.has(status)) return status as RecapListStatus;
  return null;
}

export type RecapListReturnFilters = {
  q?: string | null;
  retailer?: string | null;
  state?: string | null;
  rmm?: string | null;
  ba?: string | null;
  from?: string | null;
  to?: string | null;
  range?: string | null;
  page?: number | null;
};

export function withRecapListReturn(
  href: string,
  listStatus?: string | null,
  listActivation?: string | null,
  extra?: RecapListReturnFilters | null,
): string {
  const status = normalizeRecapListStatus(listStatus);
  const activation = normalizeRecapActivationFilter(listActivation);
  const qVal = extra?.q?.trim() || "";
  const retailer =
    extra?.retailer && extra.retailer !== "all" ? extra.retailer : "";
  const state = extra?.state && extra.state !== "all" ? extra.state : "";
  const rmm = extra?.rmm && extra.rmm !== "all" ? extra.rmm : "";
  const ba = extra?.ba?.trim() || "";
  const from = extra?.from?.trim() || "";
  const to = extra?.to?.trim() || "";
  const range = extra?.range?.trim() || "";
  const page =
    extra?.page && Number.isFinite(extra.page) && extra.page > 1
      ? Math.floor(extra.page)
      : null;

  if (
    !status &&
    activation === "all" &&
    !qVal &&
    !retailer &&
    !state &&
    !rmm &&
    !ba &&
    !from &&
    !to &&
    !range &&
    !page
  ) {
    return href;
  }
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (status) params.set("fromStatus", status);
  if (activation !== "all") params.set("fromActivation", activation);
  if (qVal) params.set("fromQ", qVal);
  if (retailer) params.set("fromRetailer", retailer);
  if (state) params.set("fromState", state);
  if (rmm) params.set("fromRmm", rmm);
  if (ba) params.set("fromBa", ba);
  if (from) params.set("fromFrom", from);
  if (to) params.set("fromTo", to);
  if (range) params.set("fromRange", range);
  if (page) params.set("fromPage", String(page));
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export function recapsListHrefFromReturn(opts: {
  searchParams: { get: (key: string) => string | null };
  fallbackStatus?: string | null;
  fallbackActivation?: string | null;
}): string {
  const fromStatus = normalizeRecapListStatus(
    opts.searchParams.get("fromStatus") ?? opts.fallbackStatus,
  );
  const fromActivation = normalizeRecapActivationFilter(
    opts.searchParams.get("fromActivation") ?? opts.fallbackActivation,
  );
  const fromQ = (opts.searchParams.get("fromQ") ?? "").trim();
  const fromRetailer = opts.searchParams.get("fromRetailer") ?? "";
  const fromState = opts.searchParams.get("fromState") ?? "";
  const fromRmm = opts.searchParams.get("fromRmm") ?? "";
  const fromBa = (opts.searchParams.get("fromBa") ?? "").trim();
  const fromFrom =
    opts.searchParams.get("fromFrom") ??
    opts.searchParams.get("fromDateFrom") ??
    "";
  const fromTo =
    opts.searchParams.get("fromTo") ??
    opts.searchParams.get("fromDateTo") ??
    "";
  const fromRange = opts.searchParams.get("fromRange") ?? "";
  const pageRaw = Number(opts.searchParams.get("fromPage") ?? "");
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : null;
  const after = opts.searchParams.get("fromAfter");

  const params = new URLSearchParams();
  if (fromStatus) params.set("status", fromStatus);
  if (fromActivation !== "all") params.set("activation", fromActivation);
  if (fromQ) params.set("q", fromQ);
  if (fromRetailer && fromRetailer !== "all") {
    params.set("retailer", fromRetailer);
  }
  if (fromState && fromState !== "all") params.set("state", fromState);
  if (fromRmm && fromRmm !== "all") params.set("rmm", fromRmm);
  if (fromBa) params.set("ba", fromBa);
  if (fromFrom) params.set("from", fromFrom);
  if (fromTo) params.set("to", fromTo);
  if (fromRange && !fromFrom && !fromTo) params.set("range", fromRange);
  if (page && page > 1) params.set("page", String(page));
  if (after) params.set("after", after);
  const q = params.toString();
  return q ? `/recaps/list?${q}` : "/recaps/list";
}

export type ParsedRecapListUrlFilters = {
  status: RecapListStatus;
  activation: RecapActivationFilter;
  q: string;
  retailer: string;
  state: string;
  rmm: string;
  ba: string;
  from: string;
  to: string;
  page: number;
};

export function readRecapListUrlFilters(
  searchParams: {
    get: (key: string) => string | null;
    has?: (key: string) => boolean;
  },
  opts: {
    isClient: boolean;
    defaultFrom: string;
    defaultTo: string;
    weekFrom: string;
  },
): ParsedRecapListUrlFilters {
  const status = defaultRecapStatus(opts.isClient, searchParams.get("status"));
  const activation = normalizeRecapActivationFilter(
    searchParams.get("activation"),
  );
  const q = searchParams.get("q") ?? "";
  const retailer = searchParams.get("retailer") || "all";
  const state = searchParams.get("state") || "all";
  const rmm = searchParams.get("rmm") || "all";
  const ba = searchParams.get("ba") ?? "";
  const range = searchParams.get("range");
  const hasFrom = searchParams.has
    ? searchParams.has("from")
    : searchParams.get("from") !== null;
  const hasTo = searchParams.has
    ? searchParams.has("to")
    : searchParams.get("to") !== null;

  let from = opts.defaultFrom;
  let to = opts.defaultTo;
  if (hasFrom || hasTo) {
    from = searchParams.get("from") ?? "";
    to = searchParams.get("to") ?? "";
  } else if (range === "all") {
    from = "";
    to = "";
  } else if (range === "week") {
    from = opts.weekFrom;
    to = opts.defaultTo;
  }

  const pageRaw = Number(searchParams.get("page") ?? "");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return {
    status,
    activation,
    q,
    retailer,
    state,
    rmm,
    ba,
    from,
    to,
    page,
  };
}

export function buildRecapListSearchParams(opts: {
  isClient: boolean;
  status: RecapListStatus;
  activation: RecapActivationFilter;
  q: string;
  retailer: string;
  state: string;
  rmm: string;
  ba: string;
  from: string;
  to: string;
  defaultFrom: string;
  defaultTo: string;
  weekFrom?: string;
  page?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  const pipeline = opts.status === "draft" ? "needs_review" : opts.status;
  const defaultStatus = defaultRecapStatus(opts.isClient, null);
  if (pipeline !== defaultStatus) {
    params.set("status", pipeline);
  }
  if (opts.activation && opts.activation !== "all") {
    params.set("activation", opts.activation);
  }
  const qVal = opts.q.trim();
  if (qVal) params.set("q", qVal);
  if (opts.retailer && opts.retailer !== "all") {
    params.set("retailer", opts.retailer);
  }
  if (opts.state && opts.state !== "all") {
    params.set("state", opts.state);
  }
  if (opts.rmm && opts.rmm !== "all") {
    params.set("rmm", opts.rmm);
  }
  const baVal = opts.ba.trim();
  if (baVal) params.set("ba", baVal);

  const isDefaultWindow =
    opts.from === opts.defaultFrom && opts.to === opts.defaultTo;
  if (!isDefaultWindow) {
    if (!opts.from && !opts.to) {
      params.set("range", "all");
    } else if (
      opts.weekFrom &&
      opts.from === opts.weekFrom &&
      opts.to === opts.defaultTo
    ) {
      params.set("range", "week");
    } else {
      if (opts.from) params.set("from", opts.from);
      if (opts.to) params.set("to", opts.to);
    }
  }

  if (opts.page && Number.isFinite(opts.page) && opts.page > 1) {
    params.set("page", String(Math.floor(opts.page)));
  }
  return params;
}

/**
 * Approve/archive mutate a single Recap node but leave the list
 * connection cache (Needs review = approved:false) untouched. Without a
 * forced network refetch, Back / remount serves store-or-network and the
 * row stays in Needs review until a hard refresh.
 */
const RECAPS_LIST_REFRESH_FLAG = "spark.recaps.forceListRefresh";

export type RecapsListNavState = {
  baName?: string;
  /** Bump SparkRecapsList refreshKey so connections refetch from network. */
  refreshRecaps?: boolean;
};

export function markRecapsListNeedsRefresh(): void {
  try {
    sessionStorage.setItem(RECAPS_LIST_REFRESH_FLAG, "1");
  } catch {
    // private mode / quota — navigate state is the backup
  }
}

export function consumeRecapsListNeedsRefresh(): boolean {
  try {
    if (sessionStorage.getItem(RECAPS_LIST_REFRESH_FLAG) === "1") {
      sessionStorage.removeItem(RECAPS_LIST_REFRESH_FLAG);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function recapsListNavState(
  refresh: boolean,
  baName?: string,
): RecapsListNavState {
  return {
    ...(baName ? { baName } : {}),
    ...(refresh ? { refreshRecaps: true } : {}),
  };
}

export type { RecapActivationFilter };

/**
 * Server filters for the Recaps list (`recaps` / `customRecaps`) and its
 * type chip counts (`recapTypeCounts`), so both read the same rows.
 */
export function recapListServerFilters(opts: {
  tenantId: string;
  isClient: boolean;
  statusFilter: RecapListStatus;
  rmmFilter: string;
  baName: string;
  retailerFilter: string;
  stateFilter: string;
  dateFrom: string;
  dateTo: string;
  activationFilter: RecapActivationFilter;
}) {
  const pipeline: RecapListStatus =
    opts.statusFilter === "draft" ? "needs_review" : opts.statusFilter;
  // Client view never asks for drafts. The server forces this for real
  // client logins; this covers the admin-side "Client view" toggle.
  const approved = opts.isClient
    ? true
    : pipeline === "approved" || pipeline === "shared"
      ? true
      : pipeline === "needs_review"
        ? false
        : null;
  return {
    tenantId: opts.tenantId,
    rmmAsignedId: opts.rmmFilter === "all" ? null : opts.rmmFilter,
    ambassadorId: null,
    ambassadorName: opts.baName.trim() || null,
    approved,
    shared: sharedQueryFilter(opts.isClient, pipeline),
    archived: archivedQueryFilter(opts.isClient, pipeline),
    retailerName: opts.retailerFilter === "all" ? null : opts.retailerFilter,
    stateCode: opts.stateFilter === "all" ? null : opts.stateFilter,
    startDate: opts.dateFrom || null,
    endDate: opts.dateTo || null,
    recapType:
      opts.activationFilter === "all" ? null : opts.activationFilter,
  };
}

export type RecapTypeChip = {
  key: RecapActivationFilter;
  label: string;
  count: number | null;
};

/**
 * Type chips for the list toolbar from `recapTypeCounts`. Empty (hide the
 * control) when the tenant has one type or none — unless a type is
 * already picked, so it can still be cleared.
 */
export function recapTypeChips(
  counts: {
    total: number;
    types: ReadonlyArray<{ key: string; label: string; count: number }>;
  } | null,
  active: RecapActivationFilter,
): RecapTypeChip[] {
  const types: RecapTypeChip[] = (counts?.types ?? []).flatMap((t) => {
    const key = normalizeRecapActivationFilter(t.key);
    return key === "all" ? [] : [{ key, label: t.label, count: t.count }];
  });
  if (active !== "all" && !types.some((t) => t.key === active)) {
    types.push({
      key: active,
      label: recapActivationFilterLabel(active),
      count: counts ? 0 : null,
    });
  }
  if (types.length < 2 && active === "all") return [];
  return [
    { key: "all", label: "All", count: counts ? counts.total : null },
    ...types,
  ];
}

export function recapMatchesBaName(
  baQuery: string,
  recapBaName: string,
): boolean {
  const q = baQuery.trim().toLowerCase();
  if (!q) return true;
  return recapBaName.toLowerCase().includes(q);
}

export function recapEmptyKind(opts: {
  isClient: boolean;
  queueEmpty: boolean;
  filterChips: { key: string }[];
}): RecapEmptyKind {
  if (opts.queueEmpty) return "queue";
  // Client default is approved + 30d. The 30d chip is the window, not
  // a user emptying the list — don't say "these filters emptied it".
  if (opts.isClient && opts.filterChips.every((c) => c.key === "date")) {
    return "window";
  }
  return "filters";
}
