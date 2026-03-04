import type { GraphQLTaggedNode } from "react-relay";
import type { OperationType } from "relay-runtime";
import { useEffect, useRef, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";

interface UseLocationsByStateProps<TItem, TQuery extends OperationType> {
  stateId: string | null;
  queryDocument: GraphQLTaggedNode;
  extractNodes: (data: TQuery["response"]) => TItem[];
  debounceMs?: number;
}

export function useLocationsByState<
  TItem extends { id: string },
  TQuery extends OperationType,
>({
  stateId,
  queryDocument,
  extractNodes,
  debounceMs = 300,
}: UseLocationsByStateProps<TItem, TQuery>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeRequestIdRef = useRef(0);
  const cacheRef = useRef<Map<string, TItem[]>>(new Map());
  const prevStateRef = useRef<string | null | undefined>(undefined);
  const extractNodesRef = useRef(extractNodes);

  useEffect(() => {
    extractNodesRef.current = extractNodes;
  }, [extractNodes]);

  // Reset when state changes
  useEffect(() => {
    if (prevStateRef.current === undefined) {
      prevStateRef.current = stateId ?? null;
      return;
    }

    if (prevStateRef.current === stateId) return;

    prevStateRef.current = stateId ?? null;

    setSearchTerm("");
    setItems([]);
  }, [stateId]);

  useEffect(() => {
    if (!stateId) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const trimmed = searchTerm.trim();
    const cacheKey = `${stateId}-${trimmed}`;

    // Cache hit
    if (cacheRef.current.has(cacheKey)) {
      setItems(cacheRef.current.get(cacheKey)!);
      return;
    }

    const requestId = ++activeRequestIdRef.current;

    const timeout = setTimeout(() => {
      setIsLoading(true);

      fetchQuery<TQuery>(
        environment,
        queryDocument,
        {
          filters: {
            stateId,
          },
          q: trimmed || null,
        },
        { fetchPolicy: "network-only" },
      )
        .toPromise()
        .then((data) => {
          if (requestId !== activeRequestIdRef.current) return;

          const extracted = extractNodesRef.current(data);
          cacheRef.current.set(cacheKey, extracted);
          setItems(extracted);
        })
        .catch(() => {
          if (requestId !== activeRequestIdRef.current) return;
          setItems((prev) => (prev.length === 0 ? prev : []));
        })
        .finally(() => {
          if (requestId !== activeRequestIdRef.current) return;
          setIsLoading(false);
        });
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [stateId, searchTerm, queryDocument, debounceMs]);

  return {
    items,
    searchTerm,
    setSearchTerm,
    isLoading,
  };
}
