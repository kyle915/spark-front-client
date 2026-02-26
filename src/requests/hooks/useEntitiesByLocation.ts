import type { GraphQLTaggedNode } from "react-relay";
import type { OperationType } from "relay-runtime";
import { useEffect, useRef, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";

interface UseEntitiesByLocationProps<TItem, TQuery extends OperationType> {
  tenantId: string | null;
  entitiesLocationId: string | null;
  initialItems: TItem[];
  selectedId?: string | null;
  queryDocument: GraphQLTaggedNode;
  extractNodes: (data: TQuery["response"]) => TItem[];
  debounceMs?: number;
}

export function useEntitiesByLocation<
  TItem extends { id: string },
  TQuery extends OperationType,
>({
  tenantId,
  entitiesLocationId,
  initialItems,
  selectedId,
  queryDocument,
  extractNodes,
  debounceMs = 300,
}: UseEntitiesByLocationProps<TItem, TQuery>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [remoteItems, setRemoteItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const lastFetchKeyRef = useRef<string | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const prevLocationRef = useRef<string | null | undefined>(undefined);

  const cacheRef = useRef<Map<string, TItem[]>>(new Map());

  // ===============================
  // RESET WHEN LOCATION CHANGES
  // ===============================
  useEffect(() => {
    if (prevLocationRef.current === undefined) {
      prevLocationRef.current = entitiesLocationId ?? null;
      return;
    }

    if (prevLocationRef.current === entitiesLocationId) return;

    prevLocationRef.current = entitiesLocationId ?? null;

    setSearchTerm("");
    setRemoteItems([]);
    lastFetchKeyRef.current = null;
  }, [entitiesLocationId]);

  // ===============================
  // FETCH WITH CACHE + DEBOUNCE
  // ===============================
  useEffect(() => {
    if (!tenantId) {
      setRemoteItems([]);
      return;
    }

    const trimmed = searchTerm.trim();

    const selectedExists =
      selectedId && initialItems?.some((item) => item.id === selectedId);

    const shouldFetch =
      trimmed.length > 0 ||
      !initialItems?.length ||
      (selectedId && !selectedExists);

    if (!shouldFetch) return;

    const fetchKey = `${tenantId}-${entitiesLocationId ?? "null"}-${trimmed}`;

    if (cacheRef.current.has(fetchKey)) {
      setRemoteItems(cacheRef.current.get(fetchKey)!);
      return;
    }

    if (lastFetchKeyRef.current === fetchKey) return;

    const requestId = ++activeRequestIdRef.current;

    const timeout = setTimeout(() => {
      lastFetchKeyRef.current = fetchKey;

      const filters = {
        tenantId,
        ...(entitiesLocationId ? { locationId: entitiesLocationId } : {}),
      };

      setIsLoading(true);

      fetchQuery<TQuery>(
        environment,
        queryDocument,
        {
          filters,
          q: trimmed || null,
        },
        { fetchPolicy: "network-only" },
      )
        .toPromise()
        .then((data) => {
          if (requestId !== activeRequestIdRef.current) return;

          const extracted = extractNodes(data);

          cacheRef.current.set(fetchKey, extracted);

          setRemoteItems(extracted);
        })
        .catch(() => {
          if (requestId !== activeRequestIdRef.current) return;
          setRemoteItems([]);
        })
        .finally(() => {
          if (requestId !== activeRequestIdRef.current) return;
          setIsLoading(false);
        });
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [
    tenantId,
    entitiesLocationId,
    searchTerm,
    selectedId,
    initialItems,
    queryDocument,
    extractNodes,
    debounceMs,
  ]);

  const items =
    searchTerm.trim().length > 0
      ? remoteItems
      : initialItems?.length > 0
        ? initialItems
        : remoteItems;

  return {
    items,
    searchTerm,
    setSearchTerm,
    isLoading,
  };
}
