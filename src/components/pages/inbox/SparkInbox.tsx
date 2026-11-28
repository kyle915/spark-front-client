import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { RotateCcw } from "lucide-react";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkGhostButton from "@/shared/SparkGhostButton";
import { LeafTabs, type LeafTabOption } from "@/motion/LeafTabs";
import { ActionMorphButton } from "@/motion/ActionMorphButton";
import type { ActionPhase } from "@/motion/opsMotion";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";
import RequestQuickPeekSheet from "@/requests/RequestQuickPeekSheet";
import { stepQuickPeekIndex, type QuickPeekItem } from "@/requests/quickPeekNav";
import {
  approvableSelectedUuids,
  filterInboxItems,
  INBOX_PAGE_SIZE,
  inboxEndCursor,
  inboxHasMore,
  mergeInboxByUuid,
  stepInboxFocusIndex,
  type InboxFilterTab,
  type InboxKind,
} from "./inboxListFilters";

/**
 * Fire an approve or decline mutation against the request and return
 * a simple {success, message}.
 */
async function callApprovalMutation(
  mutation: "approveRequest" | "declineRequest",
  variables: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const inputType =
    mutation === "approveRequest"
      ? "ApproveRequestInput"
      : "DeclineRequestInput";
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({
      query: `
        mutation Run($input: ${inputType}!) {
          ${mutation}(input: $input) {
            success
            message
          }
        }
      `,
      variables,
    }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    return {
      success: false,
      message: json.errors
        .map((e: { message: string }) => e.message)
        .join("; "),
    };
  }
  const r = json?.data?.[mutation];
  return { success: Boolean(r?.success), message: r?.message ?? "" };
}

type ActionItem = {
  id: string;
  uuid: string;
  reqId: string;
  venue: string;
  market: string;
  address: string | null;
  dateLabel: string;
  statusSlug: string;
  statusLabel: string;
  requester: string;
  whenIso: string;
  kind: InboxKind;
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

type RequestNode = NonNullable<
  NonNullable<
    NonNullable<RequestsQueryType["response"]["requests"]>["edges"]
  >[number]
>["node"];

const toActionItems = (
  nodes: Array<NonNullable<RequestNode>>,
  kinds: ReadonlyArray<"pending" | "declined">,
): ActionItem[] => {
  const cutoff72 = Date.now() - 72 * 60 * 60 * 1000;
  const cutoff7d = Date.now() - 7 * 86_400_000;
  const out: ActionItem[] = [];
  const wantPending = kinds.includes("pending");
  const wantDeclined = kinds.includes("declined");

  for (const r of nodes) {
    const slug = (r.status?.slug ?? r.status?.name ?? "")
      .toString()
      .toLowerCase();
    const created = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
    const updated = r.updatedAt ? new Date(r.updatedAt).getTime() : NaN;
    const id = String(r.id);
    const reqId = `REQ-${id.slice(-4).toUpperCase()}`;
    const venue = r.retailer?.name ?? r.name ?? "—";
    const market = r.market || "—";
    const address = r.address ?? null;
    const dateLabel = r.date
      ? new Date(r.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Date TBD";
    const statusLabel = r.status?.name ?? "Pending";
    const requester = r.client?.name ?? r.distributor?.name ?? "—";

    if (wantPending && slug === "pending") {
      const isBreach = Number.isFinite(created) && created <= cutoff72;
      out.push({
        id,
        uuid: String(r.uuid),
        reqId,
        venue,
        market,
        address,
        dateLabel,
        statusSlug: slug || "pending",
        statusLabel,
        requester,
        whenIso: r.createdAt ?? "",
        kind: isBreach ? "sla" : "pending",
      });
    } else if (
      wantDeclined &&
      slug === "declined" &&
      Number.isFinite(updated) &&
      updated >= cutoff7d
    ) {
      out.push({
        id,
        uuid: String(r.uuid),
        reqId,
        venue,
        market,
        address,
        dateLabel,
        statusSlug: "declined",
        statusLabel: r.status?.name ?? "Declined",
        requester,
        whenIso: r.updatedAt ?? "",
        kind: "declined",
      });
    }
  }
  return out;
};

const nodesFromQuery = (
  data: RequestsQueryType["response"] | null | undefined,
): Array<NonNullable<RequestNode>> =>
  data?.requests?.edges
    ?.map((e) => e?.node)
    ?.filter((n): n is NonNullable<RequestNode> => Boolean(n)) ?? [];

const DoneMarkSvg: React.FC = () => (
  <svg
    className="spark-done-mark mx-auto mb-3"
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="18" cy="18" r="15" />
    <path d="M11.5 18.5 16 23l8.5-9.5" />
  </svg>
);

const InboxSkeleton: React.FC = () => (
  <div
    className="space-y-5 max-w-4xl"
    aria-busy="true"
    aria-label="Loading inbox"
  >
    <div className="space-y-2">
      <div className="skeleton-block" style={{ height: 11, width: 140 }} />
      <div className="skeleton-block" style={{ height: 32, width: 220 }} />
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="spark-card p-4 space-y-2">
          <div className="skeleton-block" style={{ height: 10, width: 80 }} />
          <div className="skeleton-block" style={{ height: 28, width: 48 }} />
        </div>
      ))}
    </div>
    <div className="spark-card p-4 space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton-block" style={{ height: 64 }} />
      ))}
    </div>
  </div>
);

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const environment = useRelayEnvironment();
  const showAlert = useAlertStore((s) => s.showAlert);

  // Server-filtered pages (not silent first:500). Pending + recent
  // declined each get their own cursor window; Load more walks pending.
  const pendingData = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    {
      first: INBOX_PAGE_SIZE,
      filters: tenantId
        ? { tenantId, statusSlugs: ["pending", "queue"] }
        : null,
    },
    { fetchPolicy: "store-or-network" },
  );
  const declinedData = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    {
      first: INBOX_PAGE_SIZE,
      filters: tenantId
        ? { tenantId, statusSlug: "declined", dateSort: "desc" }
        : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const [actingOn, setActingOn] = useState<{
    uuid: string;
    verb: "approve" | "decline";
  } | null>(null);
  const [rowPhases, setRowPhases] = useState<Record<string, ActionPhase>>({});
  const [exitingUuids, setExitingUuids] = useState<Set<string>>(new Set());
  const [bulkPhase, setBulkPhase] = useState<ActionPhase>("idle");

  const [activeTab, setActiveTab] = useState<InboxFilterTab>("all");
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const [optimisticallyResolved, setOptimisticallyResolved] = useState<
    Set<string>
  >(new Set());
  const [extraPending, setExtraPending] = useState<ActionItem[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Undo state for 4.5-second dismiss recovery.
  const [undoBanner, setUndoBanner] = useState<{
    uuids: string[];
    label: string;
  } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (undoTimerRef.current != null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const page1Pending = useMemo(
    () => toActionItems(nodesFromQuery(pendingData), ["pending"]),
    [pendingData],
  );
  const page1Declined = useMemo(
    () => toActionItems(nodesFromQuery(declinedData), ["declined"]),
    [declinedData],
  );

  const pendingRosterKey = [
    tenantId ?? "",
    inboxEndCursor(pendingData?.requests?.pageInfo) ?? "",
    String(Boolean(pendingData?.requests?.pageInfo?.hasNextPage)),
    String(page1Pending.length),
  ].join("|");

  useEffect(() => {
    setExtraPending([]);
    setEndCursor(inboxEndCursor(pendingData?.requests?.pageInfo));
    setHasMore(inboxHasMore(pendingData?.requests?.pageInfo));
    setLoadMoreError(null);
    loadingMoreRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roster key
  }, [pendingRosterKey]);

  const pendingItems = useMemo(
    () => mergeInboxByUuid(page1Pending, extraPending),
    [page1Pending, extraPending],
  );

  const allItems: ActionItem[] = useMemo(() => {
    const rank: Record<ActionItem["kind"], number> = {
      sla: 0,
      pending: 1,
      declined: 2,
    };
    return [...pendingItems, ...page1Declined]
      .filter(
        (i) =>
          !dismissed.has(i.uuid) &&
          !optimisticallyResolved.has(i.uuid),
      )
      .sort((a, b) => {
        if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
        if (a.kind !== "declined") {
          return (
            new Date(a.whenIso).getTime() - new Date(b.whenIso).getTime()
          );
        }
        return new Date(b.whenIso).getTime() - new Date(a.whenIso).getTime();
      });
  }, [pendingItems, page1Declined, dismissed, optimisticallyResolved]);

  const counts = useMemo(
    () => ({
      all: allItems.length,
      sla: allItems.filter((i) => i.kind === "sla").length,
      pending: allItems.filter((i) => i.kind === "pending").length,
      declined: allItems.filter((i) => i.kind === "declined").length,
    }),
    [allItems],
  );

  const items = useMemo(
    () => filterInboxItems(allItems, activeTab),
    [allItems, activeTab],
  );

  useEffect(() => {
    setFocusedIndex((cur) =>
      items.length === 0 ? 0 : Math.min(cur, items.length - 1),
    );
  }, [items.length]);

  const tabOptions: readonly LeafTabOption<InboxFilterTab>[] = useMemo(
    () => [
      { key: "all", label: `All · ${counts.all}` },
      { key: "sla", label: `SLA Breach · ${counts.sla}` },
      { key: "pending", label: `Pending · ${counts.pending}` },
      { key: "declined", label: `Declined · ${counts.declined}` },
    ],
    [counts],
  );

  const loadMorePending = useCallback(async () => {
    if (!tenantId || !endCursor || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const next = await fetchQuery<RequestsQueryType>(
        environment,
        RequestsQuery,
        {
          first: INBOX_PAGE_SIZE,
          after: endCursor,
          filters: { tenantId, statusSlugs: ["pending", "queue"] },
        },
        { fetchPolicy: "network-only" },
      ).toPromise();
      const mapped = toActionItems(nodesFromQuery(next), ["pending"]);
      setExtraPending((prev) => mergeInboxByUuid(prev, mapped));
      setEndCursor(inboxEndCursor(next?.requests?.pageInfo));
      setHasMore(inboxHasMore(next?.requests?.pageInfo));
    } catch (e) {
      setLoadMoreError(
        e instanceof Error ? e.message : "Could not load more inbox items.",
      );
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [tenantId, endCursor, hasMore, environment]);

  const animateOutAndCommit = useCallback(
    (uuids: string[], commit: () => void) => {
      if (uuids.length === 0) return;
      setExitingUuids((prev) => {
        const next = new Set(prev);
        for (const u of uuids) next.add(u);
        return next;
      });
      window.setTimeout(() => {
        commit();
        setExitingUuids((prev) => {
          const next = new Set(prev);
          for (const u of uuids) next.delete(u);
          return next;
        });
        setSelectedUuids((prev) => {
          if (prev.size === 0) return prev;
          const next = new Set(prev);
          for (const u of uuids) next.delete(u);
          return next;
        });
      }, 200);
    },
    [],
  );

  const stageUndo = useCallback((uuids: string[], label: string) => {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current);
    }
    setUndoBanner({ uuids, label });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoBanner(null);
      undoTimerRef.current = null;
    }, 4500);
  }, []);

  const handleUndoDismiss = useCallback(() => {
    if (!undoBanner) return;
    const restore = undoBanner.uuids;
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoBanner(null);
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const u of restore) next.delete(u);
      persistDismissed(next);
      return next;
    });
  }, [undoBanner]);

  const dismissMany = useCallback(
    (uuids: string[], customLabel?: string) => {
      if (uuids.length === 0) return;
      animateOutAndCommit(uuids, () => {
        setDismissed((prev) => {
          const next = new Set(prev);
          for (const u of uuids) next.add(u);
          persistDismissed(next);
          return next;
        });
        stageUndo(
          uuids,
          customLabel ??
            (uuids.length === 1
              ? "Dismissed 1 item from your inbox."
              : `Dismissed ${uuids.length} items from your inbox.`),
        );
      });
    },
    [animateOutAndCommit, stageUndo],
  );

  const dismissOne = useCallback(
    (uuid: string) => {
      dismissMany([uuid]);
    },
    [dismissMany],
  );

  const dismissAll = () => {
    const targets = items.map((i) => i.uuid);
    dismissMany(targets, `Dismissed ${targets.length} items from view.`);
  };

  const handleApprove = useCallback(
    async (uuid: string) => {
      if (actingOn || bulkPhase !== "idle") return;
      setActingOn({ uuid, verb: "approve" });
      setRowPhases((prev) => ({ ...prev, [uuid]: "pending" }));
      try {
        const result = await callApprovalMutation("approveRequest", {
          input: { uuid },
        });
        if (result.success) {
          setRowPhases((prev) => ({ ...prev, [uuid]: "success" }));
          showAlert(result.message || "Request approved.", "success");
          window.setTimeout(() => {
            animateOutAndCommit([uuid], () => {
              setOptimisticallyResolved((prev) => {
                const next = new Set(prev);
                next.add(uuid);
                return next;
              });
              setRowPhases((prev) => {
                const next = { ...prev };
                delete next[uuid];
                return next;
              });
            });
          }, 260);
        } else {
          setRowPhases((prev) => ({ ...prev, [uuid]: "idle" }));
          showAlert(result.message || "Couldn't approve.", "error");
        }
      } finally {
        setActingOn(null);
      }
    },
    [actingOn, bulkPhase, showAlert, animateOutAndCommit],
  );

  const handleBulkApprove = async () => {
    const uuids = approvableSelectedUuids(allItems, selectedUuids);
    if (uuids.length === 0 || bulkPhase !== "idle" || actingOn) return;
    setBulkPhase("pending");
    const outcomes = await Promise.all(
      uuids.map(async (uuid) => {
        const r = await callApprovalMutation("approveRequest", {
          input: { uuid },
        });
        return { uuid, ok: r.success, message: r.message };
      }),
    );
    const succeeded = outcomes.filter((o) => o.ok).map((o) => o.uuid);
    const failed = outcomes.length - succeeded.length;
    if (succeeded.length > 0) {
      setBulkPhase("success");
      showAlert(
        failed === 0
          ? `Approved ${succeeded.length} ${
              succeeded.length === 1 ? "request" : "requests"
            }.`
          : `Approved ${succeeded.length} of ${outcomes.length} requests (${failed} failed).`,
        failed === 0 ? "success" : "warning",
      );
      window.setTimeout(() => {
        animateOutAndCommit(succeeded, () => {
          setOptimisticallyResolved((prev) => {
            const next = new Set(prev);
            for (const u of succeeded) next.add(u);
            return next;
          });
        });
        setBulkPhase("idle");
      }, 320);
    } else {
      setBulkPhase("idle");
      showAlert(outcomes[0]?.message || "Couldn't approve selected requests.", "error");
    }
  };

  const handleDecline = async (uuid: string, reason: string) => {
    if (actingOn) return;
    setActingOn({ uuid, verb: "decline" });
    try {
      const result = await callApprovalMutation("declineRequest", {
        input: { uuid, reason: reason.trim() || undefined },
      });
      if (result.success) {
        showAlert(result.message || "Request declined.", "success");
        setDeclineFor(null);
        setDeclineReason("");
        animateOutAndCommit([uuid], () => {
          setOptimisticallyResolved((prev) => {
            const next = new Set(prev);
            next.add(uuid);
            return next;
          });
        });
      } else {
        showAlert(result.message || "Couldn't decline.", "error");
      }
    } finally {
      setActingOn(null);
    }
  };

  const toggleSelectOne = useCallback((uuid: string) => {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }, []);

  const allVisibleSelected =
    items.length > 0 && items.every((i) => selectedUuids.has(i.uuid));
  const toggleSelectAllVisible = () => {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const i of items) next.delete(i.uuid);
      } else {
        for (const i of items) next.add(i.uuid);
      }
      return next;
    });
  };

  // Superhuman-style keyboard triage when Quick-Peek is closed.
  useEffect(() => {
    if (peekIndex !== null || items.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((cur) => {
          const next = stepInboxFocusIndex(cur, items.length, 1);
          const u = items[next]?.uuid;
          if (u) rowRefs.current.get(u)?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((cur) => {
          const next = stepInboxFocusIndex(cur, items.length, -1);
          const u = items[next]?.uuid;
          if (u) rowRefs.current.get(u)?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "x") {
        const focused = items[focusedIndex];
        if (focused) {
          e.preventDefault();
          toggleSelectOne(focused.uuid);
        }
      } else if (e.key === "a") {
        const focused = items[focusedIndex];
        if (focused && (focused.kind === "sla" || focused.kind === "pending")) {
          e.preventDefault();
          void handleApprove(focused.uuid);
        }
      } else if (e.key === "e") {
        const focused = items[focusedIndex];
        if (focused) {
          e.preventDefault();
          dismissOne(focused.uuid);
        }
      } else if (e.key === "Enter" && target?.tagName !== "BUTTON") {
        if (items[focusedIndex]) {
          e.preventDefault();
          setPeekIndex(focusedIndex);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    peekIndex,
    items,
    focusedIndex,
    toggleSelectOne,
    handleApprove,
    dismissOne,
  ]);

  const bulkApprovableCount = useMemo(
    () => approvableSelectedUuids(allItems, selectedUuids).length,
    [allItems, selectedUuids],
  );

  return (
    <div
      className={`space-y-5 max-w-4xl spark-fade-in ${
        selectedUuids.size > 0 || undoBanner ? "pb-24" : ""
      }`.trim()}
    >
      <SparkPageHeader
        eyebrow={`${counts.all} items · action required`}
        title="What needs you"
        infoTip="Use j/k to move, x to select, a to approve, and e to dismiss (with Undo). Dismissing hides an item just for you."
        action={
          <>
            <LinkedSheetChip />
            {items.length > 0 ? (
              <SparkGhostButton onClick={dismissAll}>Dismiss all</SparkGhostButton>
            ) : null}
          </>
        }
      />

      {/* Interactive urgency stat cards */}
      {counts.all > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              {
                key: "sla" as const,
                label: "SLA BREACH",
                count: counts.sla,
                color: "var(--spark-orange)",
              },
              {
                key: "pending" as const,
                label: "PENDING",
                count: counts.pending,
                color: "var(--spark-gold)",
              },
              {
                key: "declined" as const,
                label: "DECLINED · 7D",
                count: counts.declined,
                color: "var(--spark-sky)",
              },
            ] as const
          ).map((card) => {
            const active = activeTab === card.key;
            return (
              <button
                key={card.key}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setActiveTab((cur) => (cur === card.key ? "all" : card.key))
                }
                className="spark-card p-4 text-left transition cursor-pointer"
                style={{
                  outline: active ? `1.5px solid ${card.color}` : undefined,
                  background: active
                    ? "rgba(var(--spark-ink-rgb), 0.04)"
                    : undefined,
                }}
              >
                <p
                  className="mono text-[10px] mb-1"
                  style={{
                    letterSpacing: "0.18em",
                    color: card.color,
                  }}
                >
                  {card.label}
                </p>
                <p
                  className="tab-num text-2xl font-bold"
                  style={{ color: card.color }}
                >
                  {card.count}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter LeafTabs + keyboard shortcut legend */}
      {counts.all > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <LeafTabs
            options={tabOptions}
            value={activeTab}
            onChange={setActiveTab}
            ariaLabel="Filter inbox by urgency"
          />
          <span
            className="hidden sm:inline-block mono text-[10px]"
            style={{
              letterSpacing: "0.08em",
              color: "var(--spark-text-meta)",
            }}
          >
            j/k move · x select · a approve · e dismiss
          </span>
        </div>
      )}

      {/* List or Inbox Zero */}
      {items.length === 0 ? (
        <div
          className="spark-card p-10 text-center"
          style={{ color: "var(--spark-text-meta)" }}
        >
          <DoneMarkSvg />
          <p
            className="mono text-[10px] mb-1.5"
            style={{
              letterSpacing: "0.22em",
              color: "var(--spark-ok-ink, var(--spark-lime))",
            }}
          >
            {counts.all === 0 ? "ALL CLEAR" : "FILTER CLEAR"}
          </p>
          <p className="text-sm font-medium" style={{ color: "var(--spark-text)" }}>
            {counts.all === 0
              ? "Inbox zero."
              : `No ${activeTab === "sla" ? "SLA breach" : activeTab} items right now.`}
          </p>
          <p className="text-xs mt-1">
            {counts.all === 0 ? (
              "Nothing in the queue needs your attention right now."
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className="underline cursor-pointer"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Show all {counts.all} inbox items
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="spark-card overflow-hidden">
          <div
            className="px-5 py-2.5 flex items-center justify-between gap-3 text-xs"
            style={{
              borderBottom: "1px solid var(--spark-border)",
              background: "rgba(var(--spark-ink-rgb), 0.02)",
            }}
          >
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                aria-label="Select all visible inbox items"
                style={{ accentColor: "var(--spark-lime)" }}
              />
              <span style={{ color: "var(--spark-text-secondary)" }}>
                {selectedUuids.size > 0
                  ? `${selectedUuids.size} selected`
                  : `Select visible (${items.length})`}
              </span>
            </label>
            {activeTab !== "all" ? (
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className="underline cursor-pointer"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Reset filter
              </button>
            ) : null}
          </div>

          <ul>
            {items.map((it, i) => {
              const meta = KIND_META[it.kind];
              const isSelected = selectedUuids.has(it.uuid);
              const isFocused = i === focusedIndex;
              const isExiting = exitingUuids.has(it.uuid);
              const rowPhase = rowPhases[it.uuid] ?? "idle";
              const target =
                it.kind === "declined"
                  ? `/request/view/${it.uuid}`
                  : "/approvals";
              const navOpts =
                it.kind === "declined"
                  ? ({ state: { from: "/inbox" } } as const)
                  : undefined;
              return (
                <li
                  key={it.uuid}
                  ref={(el) => {
                    if (el) rowRefs.current.set(it.uuid, el);
                    else rowRefs.current.delete(it.uuid);
                  }}
                  onMouseEnter={() => setFocusedIndex(i)}
                  className="px-5 py-4"
                  style={{
                    borderBottom:
                      i < items.length - 1
                        ? "1px solid var(--spark-border)"
                        : "none",
                    background: isSelected
                      ? "rgba(var(--spark-ink-rgb), 0.05)"
                      : isFocused
                        ? "rgba(var(--spark-ink-rgb), 0.025)"
                        : "transparent",
                    boxShadow: isFocused
                      ? "inset 2px 0 0 var(--spark-text)"
                      : undefined,
                    opacity: isExiting ? 0 : 1,
                    transform: isExiting ? "translateX(14px)" : "none",
                    transition:
                      "opacity 190ms cubic-bezier(0.22, 1, 0.36, 1), transform 190ms cubic-bezier(0.22, 1, 0.36, 1), background-color 120ms ease",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <label
                      className="pt-1 flex items-center cursor-pointer shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(it.uuid)}
                        aria-label={`Select ${it.venue} (${it.reqId})`}
                        style={{ accentColor: "var(--spark-lime)" }}
                      />
                    </label>
                    <span
                      className="w-1 self-stretch rounded-full shrink-0"
                      style={{
                        background: meta.tone,
                      }}
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setPeekIndex(i)}
                      title="Click to quick-peek in side drawer (j / k to step, a to approve)"
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
                            color: "var(--spark-text-meta)",
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
                        style={{ color: "var(--spark-text-meta)" }}
                      >
                        {it.market} · {it.requester}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      {it.kind === "sla" || it.kind === "pending" ? (
                        <div className="flex items-center gap-2">
                          <ActionMorphButton
                            phase={rowPhase}
                            pendingLabel="Approving…"
                            successLabel="Approved"
                            disabled={
                              Boolean(actingOn && actingOn.uuid !== it.uuid) ||
                              bulkPhase !== "idle"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleApprove(it.uuid);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                            style={{
                              background: "var(--spark-lime)",
                              color: "var(--spark-on-accent)",
                            }}
                            title="Approve this request now (a)"
                          >
                            ✓ Approve
                          </ActionMorphButton>
                          <button
                            disabled={actingOn?.uuid === it.uuid}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeclineFor(
                                declineFor === it.uuid ? null : it.uuid,
                              );
                              setDeclineReason("");
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                            style={{
                              background: "transparent",
                              color: "rgba(255,90,42,0.85)",
                              border: "1px solid rgba(255,90,42,0.4)",
                              opacity:
                                actingOn?.uuid === it.uuid ? 0.5 : 1,
                            }}
                          >
                            {actingOn?.uuid === it.uuid &&
                            actingOn?.verb === "decline"
                              ? "…"
                              : "✕ Decline"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(target, navOpts);
                            }}
                            className="mono text-[10px] cursor-pointer"
                            style={{
                              letterSpacing: "0.14em",
                              color: "var(--spark-text-meta)",
                            }}
                            title="Open the full request view"
                          >
                            OPEN
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => navigate(target, navOpts)}
                          className="mono text-[10px] cursor-pointer"
                          style={{
                            letterSpacing: "0.14em",
                            color: meta.tone,
                          }}
                        >
                          {meta.cta.toUpperCase()}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissOne(it.uuid);
                        }}
                        className="mono text-[10px] cursor-pointer"
                        title="Hide this item from your inbox (e)"
                        style={{
                          letterSpacing: "0.14em",
                          color: "var(--spark-text-meta)",
                        }}
                      >
                        × DISMISS
                      </button>
                    </div>
                  </div>
                  {declineFor === it.uuid && (
                    <div
                      className="mt-3 ml-7 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="Reason (optional) — sent to the requester"
                        className="flex-1 rounded-lg text-sm"
                        style={{
                          background: "var(--spark-bg)",
                          border: "1px solid var(--spark-border)",
                          color: "var(--spark-text)",
                          padding: "0.5rem 0.75rem",
                        }}
                      />
                      <button
                        disabled={actingOn?.uuid === it.uuid}
                        onClick={() =>
                          void handleDecline(it.uuid, declineReason)
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                        style={{
                          background: "rgba(255,90,42,0.95)",
                          color: "#fff",
                          border: "none",
                          opacity:
                            actingOn?.uuid === it.uuid ? 0.5 : 1,
                        }}
                      >
                        Confirm decline
                      </button>
                      <button
                        onClick={() => {
                          setDeclineFor(null);
                          setDeclineReason("");
                        }}
                        className="mono text-[10px] cursor-pointer"
                        style={{
                          letterSpacing: "0.14em",
                          color: "var(--spark-text-meta)",
                        }}
                      >
                        CANCEL
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {(hasMore || loadMoreError) && (
            <div
              className="px-5 py-3 flex flex-wrap items-center gap-3"
              style={{ borderTop: "1px solid var(--spark-border)" }}
            >
              <button
                type="button"
                disabled={loadingMore || !hasMore}
                onClick={() => void loadMorePending()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{
                  background: "rgba(var(--spark-ink-rgb),0.06)",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  opacity: loadingMore || !hasMore ? 0.55 : 1,
                }}
              >
                {loadingMore
                  ? "Loading…"
                  : `Load more pending · ${pendingItems.length} shown`}
              </button>
              {loadMoreError ? (
                <span
                  className="text-xs"
                  style={{ color: "var(--spark-orange)" }}
                >
                  {loadMoreError}
                </span>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedUuids.size > 0 ? (
        <div
          role="region"
          aria-label="Bulk inbox actions"
          className="fixed bottom-4 left-4 right-4 md:left-72 md:right-6 z-30 mx-auto max-w-2xl rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs spark-fade-in"
          style={{
            background: "rgba(var(--spark-bg-rgb), 0.94)",
            border: "1px solid var(--spark-border)",
            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.42)",
            backdropFilter: "saturate(180%) blur(12px)",
            WebkitBackdropFilter: "saturate(180%) blur(12px)",
          }}
        >
          <span className="font-semibold tab-num" style={{ color: "var(--spark-text)" }}>
            {selectedUuids.size} selected
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {bulkApprovableCount > 0 ? (
              <ActionMorphButton
                phase={bulkPhase}
                pendingLabel={`Approving ${bulkApprovableCount}…`}
                successLabel="Approved"
                onClick={() => void handleBulkApprove()}
                className="px-3.5 py-1.5 rounded-xl font-semibold cursor-pointer"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                }}
              >
                ✓ Approve {bulkApprovableCount}
              </ActionMorphButton>
            ) : null}
            <button
              type="button"
              onClick={() => dismissMany([...selectedUuids])}
              className="px-3 py-1.5 rounded-xl font-semibold cursor-pointer"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            >
              Dismiss {selectedUuids.size}
            </button>
            <button
              type="button"
              onClick={() => setSelectedUuids(new Set())}
              className="underline px-1.5 cursor-pointer"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : undoBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 right-4 md:left-72 md:right-6 z-30 mx-auto max-w-md rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs spark-fade-in"
          style={{
            background: "rgba(var(--spark-bg-rgb), 0.95)",
            border: "1px solid var(--spark-border)",
            boxShadow: "0 14px 32px rgba(0, 0, 0, 0.38)",
            backdropFilter: "saturate(180%) blur(12px)",
          }}
        >
          <span style={{ color: "var(--spark-text)" }}>{undoBanner.label}</span>
          <button
            type="button"
            onClick={handleUndoDismiss}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold cursor-pointer"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
            }}
          >
            <RotateCcw size={12} strokeWidth={2.2} />
            Undo
          </button>
        </div>
      ) : null}

      {(() => {
        const clampedIdx =
          peekIndex != null && items.length > 0
            ? Math.min(peekIndex, items.length - 1)
            : null;
        const active = clampedIdx != null ? items[clampedIdx] : null;
        const peekItem: QuickPeekItem | null = active
          ? {
              uuid: active.uuid,
              id: active.id,
              reqLabel: active.reqId,
              venue: active.venue,
              market: active.market !== "—" ? active.market : null,
              address: active.address,
              dateLabel: active.dateLabel,
              statusLabel: active.statusLabel,
              statusSlug: active.statusSlug,
              requester: active.requester !== "—" ? active.requester : null,
              statusNote: KIND_META[active.kind].label,
              fullHref: `/request/view/${active.uuid}`,
              canApprove: active.kind === "sla" || active.kind === "pending",
              isApprovedOptimistic: optimisticallyResolved.has(active.uuid),
            }
          : null;

        return (
          <RequestQuickPeekSheet
            open={peekItem !== null}
            onOpenChange={(next) => {
              if (!next) {
                setPeekIndex(null);
                setDeclineFor(null);
              }
            }}
            item={peekItem}
            index={clampedIdx ?? 0}
            total={items.length}
            onStep={(delta) =>
              setPeekIndex((cur) =>
                cur == null ? null : stepQuickPeekIndex(cur, items.length, delta),
              )
            }
            onOpenFull={(it) => {
              setPeekIndex(null);
              navigate(it.fullHref, { state: { from: "/inbox" } });
            }}
            approving={Boolean(active && actingOn?.uuid === active.uuid)}
            onApprove={
              active && (active.kind === "sla" || active.kind === "pending")
                ? (it) => void handleApprove(it.uuid)
                : undefined
            }
            onDecline={
              active && (active.kind === "sla" || active.kind === "pending")
                ? (it) => {
                    setDeclineFor(it.uuid);
                    setDeclineReason("");
                  }
                : undefined
            }
            extraContent={
              active && declineFor === active.uuid ? (
                <div
                  className="rounded-xl p-3 space-y-2"
                  style={{
                    border: "1px solid var(--spark-border)",
                    background: "var(--spark-surface-2)",
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: "var(--spark-text)" }}>
                    Decline reason (optional — sent to requester)
                  </p>
                  <input
                    autoFocus
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="e.g., Store requested next Saturday instead"
                    className="w-full rounded-lg px-3 py-2 text-xs"
                    style={{
                      background: "var(--spark-field-bg, var(--spark-surface))",
                      border: "1px solid var(--spark-border)",
                      color: "var(--spark-text)",
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actingOn?.uuid === active.uuid}
                      onClick={() => void handleDecline(active.uuid, declineReason)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{
                        background: "var(--spark-orange)",
                        color: "#ffffff",
                      }}
                    >
                      Confirm decline
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeclineFor(null);
                        setDeclineReason("");
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null
            }
          />
        );
      })()}
    </div>
  );
};

export default function SparkInbox() {
  return (
    <Layout>
      <Suspense fallback={<InboxSkeleton />}>
        <Inner />
      </Suspense>
    </Layout>
  );
}
