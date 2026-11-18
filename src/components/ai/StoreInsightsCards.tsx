import { Suspense } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantStoreInsightsQuery } from "@/api/queries/TenantStoreInsightsQuery";
import type { TenantStoreInsightsQuery as QueryType } from "@api/queries/__generated__/TenantStoreInsightsQuery.graphql";
import ErrorBoundary from "@/components/ErrorBoundary";
import { groupRecommendations, visibleInsights } from "@/lib/storeInsights";

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;

type Insights = NonNullable<QueryType["response"]["tenantStoreInsights"]>;
type Item = Insights["recommendations"][number];

const DraftNote: React.FC = () => (
  <p className="text-xs mt-4" style={META}>
    Includes drafts. The brand sees a finding only once it is published.{" "}
    <Link to="/weekly-summaries?view=insights" className="underline underline-offset-2">
      Review them
    </Link>
  </p>
);

const ItemRow: React.FC<{ item: Item; first: boolean }> = ({ item, first }) => (
  <li
    className="py-3 first:pt-0 last:pb-0"
    style={first ? undefined : { borderTop: "1px solid var(--spark-border)" }}
  >
    <p className="text-sm leading-relaxed" style={TEXT}>
      {item.text}
    </p>
    {item.isDraft ? (
      <p className="text-xs mt-1" style={META}>
        Draft
      </p>
    ) : null}
  </li>
);

const Group: React.FC<{ title: string; items: readonly Item[] }> = ({ title, items }) =>
  items.length ? (
    <div>
      <h3 className="text-xs font-semibold mb-2" style={META}>
        {title}
      </h3>
      <ul className="m-0 p-0 list-none">
        {items.map((item, i) => (
          <ItemRow key={item.id} item={item} first={i === 0} />
        ))}
      </ul>
    </div>
  ) : null;

/** "Where to go next": stores to go back to, and what to fix. */
export const WhereToGoNextCard: React.FC<{ items: readonly Item[] }> = ({ items }) => {
  if (!items.length) return null;
  const { goBack, fix } = groupRecommendations(items);
  return (
    <section className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-x-4 gap-y-1">
        <h2 className="display text-lg lg:text-xl font-bold" style={{ letterSpacing: "-0.02em" }}>
          Where to go next
        </h2>
        <p className="text-xs" style={META}>
          Last 90 days
        </p>
      </div>
      <div className="flex flex-col gap-5 max-w-3xl">
        <Group title="Go back" items={goBack} />
        <Group title="Fix" items={fix} />
      </div>
      {items.some((i) => i.isDraft) ? (
        <DraftNote />
      ) : (
        <p className="text-xs mt-4" style={META}>
          Worked out from approved recaps. Visits with no product are left out of conversion.
          Reviewed by the Ignite team.
        </p>
      )}
    </section>
  );
};

/** Short factual notices about the last finished week. */
export const AlertsCard: React.FC<{ items: readonly Item[] }> = ({ items }) => {
  if (!items.length) return null;
  return (
    <section className="spark-card p-6 lg:p-8" style={{ borderRadius: 22 }}>
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-x-4 gap-y-1">
        <h2 className="display text-lg lg:text-xl font-bold" style={{ letterSpacing: "-0.02em" }}>
          Alerts
        </h2>
        <p className="text-xs" style={META}>
          From approved recaps
        </p>
      </div>
      <ul className="m-0 p-0 list-none max-w-3xl">
        {items.map((item, i) => (
          <ItemRow key={item.id} item={item} first={i === 0} />
        ))}
      </ul>
      {items.some((i) => i.isDraft) ? (
        <DraftNote />
      ) : (
        <p className="text-xs mt-4" style={META}>
          Reviewed by the Ignite team.
        </p>
      )}
    </section>
  );
};

const Body: React.FC<{ tenantId: string; forClient: boolean }> = ({ tenantId, forClient }) => {
  const data = useLazyLoadQuery<QueryType>(
    TenantStoreInsightsQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const insights = data.tenantStoreInsights;
  if (!insights) return null;
  // Never a draft in the brand's view, whatever the server sent.
  const recommendations = visibleInsights(insights.recommendations, forClient);
  const alerts = visibleInsights(insights.alerts, forClient);
  if (!recommendations.length && !alerts.length) return null;
  return (
    <div className="flex flex-col gap-4">
      <AlertsCard items={alerts} />
      <WhereToGoNextCard items={recommendations} />
    </div>
  );
};

/**
 * The brand dashboard's "Alerts" and "Where to go next" cards. The query
 * stays off the page document, so if it fails the boundary renders nothing
 * and the rest of the dashboard still loads. Nothing here asks the model.
 */
const StoreInsightsCards: React.FC<{ tenantId: string; forClient?: boolean }> = ({
  tenantId,
  forClient = false,
}) => {
  if (!tenantId) return null;
  return (
    <ErrorBoundary key={tenantId} fallback={null}>
      <Suspense fallback={null}>
        <Body tenantId={tenantId} forClient={forClient} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default StoreInsightsCards;
