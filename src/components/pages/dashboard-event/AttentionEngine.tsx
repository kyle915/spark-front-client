import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { HomeAttentionQuery } from "@/api/queries/HomeAttentionQuery";
import type { HomeAttentionQuery as HomeAttentionQueryType } from "@api/queries/__generated__/HomeAttentionQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Data-driven "What needs you" engine.
 *
 * Home "What needs you" engine. Dashboard-only skinny request fetch —
 * the sidebar badges use server scalars instead of this document.
 */

type AttentionItem = {
  id: string;
  fact: string;
  cta: string;
  to: string;
};

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

export const AttentionEngine: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  const data = useLazyLoadQuery<HomeAttentionQueryType>(
    HomeAttentionQuery,
    { first: 2000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const items: AttentionItem[] = useMemo(() => {
    const out: AttentionItem[] = [];
    const requests =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];

    const stalePending = requests.filter((r) => {
      const slug = (r.status?.slug ?? r.status?.name ?? "").toLowerCase();
      if (!(slug === "pending" || slug === "queue")) return false;
      return ageHours(r.createdAt) > 24;
    });
    if (stalePending.length > 0) {
      out.push({
        id: "stale-pending",
        fact: `${stalePending.length} waiting more than 24 hours`,
        cta: "Review now",
        to: "/approvals",
      });
    }

    const upcomingUnscheduled = requests.filter((r) => {
      if (!isUpcomingWithin(r.date, 7)) return false;
      const slug = (r.status?.slug ?? r.status?.name ?? "").toLowerCase();
      return slug !== "scheduled" && slug !== "done" && slug !== "completed";
    });
    if (upcomingUnscheduled.length > 0) {
      out.push({
        id: "upcoming-unscheduled",
        fact: `${upcomingUnscheduled.length} upcoming, not scheduled`,
        cta: "Open tracker",
        to: "/requests/list",
      });
    }

    return out;
  }, [data]);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col">
      {items.map((it) => (
        <div
          key={it.id}
          className="flex items-center justify-between gap-3 py-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.88)" }}>
            {it.fact}
          </p>
          <button
            type="button"
            onClick={() => navigate(it.to)}
            className="text-sm font-medium shrink-0"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.72)",
              border: "none",
              padding: 0,
            }}
          >
            {it.cta}
          </button>
        </div>
      ))}
    </div>
  );
};

export default AttentionEngine;
