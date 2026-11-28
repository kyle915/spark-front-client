/**
 * Idle Relay data warmup after auth + tenant are known.
 * Complements prefetchHotRoutes + sidebar hover chunk prefetching.
 */
import { fetchQuery } from "relay-runtime";
import type { Environment } from "relay-runtime";
import { TrackerListQuery } from "@/api/queries/TrackerListQuery";
import { RecapListKindsQuery } from "@/api/queries/RecapListKindsQuery";
import type { RecapListKindsQuery as RecapListKindsQueryType } from "@api/queries/__generated__/RecapListKindsQuery.graphql";
import { ApprovalsListQuery } from "@/api/queries/ApprovalsListQuery";
import { TenantRequestsRollupQuery } from "@/api/queries/TenantRequestsRollupQuery";
import { TenantConversionKpisQuery } from "@/api/queries/TenantConversionKpisQuery";
import {
  fetchUnifiedRecapsPage,
  unifiedRecapsPageVariables,
} from "@/recap/unifiedRecapsFetch";
import {
  approvalsDecidedPrefetchVariables,
  approvalsQueuePrefetchVariables,
  clientDashboardRollupVariables,
  programReportsConversionVariables,
  programReportsRollupVariables,
  trackerDefaultPrefetchVariables,
} from "./hotPrefetchVariables";

let warmedKey: string | null = null;

export function prefetchHotRelayData(
  environment: Environment,
  tenantId: string | null | undefined,
  opts?: { isClient?: boolean },
): void {
  if (!tenantId) return;
  const isClient = Boolean(opts?.isClient);
  const key = `${tenantId}:${isClient ? "client" : "admin"}`;
  if (warmedKey === key) return;
  warmedKey = key;

  const warm = () => {
    const filters = { tenantId };
    void fetchQuery<RecapListKindsQueryType>(
      environment,
      RecapListKindsQuery,
      { tenantId },
    )
      .toPromise()
      .then((data) => {
        const kinds = data?.recapListKinds;
        const hasLegacy = Boolean(kinds?.hasLegacy);
        const hasCustom = Boolean(kinds?.hasCustom);
        // Empty probe → warm both so first paint still hits the store.
        const fetchLegacy = hasLegacy || (!hasLegacy && !hasCustom);
        const fetchCustom = hasCustom || (!hasLegacy && !hasCustom);
        const page = unifiedRecapsPageVariables(null);
        void fetchUnifiedRecapsPage(environment, {
          fetchLegacy,
          fetchCustom,
          legacyVariables: {
            ...page.legacy,
            q: null,
            filters,
          },
          customVariables: {
            ...page.custom,
            q: null,
            filters: { ...filters, needsStoreMap: null },
          },
        }).catch(() => {});
      })
      .catch(() => {});

    // Exact default Master Tracker / My Requests variables (guaranteed cache hit).
    void fetchQuery(
      environment,
      TrackerListQuery,
      trackerDefaultPrefetchVariables(tenantId),
    )
      .toPromise()
      .catch(() => {});

    if (isClient) {
      // Client Home 30-day schedule rollup + Program Reports 90-day rollups.
      void fetchQuery(
        environment,
        TenantRequestsRollupQuery,
        clientDashboardRollupVariables(tenantId),
      )
        .toPromise()
        .catch(() => {});

      void fetchQuery(
        environment,
        TenantRequestsRollupQuery,
        programReportsRollupVariables(tenantId),
      )
        .toPromise()
        .catch(() => {});

      void fetchQuery(
        environment,
        TenantConversionKpisQuery,
        programReportsConversionVariables(tenantId),
      )
        .toPromise()
        .catch(() => {});
    } else {
      // Admin Approvals queue + recently decided (exact variable match).
      void fetchQuery(
        environment,
        ApprovalsListQuery,
        approvalsQueuePrefetchVariables(tenantId),
      )
        .toPromise()
        .catch(() => {});

      void fetchQuery(
        environment,
        ApprovalsListQuery,
        approvalsDecidedPrefetchVariables(tenantId),
      )
        .toPromise()
        .catch(() => {});
    }
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 5000 });
  } else {
    setTimeout(warm, 2000);
  }
}

export function resetHotRelayDataPrefetch(): void {
  warmedKey = null;
}
