import { useLazyLoadQuery } from "react-relay/hooks";
import { TrackerProductsSoldQuery } from "@/api/queries/TrackerProductsSoldQuery";
import type { TrackerProductsSoldQuery as TrackerProductsSoldQueryType } from "@/api/queries/__generated__/TrackerProductsSoldQuery.graphql";

/**
 * Tracker strip — skinny productsSold from tenantKpis (all-time).
 * Returns null when the tenant has no sold/purchased signal yet so the UI
 * can render "—" instead of a misleading 0.
 */
export function useProductsPurchased(
  tenantId: string,
  fetchKey: number = 0,
): number | null {
  const data = useLazyLoadQuery<TrackerProductsSoldQueryType>(
    TrackerProductsSoldQuery,
    { tenantId, year: null },
    { fetchKey, fetchPolicy: "store-or-network" },
  );
  const n = data.tenantKpis?.productsSold;
  if (n == null || n <= 0) return null;
  return n;
}
