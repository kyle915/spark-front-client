import { useLazyLoadQuery } from "react-relay";
import { DashboardQuery } from "@/api/queries/DashboardQuery";
import type { DashboardQuery as DashboardQueryType } from "@/api/queries/__generated__/DashboardQuery.graphql";

export function useDashboardData() {
  const data = useLazyLoadQuery<DashboardQueryType>(DashboardQuery, {});

  return {
    // metrics: {
    //   totalEvents: data.events?.totalCount ?? 0,
    //   totalRequests: data.requests?.totalCount ?? 0,
    //   totalClients: data.clients?.edges?.length ?? 0,
    //   totalDistributors: data.distributors?.edges?.length ?? 0,
    // },
    metrics: {
      totalEvents: data.events?.totalCount ?? 0,
      consumersSampled: 349,
      brandAwareness: "41.3%",
      purchaseIntent: "62.7%",
    },
    events: data.events?.edges?.map((e) => e.node) ?? [],
    requests: data.requests?.edges?.map((e) => e.node) ?? [],
  };
}
