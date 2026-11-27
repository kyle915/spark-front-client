import { Suspense } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantWeeklySummaryQuery } from "@/api/queries/TenantWeeklySummaryQuery";
import type { TenantWeeklySummaryQuery as TenantWeeklySummaryQueryType } from "@api/queries/__generated__/TenantWeeklySummaryQuery.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";
import { summaryIsStale, summaryParagraphs, weekLabel } from "@/lib/weeklySummary";
import { cn } from "@/lib/utils";

const META = { color: "var(--spark-text-meta)" } as const;

/**
 * The brand's weekly summary on a dashboard: what ran last week, the
 * numbers, and what consumers said, as staff reviewed it.
 *
 * A brand user sees the latest reviewed summary, and only while it is
 * recent; otherwise nothing at all. Ignite staff also see a draft that has
 * not been reviewed, labelled as one, with a link to review it. The server
 * decides which of the two a person gets. Nothing here asks the model.
 *
 * The query stays off the page document, so if it fails the boundary
 * renders nothing and the rest of the dashboard still loads.
 */
const Body: React.FC<{
  tenantId: string;
  forClient: boolean;
  className?: string;
}> = ({ tenantId, forClient, className }) => {
  const data = useLazyLoadQuery<TenantWeeklySummaryQueryType>(
    TenantWeeklySummaryQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const summary = data.tenantWeeklySummary;
  if (!summary) return null;
  // Never a draft in the brand's view, whatever the server sent, and not a
  // summary of a week that ended over a fortnight ago.
  if (forClient && (summary.isDraft || summaryIsStale(summary.weekEnd, new Date()))) {
    return null;
  }

  return (
    <section
      className={cn("spark-card p-6 lg:p-8", className)}
    >
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-x-4 gap-y-1">
        <h2 className="display text-lg lg:text-xl font-bold" style={{ letterSpacing: "-0.02em" }}>
          Weekly summary
        </h2>
        <p className="text-xs" style={META}>
          {weekLabel(summary.weekStart, summary.weekEnd)}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {summaryParagraphs(summary.text).map((paragraph, i) => (
          <p key={i} className="text-sm leading-relaxed" style={{ color: "var(--spark-text)" }}>
            {paragraph}
          </p>
        ))}
      </div>
      <p className="text-xs mt-4" style={META}>
        {summary.isDraft ? (
          <>
            Draft. The brand does not see this until it is marked reviewed.{" "}
            <Link to="/weekly-summaries" className="underline underline-offset-2">
              Review it
            </Link>
          </>
        ) : (
          "Compiled from approved recaps · Reviewed by Ignite"
        )}
      </p>
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
        <Body tenantId={tenantId} forClient={forClient} className={className} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default WeeklySummaryCard;
