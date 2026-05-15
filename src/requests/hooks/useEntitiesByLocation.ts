import type { GraphQLTaggedNode } from "react-relay";
import type { OperationType } from "relay-runtime";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";

interface UseEntitiesByLocationProps<TItem, TQuery extends OperationType> {
  tenantId: string | null;
  entitiesLocationId: string | null;
  stateId?: string | null;
  filterByStateOnly?: boolean;
  locationIdRequired?: boolean;
  additionalFilters?: Record<string, unknown>;
  // selectedId?: string | null;
  queryDocument: GraphQLTaggedNode;
  extractNodes: (data: TQuery["response"]) => TItem[];
  debounceMs?: number;
  initialItems?: TItem[];
}

const EMPTY_FILTERS: Record<string, unknown> = {};

export function useEntitiesByLocation<
  TItem extends { id: string },
  TQuery extends OperationType,
>({
  tenantId,
  entitiesLocationId,
  stateId = null,
  filterByStateOnly = false,
  locationIdRequired = true,
  additionalFilters = EMPTY_FILTERS,
  initialItems,
  // selectedId,
  queryDocument,
  extractNodes,
  debounceMs = 300,
}: UseEntitiesByLocationProps<TItem, TQuery>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [remoteItems, setRemoteItems] = useState<TItem[]>([]);
  const [localItems, setLocalItems] = useState<TItem[]>(initialItems || []);
  const [isLoading, setIsLoading] = useState(false);

  const prevLocationRef = useRef<string | null | undefined>(undefined);
  const extractNodesRef = useRef(extractNodes);
  const additionalFiltersRef = useRef(additionalFilters);
  const additionalFiltersKey = JSON.stringify(additionalFilters);

  useEffect(() => {
    extractNodesRef.current = extractNodes;
  }, [extractNodes]);

  useEffect(() => {
    additionalFiltersRef.current = additionalFilters;
  }, [additionalFilters]);

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
    setLocalItems([]);
  }, [entitiesLocationId]);

  // ===============================
  // FETCH WITH DEBOUNCE
  // ===============================
  useEffect(() => {
    if (filterByStateOnly) {
      if (!stateId) {
        setRemoteItems((prev) => (prev.length === 0 ? prev : []));
        return;
      }
    } else if (!tenantId || (locationIdRequired && !entitiesLocationId)) {
      setRemoteItems((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const trimmed = searchTerm.trim();

    const timeout = setTimeout(() => {
      setIsLoading(true);

      fetchQuery<TQuery>(
        environment,
        queryDocument,
        {
          filters: filterByStateOnly
            ? { stateId }
            : {
                tenantId,
                ...(locationIdRequired
                  ? { locationId: entitiesLocationId }
                  : {}),
                ...additionalFiltersRef.current,
              },
          q: trimmed || null,
        },
        { fetchPolicy: "network-only" },
      )
        .toPromise()
        .then((data) => {
          const extracted = extractNodesRef.current(data);
          setRemoteItems(extracted);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [
    tenantId,
    entitiesLocationId,
    stateId,
    filterByStateOnly,
    locationIdRequired,
    additionalFiltersKey,
    searchTerm,
    queryDocument,
    debounceMs,
  ]);

  // ===============================
  // MERGE LOCAL + REMOTE (NO DUPES)
  // ===============================
  const items = useMemo(() => {
    const map = new Map<string, TItem>();

    for (const item of localItems) {
      map.set(item.id, item);
    }

    for (const item of remoteItems) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }

    return Array.from(map.values());
  }, [localItems, remoteItems]);

  // ===============================
  // ADD ITEM LOCALLY (for mutations)
  // ===============================
  const addItem = useCallback((item: TItem) => {
    setLocalItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [item, ...prev];
    });
  }, []);

  return {
    items,
    searchTerm,
    setSearchTerm,
    isLoading,
    addItem,
  };
}
