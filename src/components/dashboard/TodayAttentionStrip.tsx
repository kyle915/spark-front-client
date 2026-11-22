import { Suspense, type CSSProperties } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TodayAttentionQueueQuery } from "@/api/queries/RoiPacingQueries";
import type { RoiPacingQueriesTodayAttentionQueueQuery as QueueQueryType } from "@/api/queries/__generated__/RoiPacingQueriesTodayAttentionQueueQuery.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";
import useSparkRole from "@/hooks/useSparkRole";

/**
 * Compact action queue above the existing Starts-today / Needs-attention
 * panels. One composite GraphQL query; each row deep-links to resolve.
 *
 * Ignite Admin chrome only — hidden for brand clients and when staff
 * preview Client view (receipt checks / missing recaps / unstaffed).
 */

const META = { color: "var(--spark-text-meta)" } as const;

const BUCKET_VIEW_ALL: Record<string, string> = {
  receipt_checks: "/finance-queue",
  missing_recaps: "/recaps/missing",
  unstaffed: "/schedule",
  rebooks: "/buyer-report",
};

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

const StripBody: React.FC = () => {
  const data = useLazyLoadQuery<QueueQueryType>(
    TodayAttentionQueueQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );
  // E2e GraphQL mocks (and pre-API-deploy clients) may omit this field;
  // never throw — strip is optional chrome above Today / Overview.
  const queue = data?.todayAttentionQueue ?? null;
  if (!queue || queue.totalCount === 0) return null;

  const buckets = (queue.buckets ?? []).filter(
    (b) => b && (b.items?.length ?? 0) > 0,
  );
  if (buckets.length === 0) return null;

  const openCount = queue.totalCount;

  return (
    <section
      className="spark-card spark-panel"
      aria-label="Today's attention"
      style={{ borderColor: "var(--spark-border)" }}
    >
      <div className="spark-panel-head border-b pb-3 mb-1" style={{ borderColor: "var(--spark-border)" }}>
        <h2 className="spark-panel-title font-semibold" style={{ color: "var(--spark-text)" }}>
          Today&apos;s attention
          <span className="spark-panel-count">{openCount}</span>
        </h2>
        <p className="text-sm mt-1" style={META}>
          Top items to clear · {openCount} open
        </p>
      </div>

      <div className="flex flex-col gap-6 pt-2">
        {buckets.map((bucket) => {
          if (!bucket) return null;
          const items = bucket.items ?? [];
          const viewAll = BUCKET_VIEW_ALL[bucket.key ?? ""] ?? items[0]?.actionUrl ?? "/";
          const showViewAll = (bucket.count ?? 0) > items.length;

          return (
            <div key={bucket.key} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold" style={{ color: "var(--spark-text)" }}>
                  {bucket.label}
                  <span
                    className="ml-2 text-xs font-medium tabular-nums px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--spark-surface-2, var(--spark-surface))",
                      color: "var(--spark-text-meta)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    {bucket.count}
                  </span>
                </h3>
                {showViewAll ? (
                  <Link
                    to={viewAll}
                    className="text-xs font-medium shrink-0"
                    style={{ color: "var(--spark-link, #1a4d3a)" }}
                  >
                    View all {bucket.count} →
                  </Link>
                ) : null}
              </div>

              <ul
                className="rounded-lg border divide-y overflow-hidden"
                style={{
                  borderColor: "var(--spark-border)",
                  background: "var(--spark-surface)",
                }}
              >
                {items.map((row) => {
                  if (!row) return null;
                  return (
                    <li
                      key={`${row.bucket}-${row.refId}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium"
                            style={sevTone(row.severity ?? "low")}
                          >
                            {(row.severity ?? "low").toUpperCase()}
                          </span>
                          <p
                            className="font-medium text-sm truncate"
                            style={{ color: "var(--spark-text)" }}
                          >
                            {row.title}
                          </p>
                        </div>
                        {row.subtitle ? (
                          <p className="text-sm mt-0.5 truncate pl-0 sm:pl-0" style={META}>
                            {row.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <Link
                        to={row.actionUrl ?? "/"}
                        className="spark-btn-ghost text-xs font-semibold !px-3 !py-1.5 shrink-0 self-start sm:self-center"
                        style={{ color: "var(--spark-text)" }}
                      >
                        {row.actionLabel}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
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