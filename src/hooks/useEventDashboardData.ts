import { useLazyLoadQuery } from "react-relay";
import { EventDashboardQuery } from "@/api/queries/EventDashboardQuery";
import type { EventDashboardQuery as EventDashboardQueryType } from "@/api/queries/__generated__/EventDashboardQuery.graphql";

export function useEventDashboardData(
  tenantId: string,
  filters: EventDashboardQueryType["variables"]["filters"],
  fetchKey: number
) {
  const tenantFilter = { ...filters, tenantId };

  const data = useLazyLoadQuery<EventDashboardQueryType>(
    EventDashboardQuery,
    { filters: tenantFilter },
    { fetchKey }
  );

  return {
    dashboard: data.eventDashboard,
    filterOptions: data.eventDashboardFilterOptions,
  };
}
