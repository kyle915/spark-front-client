import type { GraphQLTaggedNode } from "react-relay";
import type { OperationType } from "relay-runtime";
import { useEffect, useRef, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";

interface UseSearchQueryProps<TItem, TQuery extends OperationType> {
  queryDocument: GraphQLTaggedNode;
  extractNodes: (data: TQuery["response"]) => TItem[];
  variables?: Record<string, unknown>;
  debounceMs?: number;
  minLength?: number;
}

const EMPTY_VARIABLES: Record<string, unknown> = {};

export function useSearchQuery<TItem, TQuery extends OperationType>({
  queryDocument,
  extractNodes,
  variables = EMPTY_VARIABLES,
  debounceMs = 300,
  minLength = 0,
}: UseSearchQueryProps<TItem, TQuery>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeRequestIdRef = useRef(0);
  const cacheRef = useRef<Map<string, TItem[]>>(new Map());
  const extractNodesRef = useRef(extractNodes);
  const variablesRef = useRef(variables);

  const variablesKey = JSON.stringify(variables);

  useEffect(() => {
    extractNodesRef.current = extractNodes;
  }, [extractNodes]);

  useEffect(() => {
    variablesRef.current = variables;
  }, [variables]);

  useEffect(() => {
    const trimmed = searchTerm.trim();

    if (trimmed.length < minLength) {
      setItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const cacheKey = JSON.stringify({
      ...variablesRef.current,
      q: trimmed,
    });

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
          ...variablesRef.current,
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
  }, [
    searchTerm,
    queryDocument,
    variablesKey,
    debounceMs,
    minLength,
  ]);

  return {
    items,
    searchTerm,
    setSearchTerm,
    isLoading,
  };
}
