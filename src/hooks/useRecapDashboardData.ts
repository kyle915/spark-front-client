import { useLazyLoadQuery } from "react-relay";
import { RecapDashboardQuery } from "@/api/queries/RecapDashboardQuery";
import type { RecapDashboardQuery as RecapDashboardQueryType } from "@/api/queries/__generated__/RecapDashboardQuery.graphql";

export function useRecapDashboardData(
  tenantId: string,
  filters: RecapDashboardQueryType["variables"]["filters"],
  fetchKey: number
) {
  const data = useLazyLoadQuery<RecapDashboardQueryType>(
    RecapDashboardQuery,
    { filters: { ...filters, tenantId } },
    { fetchKey }
  );

  return {
    dashboard: data.recapDashboard,
    filterOptions: data.recapDashboardFilterOptions,
  };
}
