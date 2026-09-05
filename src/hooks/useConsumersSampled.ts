import { useLazyLoadQuery } from "react-relay/hooks";
import { EventDashboardConsumersQuery } from "@/api/queries/EventDashboardConsumersQuery";
import type { EventDashboardConsumersQuery as EventDashboardConsumersQueryType } from "@/api/queries/__generated__/EventDashboardConsumersQuery.graphql";

/** Tracker strip — skinny consumersSampled only (sections: metrics). */
export function useConsumersSampled(
  tenantId: string,
  fetchKey: number = 0,
): number {
  const data = useLazyLoadQuery<EventDashboardConsumersQueryType>(
    EventDashboardConsumersQuery,
    {
      filters: {
        tenantId,
        distributorIds: [],
        rmmAsignedId: null,
        quarter: null,
        startDate: null,
        endDate: null,
        sections: ["metrics"],
      },
    },
    { fetchKey, fetchPolicy: "store-or-network" },
  );
  return data.eventDashboard?.metrics?.consumersSampled ?? 0;
}
