/**
 * Idle & pointer-intent Relay data warmup after auth + tenant are known.
 * Loaded dynamically via `import("@/lib/prefetchHotRelayData")` so none of
 * these Relay query ASTs sit in the cold-boot entry chunk.
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
import {
  getWarmedHotRelayKey,
  hasWarmedIntentKey,
  markWarmedIntentKey,
  resetHotRelayDataPrefetch,
  setWarmedHotRelayKey,
} from "./hotRelayPrefetchState";

export { resetHotRelayDataPrefetch };

function warmRecapsListForTenant(environment: Environment, tenantId: string): void {
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
}

export function prefetchHotRelayData(
  environment: Environment,
  tenantId: string | null | undefined,
  opts?: { isClient?: boolean },
): void {
  if (!tenantId) return;
  const isClient = Boolean(opts?.isClient);
  const key = `${tenantId}:${isClient ? "client" : "admin"}`;
  if (getWarmedHotRelayKey() === key) return;
  setWarmedHotRelayKey(key);

  const warm = () => {
    warmRecapsListForTenant(environment, tenantId);

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

/**
 * Immediate Relay data warmup triggered on sidebar pointer-enter / focus,
 * before the 2–5s idle timer has fired (or right after a workspace switch).
 */
export function prefetchRouteDataOnIntent(
  environment: Environment,
  tenantId: string | null | undefined,
  rawPath: string | null | undefined,
  opts?: { isClient?: boolean },
): void {
  if (!tenantId || !rawPath) return;
  if (typeof navigator !== "undefined") {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (conn?.saveData) return;
  }
  const path = rawPath.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const isClient = Boolean(opts?.isClient);
  const intentKey = `${tenantId}:${isClient ? "client" : "admin"}:${path}`;
  if (hasWarmedIntentKey(intentKey)) return;
  markWarmedIntentKey(intentKey);

  if (path === "/requests/list") {
    void fetchQuery(
      environment,
      TrackerListQuery,
      trackerDefaultPrefetchVariables(tenantId),
    )
      .toPromise()
      .catch(() => {});
    return;
  }

  if (path === "/approvals") {
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
    return;
  }

  if (path === "/recaps/list" || path === "/my-approvals") {
    warmRecapsListForTenant(environment, tenantId);
    return;
  }

  if (path === "/client-dashboard") {
    void fetchQuery(
      environment,
      TenantRequestsRollupQuery,
      clientDashboardRollupVariables(tenantId),
    )
      .toPromise()
      .catch(() => {});
    return;
  }

  if (path === "/reports") {
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
  }
}
