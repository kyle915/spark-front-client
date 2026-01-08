import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import type { Column } from "@/types/columnsTypes";

interface RelayPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

interface RelayEdge<T> {
  cursor: string;
  node: T;
}

type MaybeRelayPageInfo = {
  hasNextPage?: boolean | null;
  hasPreviousPage?: boolean | null;
  startCursor?: string | null;
  endCursor?: string | null;
};

type RelayConnectionData<T> = {
  totalCount?: number | null;
  pageInfo?: MaybeRelayPageInfo | null | undefined;
  edges?:
    | ReadonlyArray<{
        cursor?: string | null;
        node?: T | null;
      } | null>
    | Array<{
        cursor?: string | null;
        node?: T | null;
      } | null>
    | null;
};

type CustomActionsConfig<T> = {
  headerLabel?: string;
  render: (row: T) => ReactNode;
};

type DataTableRelayProps<T> = {
  columns: Column<T>[];

  connection?: RelayConnectionData<T> | null;
  edges?: RelayEdge<T>[];
  totalCount?: number;
  pageInfo?: RelayPageInfo;

  currentPage: number;
  totalPages?: number;
  pageSize?: number;

  onNext: (afterCursor: string) => void;
  onPrevious: (beforeCursor: string) => void;
  onGoToPage?: (page: number) => void;
  onPageLoaded?: (payload: {
    pageNumber: number;
    pageInfo: { startCursor: string | null; endCursor: string | null };
    totalCount: number;
  }) => void;

  isNavigating?: boolean;
  emptyState?: ReactNode;
  customActions?: CustomActionsConfig<T>;
};

const MAX_SIMPLE_PAGES = 5;

const buildPaginationItems = (currentPage: number, totalPages: number) => {
  const safeTotal = Math.max(totalPages, 1);
  const safeCurrent = Math.min(Math.max(currentPage, 1), safeTotal);
  const items: Array<
    { type: "page"; value: number } | { type: "ellipsis"; key: string }
  > = [];

  const pushPage = (value: number) => {
    if (
      value < 1 ||
      value > safeTotal ||
      items.some((item) => item.type === "page" && item.value === value)
    ) {
      return;
    }
    items.push({ type: "page", value });
  };

  const pushEllipsis = (key: string) => {
    if (items[items.length - 1]?.type === "ellipsis") return;
    items.push({ type: "ellipsis", key });
  };

  if (safeTotal <= MAX_SIMPLE_PAGES) {
    for (let i = 1; i <= safeTotal; i += 1) {
      pushPage(i);
    }
    return items;
  }

  pushPage(1);

  if (safeCurrent <= 3) {
    for (let i = 2; i <= 4 && i < safeTotal; i += 1) {
      pushPage(i);
    }
    pushEllipsis("right");
  } else if (safeCurrent >= safeTotal - 2) {
    pushEllipsis("left");
    for (let i = safeTotal - 3; i < safeTotal; i += 1) {
      pushPage(i);
    }
  } else {
    pushEllipsis("left");
    for (let i = safeCurrent - 1; i <= safeCurrent + 1; i += 1) {
      pushPage(i);
    }
    pushEllipsis("right");
  }

  pushPage(safeTotal);

  return items;
};

const normalizePageInfo = (
  info?: MaybeRelayPageInfo | null
): RelayPageInfo => ({
  hasNextPage: info?.hasNextPage ?? false,
  hasPreviousPage: info?.hasPreviousPage ?? false,
  startCursor: info?.startCursor ?? null,
  endCursor: info?.endCursor ?? null,
});

export default function DataTableRelay<T>({
  columns,
  connection,
  edges,
  totalCount,
  pageInfo,
  currentPage,
  totalPages,
  pageSize = 10,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating = false,
  emptyState,
  customActions,
}: DataTableRelayProps<T>) {
  const connectionMeta = useMemo(() => {
    if (!connection) {
      return null;
    }

    const rawEdges = connection.edges ? Array.from(connection.edges) : [];
    const resolvedEdges: RelayEdge<T>[] = [];

    rawEdges.forEach((edge, index) => {
      if (!edge || !edge.node) {
        return;
      }
      resolvedEdges.push({
        cursor: edge.cursor ?? `edge-${index}`,
        node: edge.node as T,
      });
    });

    return {
      edges: resolvedEdges,
      totalCount: connection.totalCount ?? 0,
      pageInfo: normalizePageInfo(connection.pageInfo),
    };
  }, [connection]);

  const resolvedEdges: RelayEdge<T>[] = edges ?? connectionMeta?.edges ?? [];
  const resolvedTotalCount = totalCount ?? connectionMeta?.totalCount ?? 0;
  const resolvedPageInfo = useMemo(
    () => normalizePageInfo(pageInfo ?? connectionMeta?.pageInfo ?? null),
    [connectionMeta?.pageInfo, pageInfo]
  );

  const totalPagesSafe = useMemo(() => {
    if (typeof totalPages === "number") {
      return Math.max(totalPages, 1);
    }
    const derived = Math.ceil(
      pageSize > 0 ? resolvedTotalCount / pageSize : resolvedTotalCount
    );
    return Math.max(derived || 1, 1);
  }, [pageSize, resolvedTotalCount, totalPages]);

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPagesSafe);
  const canGoDirect = Boolean(onGoToPage);
  const paginationItems = useMemo(
    () => buildPaginationItems(safeCurrentPage, totalPagesSafe),
    [safeCurrentPage, totalPagesSafe]
  );

  useEffect(() => {
    if (!onPageLoaded) return;
    onPageLoaded({
      pageNumber: safeCurrentPage,
      pageInfo: {
        startCursor: resolvedPageInfo.startCursor,
        endCursor: resolvedPageInfo.endCursor,
      },
      totalCount: resolvedTotalCount,
    });
  }, [
    onPageLoaded,
    resolvedPageInfo.endCursor,
    resolvedPageInfo.startCursor,
    resolvedTotalCount,
    safeCurrentPage,
  ]);

  if (!resolvedEdges.length && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-x-auto rounded-xl shadow-lg bg-base-100 p-4 space-y-4">
      <div className="flex justify-end">
        <span className="text-sm text-base-content font-medium">
          Total: {resolvedTotalCount}
        </span>
      </div>

      <table className="table table-zebra w-full">
        <thead className="text-base-content text-sm">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)}>{col.label}</th>
            ))}
            {customActions ? (
              <th>{customActions.headerLabel ?? "Actions"}</th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {resolvedEdges.map(({ node }, index) => {
            const rowKey =
              (node as { id?: string | number } | undefined)?.id ?? index;
            const safeNode = node;
            return (
              <tr key={rowKey} className="hover:bg-base-200">
                {columns.map((col) => {
                  const key = col.key;
                  const value =
                    typeof key === "string"
                      ? ((safeNode as Record<string, unknown>)[key] as
                          | T[keyof T]
                          | undefined)
                      : safeNode[key];
                  return (
                    <td key={String(col.key)}>
                      {col.render
                        ? col.render(value, safeNode)
                        : (value as unknown as ReactNode)}
                    </td>
                  );
                })}
                {customActions ? (
                  <td>{customActions.render(safeNode)}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <button
          onClick={() =>
            resolvedPageInfo.startCursor &&
            onPrevious(resolvedPageInfo.startCursor)
          }
          disabled={!resolvedPageInfo.hasPreviousPage || isNavigating}
          className="btn btn-sm btn-ghost border border-base-300"
        >
          ‹
        </button>

        {paginationItems.map((item) =>
          item.type === "ellipsis" ? (
            <span key={item.key} className="px-2 text-base-content">
              …
            </span>
          ) : (
            <button
              key={item.value}
              className={`btn btn-sm ${
                item.value === safeCurrentPage
                  ? "btn-primary"
                  : "btn-ghost border border-base-300"
              }`}
              disabled={
                item.value === safeCurrentPage || isNavigating || !canGoDirect
              }
              onClick={() => onGoToPage?.(item.value)}
            >
              {item.value}
            </button>
          )
        )}

        <button
          onClick={() =>
            resolvedPageInfo.endCursor && onNext(resolvedPageInfo.endCursor)
          }
          disabled={!resolvedPageInfo.hasNextPage || isNavigating}
          className="btn btn-sm btn-ghost border border-base-300"
        >
          ›
        </button>
      </div>
    </div>
  );
}
