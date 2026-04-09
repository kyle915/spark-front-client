import { useCallback, useEffect, useState } from "react";
import type { GraphQLTaggedNode, PreloadedQuery } from "react-relay";
import { fetchQuery, useRelayEnvironment } from "react-relay";
import { useQueryLoader } from "react-relay/hooks";
import type { OperationType } from "relay-runtime";

type ConnectionEdge = {
  cursor?: string | null;
};

type PageCursorIndex = {
  after: string | null;
  startCursor: string | null;
  endCursor: string | null;
};

export type PageLoadedPayload = {
  pageNumber: number;
  pageInfo: {
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount: number;
};

type UseRelayPaginationOptions<TQuery extends OperationType> = {
  query: GraphQLTaggedNode;
  pageSize?: number;
  initialVariables?: Partial<TQuery["variables"]>;
  initialPage?: number;
  initialAfter?: string | null;
};

type UseRelayPaginationResult<TQuery extends OperationType> = {
  queryRef: PreloadedQuery<TQuery> | null;
  displayPage: number;
  isNavigating: boolean;
  isRefreshing: boolean;
  currentAfterCursor: string | null;
  handlePageLoaded: (payload: PageLoadedPayload) => void;
  refresh: () => void;
  goToPage: (page: number) => void;
  goNext: () => void;
  goPrevious: () => void;
  goNextChunk: () => void;
  goPreviousChunk: () => void;
  isPageReachable: (page: number) => boolean;
};

const DEFAULT_PAGE_SIZE = 10;
const CHUNK_SIZE = 10;

const resolveConnectionEdges = (data: unknown): ConnectionEdge[] => {
  if (!data || typeof data !== "object") return [];

  const root = data as Record<string, unknown>;

  for (const value of Object.values(root)) {
    if (!value || typeof value !== "object") continue;

    const maybeConnection = value as { edges?: unknown };
    if (!Array.isArray(maybeConnection.edges)) continue;

    return maybeConnection.edges.filter(
      (edge): edge is ConnectionEdge =>
        Boolean(edge) && typeof edge === "object",
    );
  }

  return [];
};

export function useRelayPagination<TQuery extends OperationType>({
  query,
  pageSize = DEFAULT_PAGE_SIZE,
  initialVariables = {},
  initialPage = 1,
  initialAfter = null,
}: UseRelayPaginationOptions<TQuery>): UseRelayPaginationResult<TQuery> {
  const environment = useRelayEnvironment();
  const [queryRef, loadQuery] = useQueryLoader<TQuery>(query);

  const safeInitialPage = Math.max(1, initialPage);

  const [currentPage, setCurrentPage] = useState(safeInitialPage);
  const [displayPage, setDisplayPage] = useState(safeInitialPage);
  const [totalPages, setTotalPages] = useState(1);

  const [isNavigating, setIsNavigating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [lastVariables, setLastVariables] = useState<
    TQuery["variables"] | null
  >(null);

  const [pageIndex, setPageIndex] = useState<Record<number, PageCursorIndex>>(
    () => {
      const initialIndex: Record<number, PageCursorIndex> = {
        1: { after: null, startCursor: null, endCursor: null },
      };

      if (safeInitialPage > 1) {
        initialIndex[safeInitialPage] = {
          after: initialAfter,
          startCursor: null,
          endCursor: null,
        };
      }

      return initialIndex;
    },
  );

  const mergeVariables = useCallback(
    (vars: Partial<TQuery["variables"]>): TQuery["variables"] =>
      ({
        ...initialVariables,
        ...vars,
      }) as TQuery["variables"],
    [initialVariables],
  );

  const loadWithTracking = useCallback(
    (variables: TQuery["variables"]) => {
      setLastVariables(variables);
      loadQuery(variables, { fetchPolicy: "network-only" });
    },
    [loadQuery],
  );

  const loadPage = useCallback(
    (page: number, after: string | null) => {
      setIsNavigating(true);
      setDisplayPage(page);

      loadWithTracking(
        mergeVariables({
          first: pageSize,
          after,
        }),
      );
    },
    [loadWithTracking, mergeVariables, pageSize],
  );

  useEffect(() => {
    if (!queryRef) {
      setIsNavigating(true);
      loadWithTracking(
        mergeVariables({
          first: pageSize,
          after: safeInitialPage > 1 ? initialAfter : null,
        }),
      );
    }
  }, [
    initialAfter,
    loadWithTracking,
    mergeVariables,
    pageSize,
    queryRef,
    safeInitialPage,
  ]);

  const handlePageLoaded = useCallback(
    ({ pageNumber, pageInfo, totalCount }: PageLoadedPayload) => {
      const afterUsed =
        (lastVariables?.after as string | null | undefined) ?? null;

      setPageIndex((prev) => ({
        ...prev,
        [pageNumber]: {
          after: pageNumber === 1 ? null : afterUsed,
          startCursor: pageInfo.startCursor,
          endCursor: pageInfo.endCursor,
        },
      }));

      setCurrentPage(pageNumber);
      setDisplayPage(pageNumber);
      setTotalPages(Math.max(1, Math.ceil(totalCount / pageSize)));
      setIsNavigating(false);
    },
    [lastVariables, pageSize],
  );

  const prefetchNextPages = useCallback(
    async (fromPage: number, fromEndCursor: string) => {
      const batchSize = pageSize * CHUNK_SIZE;

      const data = (await fetchQuery(
        environment,
        query,
        mergeVariables({
          first: batchSize,
          after: fromEndCursor,
        }),
        { fetchPolicy: "network-only" },
      ).toPromise()) as unknown;

      const edges = resolveConnectionEdges(data);

      const cursors = edges
        .map((e) => e?.cursor ?? null)
        .filter((c): c is string => Boolean(c));

      const computedIndex: Record<number, PageCursorIndex> = {};

      for (let i = 1; i <= CHUNK_SIZE; i++) {
        const page = fromPage + i;

        const after =
          i === 1 ? fromEndCursor : (cursors[(i - 1) * pageSize - 1] ?? null);

        computedIndex[page] = {
          after,
          startCursor: cursors[(i - 1) * pageSize] ?? null,
          endCursor: cursors[i * pageSize - 1] ?? null,
        };
      }

      setPageIndex((prev) => ({ ...prev, ...computedIndex }));

      return computedIndex;
    },
    [environment, query, mergeVariables, pageSize],
  );

  useEffect(() => {
    if (currentPage !== 1) return;

    if (pageIndex[2] !== undefined) return;

    const firstPage = pageIndex[1];
    if (!firstPage?.endCursor) return;

    prefetchNextPages(1, firstPage.endCursor);
  }, [currentPage, pageIndex, prefetchNextPages]);

  useEffect(() => {
    const current = pageIndex[currentPage];
    if (!current?.endCursor) return;

    const PREFETCH_WINDOW = CHUNK_SIZE;

    const maxPrefetchPage = Math.min(totalPages, currentPage + PREFETCH_WINDOW);

    let needsPrefetch = false;

    for (let p = currentPage + 1; p <= maxPrefetchPage; p += 1) {
      if (!pageIndex[p]) {
        needsPrefetch = true;
        break;
      }
    }

    if (!needsPrefetch) return;

    prefetchNextPages(currentPage, current.endCursor);
  }, [currentPage, totalPages, pageIndex, prefetchNextPages]);

  const goToPage = useCallback(
    async (page: number) => {
      const clamped = Math.max(1, Math.min(totalPages, page));
      if (clamped === currentPage || isNavigating) return;

      if (pageIndex[clamped]?.after !== undefined) {
        loadPage(clamped, pageIndex[clamped].after);
        return;
      }

      const current = pageIndex[currentPage];
      if (!current?.endCursor) return;

      const prefetched = await prefetchNextPages(
        currentPage,
        current.endCursor,
      );

      const after = prefetched[clamped]?.after;
      if (after !== undefined) {
        loadPage(clamped, after);
      }
    },
    [
      currentPage,
      isNavigating,
      loadPage,
      pageIndex,
      prefetchNextPages,
      totalPages,
    ],
  );

  const goNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const goPrevious = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goNextChunk = useCallback(async () => {
    const UI_JUMP = 5;

    const target = Math.min(totalPages, currentPage + UI_JUMP);

    if (isNavigating || target === currentPage) return;

    const current = pageIndex[currentPage];
    if (!current?.endCursor) return;

    if (pageIndex[target]?.after !== undefined) {
      loadPage(target, pageIndex[target].after);
      return;
    }

    await prefetchNextPages(currentPage, current.endCursor);

    setPageIndex((prev) => {
      const after = prev[target]?.after ?? null;
      loadPage(target, after);
      return prev;
    });
  }, [
    currentPage,
    isNavigating,
    loadPage,
    pageIndex,
    prefetchNextPages,
    totalPages,
  ]);

  const goPreviousChunk = useCallback(() => {
    const UI_JUMP = 5;

    const target = Math.max(1, currentPage - UI_JUMP);

    if (isNavigating || target === currentPage) return;

    const after = pageIndex[target]?.after;
    if (after === undefined) return;

    loadPage(target, after);
  }, [currentPage, isNavigating, pageIndex, loadPage]);

  const refresh = useCallback(() => {
    if (!lastVariables) return;

    setIsRefreshing(true);
    fetchQuery(environment, query, lastVariables, {
      fetchPolicy: "network-only",
    })
      .toPromise()
      .finally(() => setIsRefreshing(false));
  }, [environment, lastVariables, query]);

  const isPageReachable = useCallback(
    (page: number) => {
      if (page === currentPage) return true;

      if (page === currentPage + 1) return true;

      return pageIndex[page] !== undefined;
    },
    [currentPage, pageIndex],
  );

  return {
    queryRef: queryRef ?? null,
    displayPage,
    isNavigating,
    isRefreshing,
    currentAfterCursor: pageIndex[currentPage]?.after ?? null,
    handlePageLoaded,
    refresh,
    goToPage,
    goNext,
    goPrevious,
    goNextChunk,
    goPreviousChunk,
    isPageReachable,
  };
}
