import { Suspense } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TenantCalloutsQuery } from "@/api/queries/TenantCalloutsQuery";
import type { TenantCalloutsQuery as TenantCalloutsQueryType } from "@api/queries/__generated__/TenantCalloutsQuery.graphql";
import { calloutLinkLabel, calloutRecapsHref } from "@/lib/dashboardExplain";

type Window = { tenantId: string; startDate: string; endDate: string };

const META = { color: "var(--spark-text-meta)" } as const;

const Inner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const data = useLazyLoadQuery<TenantCalloutsQueryType>(
    TenantCalloutsQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const callouts = data.tenantCallouts ?? [];
  if (callouts.length === 0) return null;
  return (
    <section aria-label="Worth a look">
      <h3 className="text-[13px] font-medium mb-2" style={{ color: "var(--spark-text-secondary)" }}>
        Worth a look
      </h3>
      <ul className="m-0 p-0 list-none">
        {callouts.map((c, i) => (
          <li
            key={c.key}
            className="py-3"
            style={i > 0 ? { borderTop: "1px solid var(--spark-border)" } : undefined}
          >
            <p className="text-sm leading-relaxed max-w-3xl" style={{ color: "var(--spark-text)" }}>
              {c.text}
            </p>
            <p className="text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1 tab-num" style={META}>
              {c.numbers.map((n) => (
                <span key={n.label}>
                  {n.label}: {n.value}
                </span>
              ))}
            </p>
            <Link
              to={calloutRecapsHref(c.link, c.kind)}
              className="text-xs underline mt-1 inline-block"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              {calloutLinkLabel(c.link, c.kind)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * The few things in the program that stand out, each with its numbers and
 * a link to the recaps behind it. Nothing renders when the rules raise
 * nothing, while it loads, or if it fails.
 */
const Callouts: React.FC<Window & { className?: string }> = ({ className, ...window }) => (
  <ErrorBoundary key={`${window.tenantId}|${window.startDate}|${window.endDate}`} fallback={null}>
    <Suspense fallback={null}>
      <div className={className}>
        <Inner {...window} />
      </div>
    </Suspense>
  </ErrorBoundary>
);

export default Callouts;
