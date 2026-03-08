import { useLazyLoadQuery } from "react-relay";
import { EventDashboardQuery } from "@/api/queries/EventDashboardQuery";
import type { EventDashboardQuery as EventDashboardQueryType } from "@/api/queries/__generated__/EventDashboardQuery.graphql";

export function useEventDashboardData(
  tenantId: string,
  filters: EventDashboardQueryType["variables"]["filters"] | null,
  fetchKey: number,
) {
  const tenantFilter = {
    tenantId,
    ...(filters ?? {}),
  };

  const data = useLazyLoadQuery<EventDashboardQueryType>(
    EventDashboardQuery,
    { filters: tenantFilter },
    {
      fetchKey,
      fetchPolicy: "network-only",
      networkCacheConfig: { force: true },
    },
  );

  return {
    dashboard: data.eventDashboard,
    filterOptions: data.eventDashboardFilterOptions,
  };
}
