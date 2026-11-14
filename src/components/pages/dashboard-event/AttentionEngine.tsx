import { useLazyLoadQuery } from "react-relay/hooks";
import { HomeAttentionQuery } from "@/api/queries/HomeAttentionQuery";
import type { HomeAttentionQuery as HomeAttentionQueryType } from "@api/queries/__generated__/HomeAttentionQuery.graphql";

/**
 * Request queues that need someone, for the dashboard's "Needs attention"
 * panel.
 *
 * Two filtered request reads — pending/queue, and the next 7 days —
 * instead of one unfiltered tracker page. Sidebar badges stay on
 * server scalars and do not use this document.
 */

const ATTENTION_CAP = 2000;

const ageHours = (dateStr: string): number => {
  try {
    const t = new Date(dateStr).getTime();
    return (Date.now() - t) / 3_600_000;
  } catch {
    return 0;
  }
};

const isUpcomingWithin = (raw: string | null | undefined, days: number) => {
  if (!raw) return false;
  try {
    const d = new Date(raw);
    const now = new Date();
    const ms = d.getTime() - now.getTime();
    return ms > 0 && ms < days * 86_400_000;
  } catch {
    return false;
  }
};

const isoLocalDay = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const requestNodes = (data: HomeAttentionQueryType["response"]) =>
  data?.requests?.edges
    ?.map((e) => e?.node)
    ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];

const statusSlug = (node: {
  status?: { slug?: string | null; name?: string | null } | null;
}) => (node.status?.slug ?? node.status?.name ?? "").toLowerCase();

export type RequestAttentionCounts = {
  /** Pending or queued for more than 24 hours. */
  stale: number;
  /** Dated in the next 7 days and not scheduled yet. */
  unscheduled: number;
};

/** Suspends while the two request reads load. */
export function useRequestAttentionCounts(
  tenantId: string | null,
): RequestAttentionCounts {
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + 7);
  const startDate = isoLocalDay(today);
  const endDate = isoLocalDay(end);

  const pending = useLazyLoadQuery<HomeAttentionQueryType>(
    HomeAttentionQuery,
    {
      first: ATTENTION_CAP,
      filters: {
        ...(tenantId ? { tenantId } : {}),
        statusSlugs: ["pending", "queue"],
      },
    },
    { fetchPolicy: "store-or-network" },
  );
  const upcoming = useLazyLoadQuery<HomeAttentionQueryType>(
    HomeAttentionQuery,
    {
      first: ATTENTION_CAP,
      filters: {
        ...(tenantId ? { tenantId } : {}),
        startDate,
        endDate,
      },
    },
    { fetchPolicy: "store-or-network" },
  );

  const stale = requestNodes(pending).filter((r) => {
    const slug = statusSlug(r);
    if (!(slug === "pending" || slug === "queue")) return false;
    return ageHours(r.createdAt) > 24;
  }).length;
  const unscheduled = requestNodes(upcoming).filter((r) => {
    if (!isUpcomingWithin(r.date, 7)) return false;
    const slug = statusSlug(r);
    return slug !== "scheduled" && slug !== "done" && slug !== "completed";
  }).length;

  return { stale, unscheduled };
}
