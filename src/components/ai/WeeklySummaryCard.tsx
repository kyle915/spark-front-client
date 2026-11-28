import { Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { TenantWeeklySummaryQuery } from "@/api/queries/TenantWeeklySummaryQuery";
import type { TenantWeeklySummaryQuery as TenantWeeklySummaryQueryType } from "@api/queries/__generated__/TenantWeeklySummaryQuery.graphql";
import { executeAuthenticatedGraphQL } from "@/api/relay/environment";
import ErrorBoundary from "@/components/ErrorBoundary";
import { CopyMorphButton } from "@/motion/CopyMorphButton";
import { dispatchOpenAskSpark } from "@/lib/askSparkEvent";
import {
  summaryIsStale,
  summaryParagraphs,
  weekLabel,
} from "@/lib/weeklySummary";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { tenantDisplayName } from "@/utils/tenantDisplayName";
import {
  buildWeeklySummaryAskPrompt,
  formatWeeklySummaryForShare,
  mergeSummaryArchive,
  type WeeklySummaryArchiveItem,
} from "./weeklySummaryShare";

const META = { color: "var(--spark-text-meta)" } as const;

const WEEKLY_SUMMARY_ARCHIVE_QUERY = `
  query TenantWeeklySummaryArchive($tenantId: ID!, $limit: Int) {
    tenantWeeklySummaries(tenantId: $tenantId, limit: $limit) {
      weekStart
      weekEnd
      text
      isDraft
      reviewedAt
    }
  }
`;

/**
 * The brand's weekly summary on a dashboard: what ran, the numbers, and what
 * consumers said, with:
 *   - 1-click CopyMorphButton ("Copy update" formatted for Slack/leadership)
 *   - Compact ‹ / › week archive stepper across reviewed summaries
 *   - Pre-seeded "Ask Spark follow-up" chip for that week's window
 */
const Body: React.FC<{
  tenantId: string;
  forClient: boolean;
  className?: string;
}> = ({ tenantId, forClient, className }) => {
  const { tenantMeta, tenantSlug } = useAuthStore();
  const brandName = tenantDisplayName(tenantMeta?.requestUrlName, tenantSlug);

  const data = useLazyLoadQuery<TenantWeeklySummaryQueryType>(
    TenantWeeklySummaryQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const latest = data.tenantWeeklySummary ?? null;

  const [fetchedArchive, setFetchedArchive] = useState<
    WeeklySummaryArchiveItem[]
  >([]);
  const [weekIndex, setWeekIndex] = useState(0);

  useEffect(() => {
    setWeekIndex(0);
    setFetchedArchive([]);
    let cancelled = false;
    executeAuthenticatedGraphQL<{
      tenantWeeklySummaries?: ReadonlyArray<WeeklySummaryArchiveItem> | null;
    }>(
      WEEKLY_SUMMARY_ARCHIVE_QUERY,
      { tenantId, limit: 12 },
      { operationKind: "query" },
    )
      .then((res) => {
        if (cancelled) return;
        const rows = res.data?.tenantWeeklySummaries;
        if (Array.isArray(rows) && rows.length > 0) {
          setFetchedArchive([...rows]);
        }
      })
      .catch(() => {
        /* graceful fallback to primary latest summary */
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const archive = useMemo(
    () => mergeSummaryArchive(latest, fetchedArchive, forClient),
    [latest, fetchedArchive, forClient],
  );

  if (archive.length === 0) return null;

  const safeIndex = Math.min(weekIndex, archive.length - 1);
  const summary = archive[safeIndex];
  if (!summary) return null;
  if (forClient && summary.isDraft) return null;

  const isArchiveView =
    safeIndex > 0 || summaryIsStale(summary.weekEnd, new Date());
  const canStepOlder = safeIndex < archive.length - 1;
  const canStepNewer = safeIndex > 0;

  const shareText = formatWeeklySummaryForShare({
    brandName,
    weekStart: summary.weekStart,
    weekEnd: summary.weekEnd,
    text: summary.text,
  });
  const askPrompt = buildWeeklySummaryAskPrompt({
    weekStart: summary.weekStart,
    weekEnd: summary.weekEnd,
  });

  return (
    <section className={cn("spark-card p-6 lg:p-8", className)}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2
            className="display text-lg lg:text-xl font-bold m-0"
            style={{ letterSpacing: "-0.02em" }}
          >
            Weekly summary
          </h2>
          {isArchiveView ? (
            <span
              className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
              style={{
                background: "var(--spark-surface-2)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text-secondary)",
              }}
            >
              Archive
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {archive.length > 1 ? (
            <button
              type="button"
              disabled={!canStepOlder}
              onClick={() => setWeekIndex((i) => Math.min(archive.length - 1, i + 1))}
              aria-label="Previous week summary"
              title="Previous reviewed week"
              className="p-1 rounded-md cursor-pointer disabled:opacity-35 transition"
              style={{
                border: "1px solid var(--spark-border)",
                background: "transparent",
                color: "var(--spark-text-secondary)",
              }}
            >
              <ChevronLeft size={13} strokeWidth={1.9} />
            </button>
          ) : null}
          <p className="text-xs tab-num m-0 px-0.5" style={META}>
            {weekLabel(summary.weekStart, summary.weekEnd)}
          </p>
          {archive.length > 1 ? (
            <button
              type="button"
              disabled={!canStepNewer}
              onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
              aria-label="Next week summary"
              title="Newer reviewed week"
              className="p-1 rounded-md cursor-pointer disabled:opacity-35 transition"
              style={{
                border: "1px solid var(--spark-border)",
                background: "transparent",
                color: "var(--spark-text-secondary)",
              }}
            >
              <ChevronRight size={13} strokeWidth={1.9} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {summaryParagraphs(summary.text).map((paragraph, i) => (
          <p
            key={i}
            className="text-sm leading-relaxed m-0"
            style={{ color: "var(--spark-text)" }}
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div
        className="mt-4 pt-3.5 flex items-center justify-between gap-2 flex-wrap"
        style={{
          borderTop: "1px solid var(--spark-hairline, var(--spark-border))",
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <CopyMorphButton
            text={shareText}
            label="Copy update"
            copiedLabel="Copied for Slack"
            title="Copy formatted update for Slack or leadership email"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              border: "1px solid var(--spark-border)",
              background: "var(--spark-surface-2)",
              color: "var(--spark-text)",
            }}
          />
          <button
            type="button"
            onClick={() =>
              dispatchOpenAskSpark({
                tenantId,
                question: askPrompt,
              })
            }
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition hover:opacity-90"
            style={{
              border: "1px solid var(--spark-border)",
              background: "transparent",
              color: "var(--spark-text-secondary)",
            }}
            title="Open Ask Spark pre-seeded with this week's window"
          >
            <Sparkles size={12} strokeWidth={1.9} />
            <span>Ask Spark follow-up</span>
          </button>
        </div>

        <p className="text-xs m-0" style={META}>
          {summary.isDraft ? (
            <>
              Draft · hidden from brand until reviewed.{" "}
              <Link
                to="/weekly-summaries"
                className="underline underline-offset-2"
              >
                Review it
              </Link>
            </>
          ) : (
            "Compiled from approved recaps · Reviewed by Ignite"
          )}
        </p>
      </div>
    </section>
  );
};

const WeeklySummaryCard: React.FC<{
  tenantId: string;
  forClient?: boolean;
  className?: string;
}> = ({ tenantId, forClient = false, className }) => {
  if (!tenantId) return null;
  return (
    <ErrorBoundary key={tenantId} fallback={null}>
      <Suspense fallback={null}>
        <Body
          tenantId={tenantId}
          forClient={forClient}
          className={className}
        />
      </Suspense>
    </ErrorBoundary>
  );
};

export default WeeklySummaryCard;
