import { useLazyLoadQuery } from "react-relay/hooks";
import { TrackerFirstTimeQuery } from "@/api/queries/TrackerFirstTimeQuery";
import type { TrackerFirstTimeQuery as TrackerFirstTimeQueryType } from "@/api/queries/__generated__/TrackerFirstTimeQuery.graphql";

/**
 * Tracker strip — skinny firstTimeConsumers from tenantKpis (all-time).
 * Returns null when the tenant has no first-time signal yet so the UI
 * can render "—" instead of a misleading 0.
 */
export function useFirstTimeConsumers(
  tenantId: string,
  fetchKey: number = 0,
): number | null {
  const data = useLazyLoadQuery<TrackerFirstTimeQueryType>(
    TrackerFirstTimeQuery,
    { tenantId, year: null },
    { fetchKey, fetchPolicy: "store-or-network" },
  );
  const n = data.tenantKpis?.firstTimeConsumers;
  if (n == null || n <= 0) return null;
  return n;
}
