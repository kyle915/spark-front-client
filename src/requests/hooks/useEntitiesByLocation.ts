import type { GraphQLTaggedNode } from "react-relay";
import type { OperationType } from "relay-runtime";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";

interface UseEntitiesByLocationProps<TItem, TQuery extends OperationType> {
  tenantId: string | null;
  entitiesLocationId: string | null;
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
  queryDocument,
  extractNodes,
  debounceMs = 300,
}: UseEntitiesByLocationProps<TItem, TQuery>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [remoteItems, setRemoteItems] = useState<TItem[]>([]);
  const [localItems, setLocalItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const prevLocationRef = useRef<string | null | undefined>(undefined);

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
    if (!tenantId || !entitiesLocationId) {
      setRemoteItems([]);
      return;
    }

    const trimmed = searchTerm.trim();

    const timeout = setTimeout(() => {
      setIsLoading(true);

      fetchQuery<TQuery>(
        environment,
        queryDocument,
        {
          filters: {
            tenantId,
            locationId: entitiesLocationId,
          },
          q: trimmed || null,
        },
        { fetchPolicy: "network-only" },
      )
        .toPromise()
        .then((data) => {
          const extracted = extractNodes(data);
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
    searchTerm,
    queryDocument,
    extractNodes,
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
