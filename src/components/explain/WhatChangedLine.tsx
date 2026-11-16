import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TenantWhatChangedQuery } from "@/api/queries/TenantWhatChangedQuery";
import type { TenantWhatChangedQuery as TenantWhatChangedQueryType } from "@api/queries/__generated__/TenantWhatChangedQuery.graphql";

type Window = { tenantId: string; startDate: string; endDate: string };

const Inner: React.FC<Window & { className?: string }> = ({
  tenantId,
  startDate,
  endDate,
  className,
}) => {
  const data = useLazyLoadQuery<TenantWhatChangedQueryType>(
    TenantWhatChangedQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const text = data.tenantWhatChanged?.text?.trim();
  // Too few approved recaps to compare: say nothing.
  if (!text) return null;
  return (
    <p
      className={`text-sm leading-relaxed max-w-3xl ${className ?? ""}`}
      style={{ color: "var(--spark-text)" }}
    >
      {text}
    </p>
  );
};

/**
 * One or two plain sentences under the KPIs: what moved against the window
 * before, and what accounts for it. Renders nothing while loading, when it
 * fails, or when there is too little data, so it can never take the
 * numbers above it down.
 */
const WhatChangedLine: React.FC<Window & { className?: string }> = (props) => (
  <ErrorBoundary
    key={`${props.tenantId}|${props.startDate}|${props.endDate}`}
    fallback={null}
  >
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  </ErrorBoundary>
);

export default WhatChangedLine;
