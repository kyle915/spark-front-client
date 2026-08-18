import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { SidebarCountsQuery } from "@/api/queries/SidebarCountsQuery";
import type { SidebarCountsQuery as SidebarCountsQueryType } from "@api/queries/__generated__/SidebarCountsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Data-driven "What needs you" engine.
 *
 * Reuses SidebarCountsQuery (first: 2000) — the same document
 * useSidebarCounts already loaded — so Home does not fire a second
 * RequestsQuery for the first 500 rows.
 */

type AttentionItem = {
  id: string;
  tone: "orange" | "gold" | "sky";
  badge: string;
  headline: string;
  body: string;
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

  const data = useLazyLoadQuery<SidebarCountsQueryType>(
    SidebarCountsQuery,
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
        tone: "orange",
        badge: `${stalePending.length} REQUESTS · 24H+ OLD`,
        headline: "Approval bottleneck",
        body: `${stalePending.length} request${stalePending.length === 1 ? "" : "s"} waiting more than 24 hours`,
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
        tone: "gold",
        badge: `${upcomingUnscheduled.length} UPCOMING · NOT YET SCHEDULED`,
        headline: "Staffing risk this week",
        body: `${upcomingUnscheduled.length} upcoming request${upcomingUnscheduled.length === 1 ? "" : "s"} not yet scheduled`,
        cta: "Open tracker",
        to: "/requests/list",
      });
    }

    return out;
  }, [data]);

  if (items.length === 0) return null;

  return (
    <div>
      <h2
        className="display text-xl font-bold mb-3"
        style={{ letterSpacing: "-0.02em" }}
      >
        What needs you
      </h2>
      <div
        className="grid lg:grid-cols-2 gap-4"
        style={items.length === 1 ? { gridTemplateColumns: "1fr" } : undefined}
      >
        {items.map((it) => {
          const color =
            it.tone === "orange"
              ? "var(--spark-orange)"
              : it.tone === "gold"
                ? "var(--spark-gold)"
                : "var(--spark-sky)";
          return (
            <div
              key={it.id}
              className="spark-card p-5"
              style={{ borderColor: `${color}55` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="spark-dot"
                  style={{
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
                <span
                  className="mono text-[10px]"
                  style={{ letterSpacing: "0.18em", color }}
                >
                  {it.badge}
                </span>
              </div>
              <h4 className="font-bold text-sm leading-snug mb-1.5">
                {it.headline}
              </h4>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {it.body}
              </p>
              <button
                onClick={() => navigate(it.to)}
                className="mt-4 w-full text-xs py-2 rounded-xl transition active:scale-[0.98]"
                style={{
                  background: "transparent",
                  color,
                  border: `1px solid ${color}55`,
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 600,
                }}
              >
                {it.cta} →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttentionEngine;
