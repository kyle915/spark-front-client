import { Suspense } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantWeeklyNarrationQuery } from "@/api/queries/TenantWeeklyNarrationQuery";
import type { TenantWeeklyNarrationQuery as TenantWeeklyNarrationQueryType } from "@api/queries/__generated__/TenantWeeklyNarrationQuery.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";
import { narrationIsStale } from "./narrationIsStale";

const MARKET_SKIP = new Set([
  "THE",
  "THIS",
  "RETAIL",
  "TOTAL",
  "WEEK",
  "ON",
  "FILED",
  "PREMISE",
]);

export function trackerWeekHref(weekStart: string, weekEnd: string): string {
  return `/requests/list?when=custom&from=${encodeURIComponent(weekStart)}&to=${encodeURIComponent(weekEnd)}`;
}

/** One action per narration sentence: review queue, a named market, or the week in Tracker. */
export function narrationSentenceLink(
  sentence: string,
  weekStart: string,
  weekEnd: string,
): { href: string; action: string } {
  const tracker = trackerWeekHref(weekStart, weekEnd);
  if (/\b(needs review|need review|awaiting approval|unapproved)\b/i.test(sentence)) {
    return { href: "/recaps/list?status=needs_review", action: "Needs review" };
  }
  const marketMatch = sentence.match(
    /\b(?:in|across)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\b/,
  );
  const market = marketMatch?.[1] ?? "";
  if (market && !MARKET_SKIP.has(market.toUpperCase())) {
    return {
      href: `${tracker}&market=${encodeURIComponent(market.toUpperCase())}`,
      action: market,
    };
  }
  return { href: tracker, action: "Tracker" };
}

function splitSentences(body: string): string[] {
  return body
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Stored weekly paragraph from the narration job. Shown on the admin
 * dashboard and the client dashboard. The read does not call the model
 * and this card never sends email.
 *
 * The query stays off the page document. If the live API has not
 * shipped `tenantWeeklyNarration` yet, the boundary renders nothing so
 * the rest of the dashboard still loads.
 */
function formatWeek(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return `${start} – ${end}`;
  }
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  const startLabel = startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

const WeeklyNarrationBody: React.FC<{ tenantId: string; forClient?: boolean }> = ({
  tenantId,
  forClient = false,
}) => {
  const data = useLazyLoadQuery<TenantWeeklyNarrationQueryType>(
    TenantWeeklyNarrationQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const narration = data.tenantWeeklyNarration;

  // A brand user gets a summary only when there is a recent one: no "waiting
  // on the weekly job", and not a paragraph about a week over a fortnight old.
  if (forClient && (!narration || narrationIsStale(narration.weekEnd, new Date()))) {
    return null;
  }

  return (
    <div className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2
          className="display text-lg lg:text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          {forClient ? "Last week in summary" : "Weekly narration"}
        </h2>
        <p
          className="text-[12px]"
          style={{ color: "var(--spark-text-meta)" }}
        >
          {narration
            ? `Week of ${formatWeek(narration.weekStart, narration.weekEnd)}`
            : "Waiting on the weekly job"}
        </p>
      </div>
      {narration ? (
        <>
          <ul className="space-y-2">
            {splitSentences(narration.body).map((sentence) => {
              const link = narrationSentenceLink(
                sentence,
                narration.weekStart,
                narration.weekEnd,
              );
              return (
                <li key={sentence} className="text-sm leading-relaxed">
                  <Link to={link.href} style={{ color: "var(--spark-text)" }}>
                    {sentence}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              to={trackerWeekHref(narration.weekStart, narration.weekEnd)}
              className="px-3 py-2 rounded-xl text-sm font-semibold"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            >
              Tracker this week
            </Link>
            {forClient ? null : (
            <Link
              to="/recaps/list?status=needs_review"
              className="px-3 py-2 rounded-xl text-sm font-semibold"
              style={{
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            >
              Needs review
            </Link>
            )}
          </div>
          <p className="text-[12px] mt-4" style={{ color: "var(--spark-text-meta)" }}>
            Based on {narration.filedRecaps}{" "}
            {narration.filedRecaps === 1 ? "recap" : "recaps"} filed that week.
          </p>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          No weekly narration stored yet. It appears after the weekly job runs.
        </p>
      )}
    </div>
  );
};

const WeeklyNarrationCard: React.FC<{ tenantId: string; forClient?: boolean }> = ({
  tenantId,
  forClient = false,
}) => {
  if (!tenantId) return null;
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <WeeklyNarrationBody tenantId={tenantId} forClient={forClient} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default WeeklyNarrationCard;
