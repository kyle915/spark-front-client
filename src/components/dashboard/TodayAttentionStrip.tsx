import { Suspense, type CSSProperties } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TodayAttentionQueueQuery } from "@/api/queries/RoiPacingQueries";
import type { RoiPacingQueriesTodayAttentionQueueQuery as QueueQueryType } from "@/api/queries/__generated__/RoiPacingQueriesTodayAttentionQueueQuery.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";
import { attentionBucketsForViewer } from "@/pilot/roiPacingHelpers";

/**
 * Compact action queue above the existing Starts-today / Needs-attention
 * panels. One composite GraphQL query; each row deep-links to resolve.
 *
 * Staff see all buckets (including Missing recaps). Brand/client viewers
 * keep Receipt checks / Unstaffed / Rebooks — Missing recaps stay ops-only.
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

const StripBody: React.FC<{ staff: boolean }> = ({ staff }) => {
  const data = useLazyLoadQuery<QueueQueryType>(
    TodayAttentionQueueQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );
  // E2e GraphQL mocks (and pre-API-deploy clients) may omit this field;
  // never throw — strip is optional chrome above Today / Overview.
  const queue = data?.todayAttentionQueue ?? null;
  if (!queue) return null;

  const { buckets, totalCount } = attentionBucketsForViewer(
    (queue.buckets ?? []).filter(
      (b): b is NonNullable<typeof b> => Boolean(b),
    ),
    { staff },
  );
  if (totalCount === 0) return null;

  const rows = buckets.flatMap((b) =>
    (b.items ?? [])
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
        ...item,
        bucketLabel: b.label ?? item.bucket,
      })),
  );
  if (rows.length === 0) return null;

  return (
    <section
      className="spark-card spark-panel"
      aria-label="Today's attention"
      style={{ borderColor: "var(--spark-border)" }}
    >
      <div className="spark-panel-head">
        <h2 className="spark-panel-title">
          Today&apos;s attention
          <span className="spark-panel-count">{totalCount}</span>
        </h2>
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--spark-border)" }}>
        {rows.map((row) => (
          <li
            key={`${row.bucket}-${row.refId}`}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={sevTone(row.severity)}
                >
                  {row.bucketLabel}
                </span>
                <p className="font-medium truncate" style={{ color: "var(--spark-text)" }}>
                  {row.title}
                </p>
              </div>
              {row.subtitle ? (
                <p className="text-sm mt-0.5 truncate" style={META}>
                  {row.subtitle}
                </p>
              ) : null}
            </div>
            <Link
              to={row.actionUrl}
              className="text-sm font-medium shrink-0 underline-offset-2 hover:underline"
              style={{ color: "var(--spark-link, var(--spark-text))" }}
            >
              {row.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const TodayAttentionStrip: React.FC<{ staff?: boolean }> = ({
  staff = false,
}) => (
  <ErrorBoundary fallback={null}>
    <Suspense fallback={null}>
      <StripBody staff={staff} />
    </Suspense>
  </ErrorBoundary>
);

export default TodayAttentionStrip;
