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
      // store-or-network (not network-only): the KPI cards paint instantly
      // from cache on every Master Tracker / Dashboard visit and revalidate
      // in the background, instead of blocking on a fresh heavy aggregation
      // query each load. Bumping `fetchKey` (the Reload button) still forces
      // a network refetch when the user explicitly wants fresh numbers.
      fetchKey,
      fetchPolicy: "store-or-network",
    },
  );

  return {
    dashboard: data.eventDashboard,
    filterOptions: data.eventDashboardFilterOptions,
  };
}
