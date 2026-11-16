import { Suspense, type ReactNode } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { RecapStoreKeyQuery } from "@/api/queries/RecapStoreKeyQuery";
import type { RecapStoreKeyQuery as RecapStoreKeyQueryType } from "@api/queries/__generated__/RecapStoreKeyQuery.graphql";
import { StoreLinksQuery } from "@/api/queries/StoreLinksQuery";
import type { StoreLinksQuery as StoreLinksQueryType } from "@api/queries/__generated__/StoreLinksQuery.graphql";
import { linksForLabels, storeHref } from "@/lib/storeProfile";

const RecapStoreInner: React.FC<{ tenantId: string; recapId: string; children: ReactNode }> = ({
  tenantId,
  recapId,
  children,
}) => {
  const data = useLazyLoadQuery<RecapStoreKeyQueryType>(
    RecapStoreKeyQuery,
    { tenantId, recapId },
    { fetchPolicy: "store-or-network" },
  );
  const href = storeHref(data.recapStoreKey);
  if (!href) return <>{children}</>;
  return (
    <Link to={href} className="underline underline-offset-2" style={{ color: "inherit" }}>
      {children}
    </Link>
  );
};

/**
 * A recap's store name, linked to the store's page when Spark can tell
 * which store it is. Its own query: while it loads, when it fails, or when
 * the store cannot be told, the name is plain text.
 */
export const RecapStoreLink: React.FC<{
  tenantId: string | null | undefined;
  recapId: string | null | undefined;
  children: ReactNode;
}> = ({ tenantId, recapId, children }) => {
  if (!tenantId || !recapId || tenantId === "0") return <>{children}</>;
  return (
    <ErrorBoundary key={`${tenantId}|${recapId}`} fallback={<>{children}</>}>
      <Suspense fallback={<>{children}</>}>
        <RecapStoreInner tenantId={tenantId} recapId={recapId}>
          {children}
        </RecapStoreInner>
      </Suspense>
    </ErrorBoundary>
  );
};

const ChartLinksInner: React.FC<{ tenantId: string; labels: ReadonlyArray<string> }> = ({
  tenantId,
  labels,
}) => {
  const data = useLazyLoadQuery<StoreLinksQueryType>(
    StoreLinksQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const links = linksForLabels(labels, data.tenantStoreLinks ?? []);
  if (links.length === 0) return null;
  return (
    <p className="text-xs flex flex-wrap gap-x-3 gap-y-1" style={{ color: "var(--spark-text-meta)" }}>
      <span>Store pages:</span>
      {links.map((l) => (
        <Link
          key={l.href}
          to={l.href}
          className="underline"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {l.name}
        </Link>
      ))}
    </p>
  );
};

/**
 * Under the "by store" chart: a link to the store page for each bar that
 * is one physical store. Nothing while it loads, if it fails, or when no
 * bar is a single store.
 */
export const StoreChartLinks: React.FC<{ tenantId: string; labels: ReadonlyArray<string> }> = ({
  tenantId,
  labels,
}) => {
  if (!tenantId || labels.length === 0) return null;
  return (
    <ErrorBoundary key={tenantId} fallback={null}>
      <Suspense fallback={null}>
        <ChartLinksInner tenantId={tenantId} labels={labels} />
      </Suspense>
    </ErrorBoundary>
  );
};
