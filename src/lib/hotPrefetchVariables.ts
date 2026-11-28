/**
 * Exact variable builders for idle Relay data prefetching.
 *
 * Relay's normalized store caches queries by exact variable equality — even a
 * small mismatch (`first: 100` vs `first: 300`, or `statusSlug` vs
 * `statusSlugs`) causes a 100% cache miss and a wasted backend round-trip.
 *
 * Kept Relay-free so unit tests verify exact alignment before Relay codegen.
 */

import { ACTIVE_STATUS_SLUGS } from "@/requests/masterTrackerFilters";

/** Must match `AWAITING_SLUGS` in SparkApprovals.tsx. */
export const APPROVALS_AWAITING_SLUGS = ["pending", "queue"] as const;

/** Must match `decidedVariables` in SparkApprovals.tsx. */
export const APPROVALS_DECIDED_SLUGS = ["approved", "declined"] as const;

/** Must match `TRACKER_PAGE_SIZE` in MasterTracker.tsx. */
export const TRACKER_DEFAULT_PAGE_SIZE = 50;

/** Local YYYY-MM-DD formatter matching SparkClientDashboard & SparkReports. */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Exact initial queue variables for SparkApprovals (`ApprovalsInner`). */
export function approvalsQueuePrefetchVariables(tenantId: string) {
  return {
    first: 300,
    filters: { tenantId, statusSlugs: [...APPROVALS_AWAITING_SLUGS] },
  };
}

/** Exact initial recently-decided variables for SparkApprovals (`ApprovalsInner`). */
export function approvalsDecidedPrefetchVariables(tenantId: string) {
  return {
    first: 300,
    filters: { tenantId, statusSlugs: [...APPROVALS_DECIDED_SLUGS] },
  };
}

/** Exact initial variables for MasterTracker (`MasterTrackerInner`). */
export function trackerDefaultPrefetchVariables(tenantId: string) {
  return {
    first: TRACKER_DEFAULT_PAGE_SIZE,
    after: null as string | null,
    q: null as string | null,
    filters: {
      tenantId,
      rmmAsigned: null as string | null,
      statusSlugs: [...ACTIVE_STATUS_SLUGS],
      dateSort: "desc",
      schedulingStatus: null as string | null,
      unstaffed: null as boolean | null,
      stateCode: null as string | null,
      activationPlanId: null as string | null,
    },
  };
}

/** Exact default 30-day lookahead rollup variables for SparkClientDashboard. */
export function clientDashboardRollupVariables(
  tenantId: string,
  now: Date = new Date(),
) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() + 30);
  return {
    tenantId,
    startDate: localYmd(today),
    endDate: localYmd(end),
    dateField: "date",
  };
}

/** Exact default 90-day rollup variables for SparkReports (`useReportsRequestsRollup`). */
export function programReportsRollupVariables(
  tenantId: string,
  now: Date = new Date(),
) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 90);
  return {
    tenantId,
    startDate: localYmd(start),
    endDate: localYmd(end),
    dateField: "created_at",
  };
}

/** Exact default 90-day KPI variables for SparkReports (`TenantConversionKpisQuery`). */
export function programReportsConversionVariables(
  tenantId: string,
  now: Date = new Date(),
) {
  const rollup = programReportsRollupVariables(tenantId, now);
  return {
    tenantId: rollup.tenantId,
    startDate: rollup.startDate,
    endDate: rollup.endDate,
  };
}
