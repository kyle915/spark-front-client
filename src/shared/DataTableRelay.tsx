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

  onNext: () => void;
  onPrevious: () => void;
  onNextChunk?: () => void;
  onPreviousChunk?: () => void;
  onGoToPage?: (page: number) => void;

  onPageLoaded?: (payload: {
    pageNumber: number;
    pageInfo: { startCursor: string | null; endCursor: string | null };
    totalCount: number;
  }) => void;

  isNavigating?: boolean;
  isRefreshing?: boolean;
  emptyState?: ReactNode;
  customActions?: CustomActionsConfig<T>;
  onRefresh?: () => void;

  isPageReachable?: (page: number) => boolean;
};

const PAGE_WINDOW = 3;

const buildPaginationItems = (currentPage: number, totalPages: number) => {
  const items: Array<
    { type: "page"; value: number } | { type: "ellipsis"; key: string }
  > = [];

  const safeTotal = Math.max(totalPages, 1);
  const safeCurrent = Math.min(Math.max(currentPage, 1), safeTotal);

  const pushPage = (value: number) => {
    if (
      value < 1 ||
      value > safeTotal ||
      items.some((i) => i.type === "page" && i.value === value)
    ) {
      return;
    }
    items.push({ type: "page", value });
  };

  const pushEllipsis = (key: string) => {
    if (items[items.length - 1]?.type === "ellipsis") return;
    items.push({ type: "ellipsis", key });
  };

  // 🔹 Siempre mostrar primera página
  pushPage(1);

  const start = Math.max(2, safeCurrent - PAGE_WINDOW);
  const end = Math.min(safeTotal - 1, safeCurrent + PAGE_WINDOW);

  // 🔹 Ellipsis izquierda
  if (start > 2) {
    pushEllipsis("left");
  }

  // 🔹 Ventana central
  for (let i = start; i <= end; i += 1) {
    pushPage(i);
  }

  // 🔹 Ellipsis derecha
  if (end < safeTotal - 1) {
    pushEllipsis("right");
  }

  // 🔹 Siempre mostrar última página
  if (safeTotal > 1) {
    pushPage(safeTotal);
  }

  return items;
};

const normalizePageInfo = (
  info?: MaybeRelayPageInfo | null,
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
  onNextChunk,
  onPreviousChunk,
  onGoToPage,

  onPageLoaded,
  isNavigating = false,
  isRefreshing = false,
  emptyState,
  customActions,
  onRefresh,

  isPageReachable,
}: DataTableRelayProps<T>) {
  const connectionMeta = useMemo(() => {
    if (!connection) return null;

    const rawEdges = connection.edges ? Array.from(connection.edges) : [];
    const resolvedEdges: RelayEdge<T>[] = [];

    rawEdges.forEach((edge, index) => {
      if (!edge || !edge.node) return;
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
    [connectionMeta?.pageInfo, pageInfo],
  );

  const totalPagesSafe = useMemo(() => {
    if (typeof totalPages === "number") return Math.max(totalPages, 1);
    const derived = Math.ceil(
      pageSize > 0 ? resolvedTotalCount / pageSize : resolvedTotalCount,
    );
    return Math.max(derived || 1, 1);
  }, [pageSize, resolvedTotalCount, totalPages]);

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPagesSafe);

  const paginationItems = useMemo(
    () => buildPaginationItems(safeCurrentPage, totalPagesSafe),
    [safeCurrentPage, totalPagesSafe],
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

  if (!resolvedEdges.length && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-x-auto rounded-xl shadow-lg bg-base-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-base-content font-medium">
          Total: {resolvedTotalCount}
        </span>

        {onRefresh ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Reload"
            title="Reload"
          >
            <span className={isRefreshing ? "loading loading-spinner" : ""} />
            {!isRefreshing ? "↻" : null}
          </button>
        ) : null}
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

            return (
              <tr key={rowKey} className="hover:bg-base-200">
                {columns.map((col) => {
                  const key = col.key;
                  const value =
                    typeof key === "string"
                      ? ((node as Record<string, unknown>)[key] as
                          | T[keyof T]
                          | undefined)
                      : node[key];

                  return (
                    <td key={String(col.key)}>
                      {col.render
                        ? col.render(value, node)
                        : (value as unknown as ReactNode)}
                    </td>
                  );
                })}

                {customActions ? <td>{customActions.render(node)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {onPreviousChunk ? (
          <button
            type="button"
            onClick={onPreviousChunk}
            disabled={isNavigating || safeCurrentPage <= 1}
            className="btn btn-sm btn-ghost border border-base-300"
            title="Previous chunk"
          >
            «
          </button>
        ) : null}

        <button
          type="button"
          onClick={onPrevious}
          disabled={!resolvedPageInfo.hasPreviousPage || isNavigating}
          className="btn btn-sm btn-ghost border border-base-300"
          title="Previous"
        >
          ‹
        </button>

        {paginationItems.map((item) =>
          item.type === "ellipsis" ? (
            <span key={item.key} className="px-2 text-base-content">
              …
            </span>
          ) : (
            (() => {
              const isCurrent = item.value === safeCurrentPage;
              const reachable = isPageReachable?.(item.value) ?? true;

              return (
                <button
                  key={item.value}
                  type="button"
                  className={`btn btn-sm ${
                    isCurrent
                      ? "btn-primary"
                      : reachable
                        ? "btn-ghost border border-base-300"
                        : "btn-ghost border border-base-300 opacity-40 cursor-not-allowed"
                  }`}
                  disabled={
                    isCurrent || isNavigating || !onGoToPage || !reachable
                  }
                  title={
                    !onGoToPage
                      ? "Go to page is not enabled"
                      : !reachable
                        ? "Usa las flechas (o salto) para llegar a esta página"
                        : "Go to page"
                  }
                  onClick={() => {
                    if (!isCurrent && reachable) onGoToPage?.(item.value);
                  }}
                >
                  {item.value}
                </button>
              );
            })()
          ),
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={!resolvedPageInfo.hasNextPage || isNavigating}
          className="btn btn-sm btn-ghost border border-base-300"
          title="Next"
        >
          ›
        </button>

        {onNextChunk ? (
          <button
            type="button"
            onClick={onNextChunk}
            disabled={isNavigating}
            className="btn btn-sm btn-ghost border border-base-300"
            title="Next chunk"
          >
            »
          </button>
        ) : null}
      </div>
    </div>
  );
}
