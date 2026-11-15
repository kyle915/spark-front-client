import { useLazyLoadQuery } from "react-relay/hooks";
import { ConsumerBreakdownQuery } from "@/api/queries/ConsumerBreakdownQuery";
import type { ConsumerBreakdownQuery as ConsumerBreakdownQueryType } from "@api/queries/__generated__/ConsumerBreakdownQuery.graphql";

export type ConsumerBreakdown = NonNullable<
  ConsumerBreakdownQueryType["response"]["tenantConsumerBreakdown"]
>;

/**
 * Consumers sampled by week, store and state for one client and window.
 * Every caller with the same client and dates shares one request, so a
 * headline and the charts under it read the same rollup. Null when the
 * server could not build it.
 */
export function useConsumerBreakdown(
  tenantId: string,
  startDate: string,
  endDate: string,
): ConsumerBreakdown | null {
  const data = useLazyLoadQuery<ConsumerBreakdownQueryType>(
    ConsumerBreakdownQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  return data.tenantConsumerBreakdown ?? null;
}
