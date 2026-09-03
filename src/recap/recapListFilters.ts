import type { RecapActivationFilter } from "@/lib/activationBucket";
import { normalizeRecapActivationFilter } from "@/lib/activationBucket";

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
  | "all"
  | "draft";

const URL_STATUSES = new Set<string>([
  "needs_review",
  "approved",
  "shared",
  "submitted",
  "all",
]);

export function defaultRecapStatus(
  isClient: boolean,
  statusFromUrl?: string | null,
): RecapListStatus {
  if (isClient) {
    // Ignore ?status=shared / needs_review — those emptied the client
    // view. "all" still means every approved recap (server already
    // hides drafts from clients).
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

export function recapMatchesPipeline(opts: {
  isClient: boolean;
  pipeline: RecapListStatus;
  approved: boolean;
  sharedAt: string | null;
  justApproved: boolean;
  /** Clock-out draft with no photos/metrics — hide from Needs review. */
  emptyShell?: boolean;
}): boolean {
  const { isClient, pipeline, approved, sharedAt, justApproved, emptyShell } =
    opts;
  if (isClient) return approved || justApproved;
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

export function withRecapListReturn(
  href: string,
  listStatus?: string | null,
  listActivation?: string | null,
): string {
  const status = normalizeRecapListStatus(listStatus);
  const activation = normalizeRecapActivationFilter(listActivation);
  if (!status && activation === "all") return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (status) params.set("fromStatus", status);
  if (activation !== "all") params.set("fromActivation", activation);
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
  const pageRaw = Number(opts.searchParams.get("fromPage") ?? "");
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : null;
  const after = opts.searchParams.get("fromAfter");

  const params = new URLSearchParams();
  if (fromStatus) params.set("status", fromStatus);
  if (fromActivation !== "all") params.set("activation", fromActivation);
  if (page && page > 1) params.set("page", String(page));
  if (after) params.set("after", after);
  const q = params.toString();
  return q ? `/recaps/list?${q}` : "/recaps/list";
}

export type { RecapActivationFilter };

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
