import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";

/**
 * Spark v2 — Workflow Inbox.
 *
 * Pivot from the original "chats UI" placeholder to a real action-
 * items list. Surfaces what needs kyle's attention right now,
 * sorted by urgency:
 *
 *   1. SLA breach — pending request >72h old
 *   2. Pending — needs approve/decline call
 *   3. Recently declined — kyle's team usually wants to follow up
 *
 * Each item is clickable, routes to the relevant detail page.
 * Empty state celebrates the absence of work to do.
 */

type ActionItem = {
  uuid: string;
  reqId: string;
  venue: string;
  market: string;
  requester: string;
  whenIso: string;
  kind: "sla" | "pending" | "declined";
};

const fmtAgo = (iso: string): string => {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000)
      return `${Math.floor(diff / 86_400_000)}d ago`;
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

const KIND_META: Record<
  ActionItem["kind"],
  { label: string; tone: string; cta: string }
> = {
  sla: {
    label: "SLA BREACH · OPEN >72H",
    tone: "var(--spark-orange)",
    cta: "Approve / decline →",
  },
  pending: {
    label: "PENDING · NEEDS CALL",
    tone: "var(--spark-gold)",
    cta: "Review →",
  },
  declined: {
    label: "DECLINED · FOLLOW UP",
    tone: "var(--spark-sky)",
    cta: "Open →",
  },
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 500, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  // Track which items kyle has dismissed (per-user localStorage).
  // Lets him clear the inbox progressively without a backend.
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("@spark.inbox.dismissed");
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  const persistDismissed = (next: Set<string>) => {
    try {
      localStorage.setItem(
        "@spark.inbox.dismissed",
        JSON.stringify([...next]),
      );
    } catch {
      /* ignore */
    }
  };

  const items: ActionItem[] = useMemo(() => {
    const rows =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];

    const cutoff72 = Date.now() - 72 * 60 * 60 * 1000;
    const cutoff7d = Date.now() - 7 * 86_400_000;
    const out: ActionItem[] = [];

    for (const r of rows) {
      const slug = (r.status?.slug ?? r.status?.name ?? "")
        .toString()
        .toLowerCase();
      const created = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
      const updated = r.updatedAt ? new Date(r.updatedAt).getTime() : NaN;
      const id = String(r.id);
      const reqId = `REQ-${id.slice(-4).toUpperCase()}`;
      const venue = r.retailer?.name ?? r.name ?? "—";
      const market =
        [r.retailer?.location?.name, r.retailer?.location?.state?.code]
          .filter(Boolean)
          .join(", ") || "—";
      const requester = r.client?.name ?? r.distributor?.name ?? "—";

      if (slug === "pending") {
        const isBreach = Number.isFinite(created) && created <= cutoff72;
        out.push({
          uuid: String(r.uuid),
          reqId,
          venue,
          market,
          requester,
          whenIso: r.createdAt ?? "",
          kind: isBreach ? "sla" : "pending",
        });
      } else if (
        slug === "declined" &&
        Number.isFinite(updated) &&
        updated >= cutoff7d
      ) {
        out.push({
          uuid: String(r.uuid),
          reqId,
          venue,
          market,
          requester,
          whenIso: r.updatedAt ?? "",
          kind: "declined",
        });
      }
    }

    // Sort: SLA breach first, then by age (oldest pending first since
    // it's been waiting longest), then declined by recency.
    const rank: Record<ActionItem["kind"], number> = {
      sla: 0,
      pending: 1,
      declined: 2,
    };
    return out
      .filter((i) => !dismissed.has(i.uuid))
      .sort((a, b) => {
        if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
        // Within sla/pending: oldest first (most urgent).
        if (a.kind !== "declined") {
          return (
            new Date(a.whenIso).getTime() - new Date(b.whenIso).getTime()
          );
        }
        // Within declined: most recent first.
        return new Date(b.whenIso).getTime() - new Date(a.whenIso).getTime();
      });
  }, [data, dismissed]);

  const counts = useMemo(
    () => ({
      sla: items.filter((i) => i.kind === "sla").length,
      pending: items.filter((i) => i.kind === "pending").length,
      declined: items.filter((i) => i.kind === "declined").length,
    }),
    [items],
  );

  const dismissOne = (uuid: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(uuid);
      persistDismissed(next);
      return next;
    });
  };

  const dismissAll = () => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const i of items) next.add(i.uuid);
      persistDismissed(next);
      return next;
    });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {items.length} ITEMS · ACTION REQUIRED
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            What needs you.
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Workflow items pulled from your live request queue —
            triaged by urgency. Dismissing an item hides it just for
            you; the underlying request stays put.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LinkedSheetChip />
          {items.length > 0 && (
            <button
              onClick={dismissAll}
              className="mono text-[10px] px-3 py-2 rounded-xl"
              style={{
                letterSpacing: "0.18em",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid var(--spark-border)",
              }}
            >
              DISMISS ALL
            </button>
          )}
        </div>
      </div>

      {/* Mini stat strip */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="spark-card p-4">
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-orange)",
              }}
            >
              SLA BREACH
            </p>
            <p
              className="tab-num text-2xl font-bold"
              style={{ color: "var(--spark-orange)" }}
            >
              {counts.sla}
            </p>
          </div>
          <div className="spark-card p-4">
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-gold)",
              }}
            >
              PENDING
            </p>
            <p
              className="tab-num text-2xl font-bold"
              style={{ color: "var(--spark-gold)" }}
            >
              {counts.pending}
            </p>
          </div>
          <div className="spark-card p-4">
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-sky)",
              }}
            >
              DECLINED · 7D
            </p>
            <p
              className="tab-num text-2xl font-bold"
              style={{ color: "var(--spark-sky)" }}
            >
              {counts.declined}
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div
          className="spark-card p-10 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          <p
            className="mono text-[10px] mb-2"
            style={{
              letterSpacing: "0.22em",
              color: "var(--spark-lime)",
            }}
          >
            ALL CLEAR
          </p>
          <p className="text-sm">
            Inbox zero. Nothing in the queue needs your attention
            right now.
          </p>
        </div>
      ) : (
        <div className="spark-card overflow-hidden">
          <ul>
            {items.map((it, i) => {
              const meta = KIND_META[it.kind];
              const target =
                it.kind === "declined"
                  ? `/request/view/${it.uuid}`
                  : "/approvals";
              // Pass /inbox as the back-target so SparkRequestView's
              // "← BACK" returns here instead of /requests/list.
              const navOpts =
                it.kind === "declined"
                  ? ({ state: { from: "/inbox" } } as const)
                  : undefined;
              return (
                <li
                  key={it.uuid}
                  className="px-5 py-4 transition"
                  style={{
                    borderBottom:
                      i < items.length - 1
                        ? "1px solid var(--spark-border)"
                        : "none",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.025)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{
                        background: meta.tone,
                        boxShadow: `0 0 8px ${meta.tone}`,
                      }}
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(target, navOpts)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.18em",
                            color: meta.tone,
                          }}
                        >
                          {meta.label}
                        </span>
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          · {it.reqId} · {fmtAgo(it.whenIso).toUpperCase()}
                        </span>
                      </div>
                      <p
                        className="font-semibold mt-1"
                        style={{ color: "var(--spark-text)" }}
                      >
                        {it.venue}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {it.market} · {it.requester}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      <button
                        onClick={() => navigate(target, navOpts)}
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: meta.tone,
                        }}
                      >
                        {meta.cta.toUpperCase()}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissOne(it.uuid);
                        }}
                        className="mono text-[10px]"
                        title="Hide this item from your inbox (doesn't affect the request)"
                        style={{
                          letterSpacing: "0.14em",
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        × DISMISS
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function SparkInbox() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-4xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading inbox…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
