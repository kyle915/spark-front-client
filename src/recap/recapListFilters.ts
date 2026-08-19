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
  // still means approved-but-not-shared; "Shared" means shared_at set.
  if (isClient) return null;
  if (pipeline === "shared") return true;
  if (pipeline === "approved") return false;
  return null;
}

export function recapMatchesPipeline(opts: {
  isClient: boolean;
  pipeline: RecapListStatus;
  approved: boolean;
  sharedAt: string | null;
  justApproved: boolean;
}): boolean {
  const { isClient, pipeline, approved, sharedAt, justApproved } = opts;
  if (isClient) return approved || justApproved;
  if (pipeline === "all" || pipeline === "submitted") return true;
  if (pipeline === "needs_review") return !approved || justApproved;
  if (pipeline === "approved") return approved && !sharedAt;
  if (pipeline === "shared") return Boolean(sharedAt);
  return true;
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
