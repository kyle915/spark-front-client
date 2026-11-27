import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { TodayAttentionQueueQuery } from "@/api/queries/RoiPacingQueries";
import { DiscardTodayAttentionItemsMutation } from "@/api/mutations/RoiPacingMutations";
import type { RoiPacingQueriesTodayAttentionQueueQuery as QueueQueryType } from "@/api/queries/__generated__/RoiPacingQueriesTodayAttentionQueueQuery.graphql";
import type { RoiPacingMutationsDiscardTodayAttentionItemsMutation as DiscardMutationType } from "@/api/mutations/__generated__/RoiPacingMutationsDiscardTodayAttentionItemsMutation.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";
import useSparkRole from "@/hooks/useSparkRole";
import {
  BUCKET_VIEW_ALL,
  bucketsWithItems,
  itemKey,
  nextFocusIndex,
  primaryLine,
  type AttentionStripBucket,
  type AttentionStripItem,
} from "./todayAttentionStripHelpers";

/**
 * Condensed action queue above Starts-today / Needs-attention.
 * Bucket tabs + single-line rows; Discard clears the notice for every admin.
 *
 * Ignite Admin chrome only — hidden for brand clients and Client-view preview.
 */

const META = { color: "var(--spark-text-meta)" } as const;

const sevTone = (severity: string): CSSProperties => {
  const s = (severity || "").toLowerCase();
  if (s === "high") {
    return {
      background: "var(--spark-danger-bg, #fde8e8)",
      color: "var(--spark-danger-ink, #7a1f1f)",
      border: "1px solid var(--spark-danger-border, #e8b4b4)",
    };
  }
  if (s === "medium") {
    return {
      background: "var(--spark-warn-bg, #fff4e0)",
      color: "var(--spark-warn-ink, #6b3b00)",
      border: "1px solid var(--spark-warn-border, #e8c98a)",
    };
  }
  return {
    background: "var(--spark-surface-2, var(--spark-surface))",
    color: "var(--spark-text)",
    border: "1px solid var(--spark-border)",
  };
};

const toBuckets = (queue: NonNullable<QueueQueryType["response"]["todayAttentionQueue"]>): AttentionStripBucket[] =>
  bucketsWithItems(
    (queue.buckets ?? []).map((b) => {
      if (!b) return null;
      return {
        key: b.key ?? "",
        label: b.label ?? "",
        count: b.count ?? 0,
        items: (b.items ?? [])
          .filter((row): row is NonNullable<typeof row> => Boolean(row))
          .map((row) => ({
            bucket: row.bucket ?? b.key ?? "",
            title: row.title ?? "",
            subtitle: row.subtitle ?? "",
            severity: row.severity ?? "low",
            actionUrl: row.actionUrl ?? "/",
            actionLabel: row.actionLabel ?? "Open",
            refId: row.refId ?? "",
          })),
      };
    }),
  );

const StripBody: React.FC = () => {
  const baseId = useId();
  const navigate = useNavigate();
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<QueueQueryType>(
    TodayAttentionQueueQuery,
    {},
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const [commitDiscard, discarding] = useMutation<DiscardMutationType>(
    DiscardTodayAttentionItemsMutation,
  );

  const queue = data?.todayAttentionQueue ?? null;
  const buckets = useMemo(
    () => (queue ? toBuckets(queue) : []),
    [queue],
  );

  const [activeKey, setActiveKey] = useState<string>("");
  const [focusIndex, setFocusIndex] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  /** When true, next paint after a tab change focuses the first row. */
  const pendingFocusFirstRow = useRef(false);

  useEffect(() => {
    if (buckets.length === 0) return;
    setActiveKey((prev) =>
      buckets.some((b) => b.key === prev) ? prev : buckets[0].key,
    );
  }, [buckets]);

  const activeBucket = buckets.find((b) => b.key === activeKey) ?? buckets[0] ?? null;
  const visibleItems = useMemo(
    () => (activeBucket ? activeBucket.items : []),
    [activeBucket],
  );

  const focusRow = useCallback((index: number) => {
    setFocusIndex(index);
    rowRefs.current[index]?.focus();
  }, []);

  const selectBucket = useCallback((key: string) => {
    pendingFocusFirstRow.current = true;
    setActiveKey(key);
  }, []);

  useEffect(() => {
    setFocusIndex(0);
    rowRefs.current = [];
    if (!pendingFocusFirstRow.current || visibleItems.length === 0) return;
    pendingFocusFirstRow.current = false;
    // Refs attach after this commit — focus on the next frame.
    const id = requestAnimationFrame(() => {
      rowRefs.current[0]?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [activeKey, visibleItems.length]);

  const bump = useCallback(() => setFetchKey((k) => k + 1), []);

  const discardItems = useCallback(
    (items: AttentionStripItem[]) => {
      const payload = items
        .filter((i) => i.bucket && i.refId)
        .map((i) => ({ bucket: i.bucket, refId: i.refId }));
      if (payload.length === 0) return;
      setBanner(null);
      commitDiscard({
        variables: { items: payload },
        onCompleted: (res) => {
          const result = res?.discardTodayAttentionItems;
          if (!result?.ok) {
            setBanner(result?.reason || "Could not discard.");
            return;
          }
          const n = result.discardedCount ?? payload.length;
          setBanner(
            n === 1
              ? "Discarded for all admins."
              : `Discarded ${n} notices for all admins.`,
          );
          bump();
        },
        onError: () => setBanner("Could not discard."),
      });
    },
    [bump, commitDiscard],
  );

  const onQueueKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (visibleItems.length === 0) return;
    const target = e.target as HTMLElement | null;
    const inRow = Boolean(target?.closest("[data-attention-row]"));
    // Arrow keys always move the queue cursor (from Discard visible, etc.).
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      focusRow(inRow ? nextFocusIndex(focusIndex, 1, visibleItems.length) : 0);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      focusRow(
        inRow
          ? nextFocusIndex(focusIndex, -1, visibleItems.length)
          : visibleItems.length - 1,
      );
      return;
    }
    // Enter / open / discard only when a row is focused — never steal from
    // "Discard visible" or the row's own CTA / Discard controls.
    if (!inRow) return;
    if (target?.closest("a, button")) return;
    const item = visibleItems[Math.max(0, focusIndex)] ?? visibleItems[0];
    if (!item) return;
    if (e.key === "Enter" || e.key === "o") {
      e.preventDefault();
      navigate(item.actionUrl || "/");
      return;
    }
    if (e.key === "d" || e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      discardItems([item]);
    }
  };

  const onTabListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (buckets.length === 0) return;
    const idx = Math.max(
      0,
      buckets.findIndex((b) => b.key === activeBucket?.key),
    );
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectBucket(buckets[(idx + 1) % buckets.length].key);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectBucket(buckets[(idx - 1 + buckets.length) % buckets.length].key);
      return;
    }
    // Drop into the list so advertised ↑↓ / Enter / d work immediately.
    if (
      e.key === "ArrowDown" ||
      e.key === "j" ||
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();
      setFocusIndex(0);
      requestAnimationFrame(() => {
        rowRefs.current[0]?.focus();
      });
    }
  };

  if (!queue || queue.totalCount === 0 || buckets.length === 0) return null;

  const openCount = queue.totalCount;
  const viewAll =
    BUCKET_VIEW_ALL[activeBucket?.key ?? ""] ??
    activeBucket?.items[0]?.actionUrl ??
    "/";
  const showViewAll = (activeBucket?.count ?? 0) > (activeBucket?.items.length ?? 0);

  return (
    <section
      className="spark-card spark-panel"
      aria-label="Today's attention"
      style={{ borderColor: "var(--spark-border)" }}
    >
      <div
        className="spark-panel-head flex flex-wrap items-center justify-between gap-2 pb-2 mb-1 border-b"
        style={{ borderColor: "var(--spark-border)" }}
      >
        <div className="min-w-0">
          <h2
            className="spark-panel-title font-semibold"
            style={{ color: "var(--spark-text)" }}
          >
            Today&apos;s attention
            <span className="spark-panel-count">{openCount}</span>
          </h2>
          <p className="text-xs mt-0.5" style={META}>
            ↑↓ / j k · Enter open · d discard (all admins)
          </p>
        </div>
        {showViewAll && activeBucket ? (
          <Link
            to={viewAll}
            className="text-xs font-medium shrink-0"
            style={{ color: "var(--spark-link, #1a4d3a)" }}
          >
            View all {activeBucket.count} →
          </Link>
        ) : null}
      </div>

      {banner ? (
        <p className="text-xs px-1 py-1.5" style={META} role="status">
          {banner}
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label="Attention categories"
        className="flex flex-wrap gap-1 pt-2 pb-2"
        onKeyDown={onTabListKeyDown}
      >
        {buckets.map((bucket) => {
          const selected = bucket.key === activeBucket?.key;
          return (
            <button
              key={bucket.key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${bucket.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${bucket.key}`}
              className="text-xs font-medium px-2 py-1 rounded"
              style={{
                background: selected
                  ? "var(--spark-surface-2, var(--spark-surface))"
                  : "transparent",
                color: selected ? "var(--spark-text)" : "var(--spark-text-meta)",
                border: selected
                  ? "1px solid var(--spark-border)"
                  : "1px solid transparent",
              }}
              onClick={() => selectBucket(bucket.key)}
            >
              {bucket.label}
              <span className="ml-1 tabular-nums opacity-80">{bucket.count}</span>
            </button>
          );
        })}
      </div>

      {activeBucket ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeBucket.key}`}
          aria-labelledby={`${baseId}-tab-${activeBucket.key}`}
          tabIndex={-1}
          onKeyDown={onQueueKeyDown}
        >
          <div className="flex items-center justify-end gap-2 pb-1">
            <button
              type="button"
              className="text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
              style={{ color: "var(--spark-text-meta)" }}
              disabled={discarding || visibleItems.length === 0}
              onClick={() => discardItems(visibleItems)}
              title="Discard every visible notice in this tab for all admins"
            >
              Discard visible
            </button>
          </div>
          <ul
            className="rounded border divide-y overflow-hidden"
            style={{
              borderColor: "var(--spark-border)",
              background: "var(--spark-surface)",
            }}
          >
            {visibleItems.map((row, index) => {
              const sev = (row.severity || "low").toUpperCase();
              return (
                <li
                  key={itemKey(row)}
                  data-attention-row
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={index === focusIndex ? 0 : -1}
                  className="flex items-center gap-2 px-2 py-1 outline-none focus-visible:ring-1 focus-visible:ring-[var(--spark-lime)]"
                  style={{ color: "var(--spark-text)" }}
                  onFocus={() => setFocusIndex(index)}
                >
                  <span
                    className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded font-semibold shrink-0"
                    style={sevTone(row.severity)}
                    title={sev}
                  >
                    {sev.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--spark-text)" }}
                    >
                      {primaryLine(row)}
                      {(row.subtitle || "").trim() ? (
                        <span className="font-normal" style={META}>
                          {" "}
                          · {(row.subtitle || "").trim()}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Link
                    to={row.actionUrl || "/"}
                    className="text-xs font-semibold shrink-0 underline-offset-2 hover:underline"
                    style={{ color: "var(--spark-link, var(--spark-text))" }}
                    tabIndex={-1}
                  >
                    {row.actionLabel}
                  </Link>
                  <button
                    type="button"
                    className="text-xs shrink-0 px-1.5 py-0.5 rounded disabled:opacity-50"
                    style={{
                      color: "var(--spark-text-meta)",
                      border: "1px solid var(--spark-border)",
                      background: "transparent",
                    }}
                    disabled={discarding}
                    tabIndex={-1}
                    title="Discard for all admins"
                    onClick={() => discardItems([row])}
                  >
                    Discard
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

export const TodayAttentionStrip: React.FC = () => {
  const { isClient } = useSparkRole();
  if (isClient) return null;
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <StripBody />
      </Suspense>
    </ErrorBoundary>
  );
};

export default TodayAttentionStrip;
