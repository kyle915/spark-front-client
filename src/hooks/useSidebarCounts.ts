import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Computes the live counts shown as chip badges in the sidebar so
 * everything stays in sync with the workspace state.
 *
 * Reuses the same 1000-request fetch the tracker uses; with Relay caching
 * this is free after the first page load.
 */
export type SidebarCounts = {
  tracker: number; // total active (non-done)
  approvals: number; // pending + queue
  upcoming: number; // approved + scheduled in next 14d
  done30d: number; // done in last 30 days
};

export function useSidebarCounts(): SidebarCounts {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  return useMemo(() => {
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    let tracker = 0;
    let approvals = 0;
    let upcoming = 0;
    let done30d = 0;
    const now = Date.now();
    const days = (n: number) => n * 86_400_000;
    for (const r of rows) {
      const slug = (r.status?.slug ?? r.status?.name ?? "")
        .toString()
        .toLowerCase();
      const isDone = slug === "done" || slug === "completed";
      if (!isDone) tracker += 1;
      if (slug === "pending" || slug === "queue") approvals += 1;
      if (r.date) {
        const t = new Date(r.date).getTime();
        if (slug === "approved" || slug === "scheduled") {
          if (t > now && t < now + days(14)) upcoming += 1;
        }
        if (isDone && t > now - days(30) && t < now) done30d += 1;
      }
    }
    return { tracker, approvals, upcoming, done30d };
  }, [data]);
}

export default useSidebarCounts;
