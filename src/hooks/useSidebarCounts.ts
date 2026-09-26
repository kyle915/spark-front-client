import { useMemo } from "react";
import { fetchQuery, useLazyLoadQuery } from "react-relay/hooks";
import type { IEnvironment } from "relay-runtime";
import { SidebarCountsQuery } from "@/api/queries/SidebarCountsQuery";
import type { SidebarCountsQuery as SidebarCountsQueryType } from "@api/queries/__generated__/SidebarCountsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Live chip badges in the sidebar. Server scalars for tracker / approvals /
 * recaps-due (and pending walk-ups); a tiny 48h candidate list for the
 * unread-alerts chip so we still honor localStorage read keys.
 */
export type SidebarCounts = {
  tracker: number;
  approvals: number;
  approvalsSlaBreach: number;
  upcoming: number;
  done30d: number;
  alertsUnread: number;
  recapsDue: number;
  pendingWalkups: number;
};

const ALERTS_READ_KEY = "@spark.alerts.readKeys.v1";

function loadReadKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(ALERTS_READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

const sidebarCountsVariables = (tenantId: string | null | undefined) => ({
  tenantId: tenantId || null,
});

/** Re-pull the badge counts into the store after a mutation changes them. */
export function refreshSidebarCounts(
  environment: IEnvironment,
  tenantId: string | null | undefined,
): Promise<unknown> {
  return fetchQuery<SidebarCountsQueryType>(
    environment,
    SidebarCountsQuery,
    sidebarCountsVariables(tenantId),
  )
    .toPromise()
    .catch(() => undefined);
}

export function useSidebarCounts(): SidebarCounts {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<SidebarCountsQueryType>(
    SidebarCountsQuery,
    sidebarCountsVariables(tenantId),
    { fetchPolicy: "store-or-network" },
  );

  return useMemo(() => {
    const counts = data?.sidebarRequestCounts;
    let alertsUnread = 0;
    const readKeys = loadReadKeys();
    for (const row of data?.sidebarAlertCandidates ?? []) {
      if (!row) continue;
      const slug = (row.statusSlug ?? "").toLowerCase();
      const id = String(row.id);
      if (slug === "pending") {
        const key = `req:${id}:${row.createdAt}`;
        if (!readKeys.has(key)) alertsUnread += 1;
      }
      if (slug === "approved" || slug === "declined") {
        const kind = slug === "approved" ? "approval" : "decline";
        const key = `${kind}:${id}:${row.updatedAt}`;
        if (!readKeys.has(key)) alertsUnread += 1;
      }
    }
    return {
      tracker: counts?.tracker ?? 0,
      approvals: counts?.approvals ?? 0,
      approvalsSlaBreach: counts?.approvalsSlaBreach ?? 0,
      upcoming: counts?.upcoming ?? 0,
      done30d: counts?.done30d ?? 0,
      alertsUnread,
      recapsDue: counts?.recapsDue ?? 0,
      pendingWalkups: data?.pendingWalkupCount ?? 0,
    };
  }, [data]);
}

export default useSidebarCounts;
