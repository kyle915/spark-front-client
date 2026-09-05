/**
 * Idle Relay data warmup after auth + tenant are known.
 * Complements prefetchHotRoutes (JS chunks only).
 */
import { fetchQuery } from "relay-runtime";
import type { Environment } from "relay-runtime";
import { TrackerListQuery } from "@/api/queries/TrackerListQuery";
import { RecapListKindsQuery } from "@/api/queries/RecapListKindsQuery";
import type { RecapListKindsQuery as RecapListKindsQueryType } from "@/api/queries/__generated__/RecapListKindsQuery.graphql";
import { CustomRecapsListQuery } from "@/api/queries/CustomRecapsListQuery";
import { RecapsListQuery } from "@/api/queries/RecapsListQuery";
import { ApprovalsListQuery } from "@/api/queries/ApprovalsListQuery";

let warmedForTenant: string | null = null;

export function prefetchHotRelayData(
  environment: Environment,
  tenantId: string | null | undefined,
): void {
  if (!tenantId || warmedForTenant === tenantId) return;
  warmedForTenant = tenantId;

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
        const page = { first: 50, after: null, q: null, filters };
        if (hasCustom || (!hasLegacy && !hasCustom)) {
          void fetchQuery(environment, CustomRecapsListQuery, {
            ...page,
            filters: { ...filters, needsStoreMap: null },
          })
            .toPromise()
            .catch(() => {});
        }
        if (hasLegacy) {
          void fetchQuery(environment, RecapsListQuery, page)
            .toPromise()
            .catch(() => {});
        }
      })
      .catch(() => {});

    void fetchQuery(environment, TrackerListQuery, {
      first: 50,
      after: null,
      q: null,
      filters: {
        tenantId,
        statusSlugs: ["scheduled", "approved", "staffed", "confirmed"],
      },
    })
      .toPromise()
      .catch(() => {});

    void fetchQuery(environment, ApprovalsListQuery, {
      first: 100,
      filters: { tenantId, statusSlug: "pending" },
    })
      .toPromise()
      .catch(() => {});
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 5000 });
  } else {
    setTimeout(warm, 2000);
  }
}

export function resetHotRelayDataPrefetch(): void {
  warmedForTenant = null;
}
