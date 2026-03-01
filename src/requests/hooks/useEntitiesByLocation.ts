import type { GraphQLTaggedNode } from "react-relay";
import type { OperationType } from "relay-runtime";
import { useEffect, useRef, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";

interface UseEntitiesByLocationProps<TItem, TQuery extends OperationType> {
  tenantId: string | null;
  entitiesLocationId: string | null;
  // initialItems: TItem[];
  // selectedId?: string | null;
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
  // initialItems,
  // selectedId,
  queryDocument,
  extractNodes,
  debounceMs = 300,
}: UseEntitiesByLocationProps<TItem, TQuery>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [remoteItems, setRemoteItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const lastFetchKeyRef = useRef<string | null>(null);
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
    lastFetchKeyRef.current = null;
  }, [entitiesLocationId]);

  // ===============================
  // FETCH WITH CACHE + DEBOUNCE
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

  const items = searchTerm.trim().length > 0 ? remoteItems : remoteItems;

  return {
    items,
    searchTerm,
    setSearchTerm,
    isLoading,
  };
}
