import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphQLTaggedNode, PreloadedQuery } from "react-relay";
import { useQueryLoader } from "react-relay/hooks";
import type { OperationType } from "relay-runtime";

type PageCursorInfo = {
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
};

type UseRelayPaginationResult<TQuery extends OperationType> = {
    queryRef: PreloadedQuery<TQuery> | null;
    displayPage: number;
    isNavigating: boolean;
    handlePageLoaded: (payload: PageLoadedPayload) => void;
    goToPage: (page: number) => void;
    goNext: (cursor: string | null) => void;
    goPrevious: (cursor: string | null) => void;
};

const DEFAULT_PAGE_SIZE = 10;

export function useRelayPagination<TQuery extends OperationType>({
    query,
    pageSize = DEFAULT_PAGE_SIZE,
    initialVariables = {},
}: UseRelayPaginationOptions<TQuery>): UseRelayPaginationResult<TQuery> {
    const [queryRef, loadQuery] = useQueryLoader<TQuery>(query);
    const [currentPage, setCurrentPage] = useState(1);
    const [displayPage, setDisplayPage] = useState(1);
    const [targetPage, setTargetPage] = useState<number | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [totalPages, setTotalPages] = useState(1);
    const [pageCursors, setPageCursors] = useState<Record<number, PageCursorInfo>>(
        {}
    );

    const initialForwardVariables = useMemo(
        () => ({
            ...initialVariables,
            first: pageSize,
            after: null,
            last: undefined,
            before: undefined,
        }),
        [initialVariables, pageSize]
    );

    const mergeVariables = useCallback(
        (variables: Partial<TQuery["variables"]>): TQuery["variables"] => {
            return {
                ...initialVariables,
                ...variables,
            } as TQuery["variables"];
        },
        [initialVariables]
    );

    useEffect(() => {
        if (!queryRef) {
            setDisplayPage(1);
            setIsNavigating(true);
            loadQuery(initialForwardVariables as TQuery["variables"]);
        }
    }, [initialForwardVariables, loadQuery, queryRef]);

    const handlePageLoaded = useCallback(
        ({ pageNumber, pageInfo, totalCount }: PageLoadedPayload) => {
            setPageCursors((prev) => ({
                ...prev,
                [pageNumber]: {
                    startCursor: pageInfo.startCursor,
                    endCursor: pageInfo.endCursor,
                },
            }));
            setCurrentPage(pageNumber);
            setDisplayPage(pageNumber);
            setIsNavigating(false);
            setTotalPages(Math.max(1, Math.ceil(totalCount / pageSize)));

            if (targetPage !== null && targetPage === pageNumber) {
                setTargetPage(null);
            }
        },
        [pageSize, targetPage]
    );

    const requestPage = useCallback(
        (page: number) => {
            const normalized = Math.trunc(page);
            if (Number.isNaN(normalized)) return;
            const clamped = Math.max(1, Math.min(totalPages, normalized));
            if (clamped === currentPage || isNavigating) return;
            setTargetPage(clamped);
        },
        [currentPage, isNavigating, totalPages]
    );

    const goNext = useCallback(
        (cursor: string | null) => {
            void cursor;
            requestPage(currentPage + 1);
        },
        [currentPage, requestPage]
    );

    const goPrevious = useCallback(
        (cursor: string | null) => {
            void cursor;
            requestPage(currentPage - 1);
        },
        [currentPage, requestPage]
    );

    const goToPage = useCallback(
        (page: number) => {
            requestPage(page);
        },
        [requestPage]
    );

    useEffect(() => {
        if (targetPage === null || targetPage === currentPage || isNavigating) {
            return;
        }

        const cursorInfo = pageCursors[currentPage];
        if (!cursorInfo) {
            return;
        }

        if (targetPage > currentPage) {
            if (!cursorInfo.endCursor) {
                setTargetPage(null);
                return;
            }
            setIsNavigating(true);
            const nextPage = currentPage + 1;
            setDisplayPage(nextPage);
            loadQuery(
                mergeVariables({
                    first: pageSize,
                    after: cursorInfo.endCursor,
                    last: undefined,
                    before: undefined,
                }) as TQuery["variables"],
                { fetchPolicy: "network-only" }
            );
        } else {
            if (!cursorInfo.startCursor) {
                setTargetPage(null);
                return;
            }
            setIsNavigating(true);
            const previousPage = Math.max(1, currentPage - 1);
            setDisplayPage(previousPage);
            loadQuery(
                mergeVariables({
                    last: pageSize,
                    before: cursorInfo.startCursor,
                    first: undefined,
                    after: undefined,
                }) as TQuery["variables"],
                { fetchPolicy: "network-only" }
            );
        }
    }, [
        currentPage,
        isNavigating,
        loadQuery,
        mergeVariables,
        pageCursors,
        pageSize,
        targetPage,
    ]);

    return {
        queryRef: queryRef ?? null,
        displayPage,
        isNavigating,
        handlePageLoaded,
        goToPage,
        goNext,
        goPrevious,
    };
}
