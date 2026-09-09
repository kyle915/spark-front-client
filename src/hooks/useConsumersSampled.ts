import { useLazyLoadQuery } from "react-relay/hooks";
import { TrackerConsumersQuery } from "@/api/queries/TrackerConsumersQuery";
import type { TrackerConsumersQuery as TrackerConsumersQueryType } from "@/api/queries/__generated__/TrackerConsumersQuery.graphql";
import { collapseSamplingKpis } from "@/lib/collapseSamplingKpis";

/**
 * Tracker strip — consumers sampled from tenantKpis (all-time), collapsed
 * the same way Insights Program KPIs collapses reach/samples/engagements
 * twins. Returns 0 when the tenant has no sampling signal yet.
 */
export function useConsumersSampled(
  tenantId: string,
  fetchKey: number = 0,
): number {
  const data = useLazyLoadQuery<TrackerConsumersQueryType>(
    TrackerConsumersQuery,
    { tenantId, year: null },
    { fetchKey, fetchPolicy: "store-or-network" },
  );
  const k = data.tenantKpis;
  const tiles = collapseSamplingKpis({
    consumersReached: k?.consumersReached ?? 0,
    samplesDistributed: k?.samplesDistributed ?? 0,
    totalEngagements: k?.totalEngagements ?? 0,
  });
  return tiles[0]?.value ?? 0;
}
