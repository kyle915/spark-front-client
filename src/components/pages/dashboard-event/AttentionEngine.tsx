import { useCallback, useEffect, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { HomeAttentionQuery } from "@/api/queries/HomeAttentionQuery";
import type { HomeAttentionQuery as HomeAttentionQueryType } from "@api/queries/__generated__/HomeAttentionQuery.graphql";
import { CountReel } from "@/motion/CountReel";
import { useAuthStore } from "@/store/authStore";

/**
 * Data-driven "What needs you" engine.
 *
 * Two filtered request reads — pending/queue, and the next 7 days —
 * instead of one unfiltered tracker page. Sidebar badges stay on
 * server scalars and do not use this document.
 */

type AttentionItem = {
  id: string;
  count: number;
  fact: string;
  cta: string;
  to: string;
};

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

const StalePendingAttention: React.FC<{
  tenantId: string | null;
  onCount: (count: number) => void;
}> = ({ tenantId, onCount }) => {
  const data = useLazyLoadQuery<HomeAttentionQueryType>(
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
  const count = requestNodes(data).filter((r) => {
    const slug = statusSlug(r);
    if (!(slug === "pending" || slug === "queue")) return false;
    return ageHours(r.createdAt) > 24;
  }).length;
  useEffect(() => {
    onCount(count);
  }, [count, onCount]);
  return null;
};

const UpcomingUnscheduledAttention: React.FC<{
  tenantId: string | null;
  startDate: string;
  endDate: string;
  onCount: (count: number) => void;
}> = ({ tenantId, startDate, endDate, onCount }) => {
  const data = useLazyLoadQuery<HomeAttentionQueryType>(
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
  const count = requestNodes(data).filter((r) => {
    if (!isUpcomingWithin(r.date, 7)) return false;
    const slug = statusSlug(r);
    return slug !== "scheduled" && slug !== "done" && slug !== "completed";
  }).length;
  useEffect(() => {
    onCount(count);
  }, [count, onCount]);
  return null;
};

const AttentionRow: React.FC<{ item: AttentionItem }> = ({ item }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(item.to)}
      className="w-full flex items-center justify-between gap-3 py-3 text-left transition"
      style={{
        borderTop: "1px solid var(--spark-border)",
        background: "transparent",
        borderLeft: "none",
        borderRight: "none",
        borderBottom: "none",
      }}
    >
      <div className="min-w-0 flex items-baseline gap-3">
        <span className="spark-kpi-value spark-kpi-value-sm is-orange shrink-0">
          <CountReel value={item.count} />
        </span>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.88)" }}>
          {item.fact}
        </p>
      </div>
      <span
        className="mono text-[10px] shrink-0"
        style={{ letterSpacing: "0.14em", color: "var(--spark-orange)" }}
      >
        {item.cta.toUpperCase()} →
      </span>
    </button>
  );
};

export const AttentionEngine: React.FC = () => {
  const { tenantId } = useAuthStore();
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + 7);
  const startDate = isoLocalDay(today);
  const endDate = isoLocalDay(end);
  const [staleCount, setStaleCount] = useState<number | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const onStaleCount = useCallback((count: number) => {
    setStaleCount((prev) => (prev === count ? prev : count));
  }, []);
  const onUpcomingCount = useCallback((count: number) => {
    setUpcomingCount((prev) => (prev === count ? prev : count));
  }, []);

  const items: AttentionItem[] = [];
  if ((staleCount ?? 0) > 0) {
    items.push({
      id: "stale-pending",
      count: staleCount ?? 0,
      fact: "waiting more than 24 hours",
      cta: "Review now",
      to: "/approvals",
    });
  }
  if ((upcomingCount ?? 0) > 0) {
    items.push({
      id: "upcoming-unscheduled",
      count: upcomingCount ?? 0,
      fact: "upcoming, not scheduled",
      cta: "Open tracker",
      to: "/requests/list",
    });
  }

  return (
    <>
      <StalePendingAttention
        tenantId={tenantId ?? null}
        onCount={onStaleCount}
      />
      <UpcomingUnscheduledAttention
        tenantId={tenantId ?? null}
        startDate={startDate}
        endDate={endDate}
        onCount={onUpcomingCount}
      />
      {items.length > 0 ? (
        <div className="spark-card spark-stat-band">
          <p className="spark-kpi-delta is-attention mb-1">Attention</p>
          <div className="flex flex-col">
            {items.map((it) => (
              <AttentionRow key={it.id} item={it} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
};

export default AttentionEngine;
