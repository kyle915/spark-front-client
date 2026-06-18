import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { SidebarCountsQuery } from "@/api/queries/SidebarCountsQuery";
import type { SidebarCountsQuery as SidebarCountsQueryType } from "@api/queries/__generated__/SidebarCountsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { isRecapDue } from "@/lib/recapDue";

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
  approvalsSlaBreach: number; // pending >72h — these need attention NOW
  upcoming: number; // approved + scheduled in next 14d
  done30d: number; // done in last 30 days
  alertsUnread: number; // last-48h request activity minus localStorage-read keys
  // Requests with at least one scheduled event but no recap filed yet.
  // Surfaces the "this needs a recap" pile on the Tracker nav so ops
  // can see it before drilling into the table.
  recapsDue: number;
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

export function useSidebarCounts(): SidebarCounts {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<SidebarCountsQueryType>(
    SidebarCountsQuery,
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
    let approvalsSlaBreach = 0;
    let upcoming = 0;
    let done30d = 0;
    let alertsUnread = 0;
    let recapsDue = 0;
    const readKeys = loadReadKeys();
    const cutoff48 = Date.now() - 48 * 60 * 60 * 1000;
    const cutoff72 = Date.now() - 72 * 60 * 60 * 1000;
    const now = Date.now();
    const days = (n: number) => n * 86_400_000;
    for (const r of rows) {
      const slug = (r.status?.slug ?? r.status?.name ?? "")
        .toString()
        .toLowerCase();
      const isDone = slug === "done" || slug === "completed";
      if (!isDone) tracker += 1;
      if (slug === "pending" || slug === "queue") {
        approvals += 1;
        const createdMs = r.createdAt
          ? new Date(r.createdAt).getTime()
          : Number.NaN;
        if (Number.isFinite(createdMs) && createdMs <= cutoff72) {
          approvalsSlaBreach += 1;
        }
      }
      // Mirror the keying used by SparkAlerts so this count tracks
      // exactly what the user sees there.
      const id = String(r.id);
      const created = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
      const updated = r.updatedAt ? new Date(r.updatedAt).getTime() : NaN;
      if (slug === "pending" && Number.isFinite(created) && created >= cutoff48) {
        const key = `req:${id}:${r.createdAt}`;
        if (!readKeys.has(key)) alertsUnread += 1;
      }
      if (
        (slug === "approved" || slug === "declined") &&
        Number.isFinite(updated) &&
        updated >= cutoff48 &&
        Number.isFinite(created) &&
        updated - created > 5_000
      ) {
        const kind = slug === "approved" ? "approval" : "decline";
        const key = `${kind}:${id}:${r.updatedAt}`;
        if (!readKeys.has(key)) alertsUnread += 1;
      }
      if (r.date) {
        const t = new Date(r.date).getTime();
        if (slug === "approved" || slug === "scheduled") {
          if (t > now && t < now + days(14)) upcoming += 1;
        }
        if (isDone && t > now - days(30) && t < now) done30d += 1;
      }
      // Recap due = events scheduled, no recap filed across any of them.
      // Matches /recaps/missing: "filed" = a legacy OR custom-template recap
      // exists, and only past events within the last 30 days (isRecapDue's
      // default lower bound) count — so the badge stops ratcheting up on
      // ancient un-recapped events. Reads the flat server scalars
      // (eventsCount / recapsFiledCount) instead of the per-event arrays.
      if (
        (r.eventsCount ?? 0) > 0 &&
        (r.recapsFiledCount ?? 0) === 0 &&
        isRecapDue(r.date)
      ) {
        recapsDue += 1;
      }
    }
    return {
      tracker,
      approvals,
      approvalsSlaBreach,
      upcoming,
      done30d,
      alertsUnread,
      recapsDue,
    };
  }, [data]);
}

export default useSidebarCounts;
