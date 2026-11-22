import { Suspense, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { RecapStoreKeyQuery } from "@/api/queries/RecapStoreKeyQuery";
import type { RecapStoreKeyQuery as RecapStoreKeyQueryType } from "@api/queries/__generated__/RecapStoreKeyQuery.graphql";
import { StoreLinksQuery } from "@/api/queries/StoreLinksQuery";
import type { StoreLinksQuery as StoreLinksQueryType } from "@api/queries/__generated__/StoreLinksQuery.graphql";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import { linksForLabels, storeHref } from "@/lib/storeProfile";

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  );
}

const RecapStoreInner: React.FC<{ tenantId: string; recapId: string; children: ReactNode }> = ({
  tenantId,
  recapId,
  children,
}) => {
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);
  const data = useLazyLoadQuery<RecapStoreKeyQueryType>(
    RecapStoreKeyQuery,
    { tenantId, recapId },
    { fetchPolicy: "store-or-network" },
  );
  const storeKey = data.recapStoreKey;
  const href = storeHref(storeKey);
  if (!href || !storeKey) return <>{children}</>;
  return (
    <Link
      to={href}
      onClick={(e) => {
        if (!isPlainLeftClick(e)) return;
        e.preventDefault();
        e.stopPropagation();
        openStoreSheet({
          storeKey,
          fallbackTitle: typeof children === "string" ? children : undefined,
        });
      }}
      className="underline underline-offset-2"
      style={{ color: "inherit" }}
    >
      {children}
    </Link>
  );
};

/**
 * A recap's store name, linked to the store's slide-over drawer (or full page
 * on Cmd/Ctrl-click) when Spark can tell which store it is.
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
  const openStoreSheet = useStoreSheetStore((s) => s.openStoreSheet);
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
      {links.map((l) => {
        const keyFromHref = l.href.startsWith("/store/") ? l.href.slice("/store/".length) : null;
        return (
          <Link
            key={l.href}
            to={l.href}
            onClick={(e) => {
              if (!keyFromHref || !isPlainLeftClick(e)) return;
              e.preventDefault();
              e.stopPropagation();
              openStoreSheet({ storeKey: keyFromHref, storeName: l.name, fallbackTitle: l.name });
            }}
            className="underline"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            {l.name}
          </Link>
        );
      })}
    </p>
  );
};

/**
 * Under the "by store" chart: a trigger opening the StoreSheet drawer (with
 * Cmd/Ctrl-click full-page support) for each bar that is one physical store.
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
