import { Component, Suspense, type ReactNode } from "react";
import { graphql } from "react-relay";
import { useLazyLoadQuery } from "react-relay/hooks";
import type { CheckinIssuesCardQuery as QueryType } from "./__generated__/CheckinIssuesCardQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { issueWhen } from "./checkinIssues";

const Query = graphql`
  query CheckinIssuesCardQuery($tenantId: ID!, $days: Int!) {
    checkinFieldIssues(tenantId: $tenantId, days: $days) {
      kind
      label
      count
      events
      lastAt
      lastDetail
    }
  }
`;

const DAYS = 7;
const meta = { color: "var(--spark-text-meta)" } as const;

const Body: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const data = useLazyLoadQuery<QueryType>(
    Query,
    { tenantId, days: DAYS },
    { fetchPolicy: "store-and-network" },
  );
  const issues = data.checkinFieldIssues;
  // Quiet when there is nothing to act on.
  if (issues.length === 0) return null;
  return (
    <section className="spark-card p-4 mb-5" aria-label="Check-in issues">
      <h3 className="font-semibold text-sm">Check-in issues, last {DAYS} days</h3>
      <p className="text-xs mb-3" style={meta}>
        Reported automatically by ambassadors' phones when something on the check-in page
        failed.
      </p>
      <ul className="list-none p-0 m-0">
        {issues.map((i) => (
          <li
            key={i.kind}
            className="flex items-baseline justify-between gap-4 py-2 text-sm"
            style={{ borderTop: "1px solid var(--spark-hairline)" }}
          >
            <span className="min-w-0">
              {i.label}
              <span className="block text-xs" style={meta}>
                {[
                  i.events > 0 ? `${i.events} event${i.events === 1 ? "" : "s"}` : "",
                  issueWhen(i.lastAt),
                  i.lastDetail,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="font-semibold tabular-nums shrink-0">{i.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** An ops signal must never take the Walk-ups page down with it. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Staff-only: what ambassadors' phones reported going wrong on the web
 * check-in for this client (needs checkinFieldIssues — spark-api #1363).
 */
const CheckinIssuesCard: React.FC = () => {
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();
  if (!isAdmin || !tenantId) return null;
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Body tenantId={String(tenantId)} />
      </Suspense>
    </Quiet>
  );
};

export default CheckinIssuesCard;
