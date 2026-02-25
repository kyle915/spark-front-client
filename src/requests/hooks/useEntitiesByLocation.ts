import type { GraphQLTaggedNode } from "react-relay";
import type { OperationType } from "relay-runtime";
import { useEffect, useRef, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";

interface UseEntitiesByLocationProps<TItem, TQuery extends OperationType> {
  tenantId: string | null;
  entitiesLocationId: string | null;
  initialItems: TItem[];
  selectedId?: string | null; // 👈 nuevo
  queryDocument: GraphQLTaggedNode;
  extractNodes: (data: TQuery["response"]) => TItem[];
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
}: UseEntitiesByLocationProps<TItem, TQuery>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [remoteItems, setRemoteItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const lastFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    const trimmed = searchTerm.trim();

    const selectedExists =
      selectedId && initialItems?.some((item) => item.id === selectedId);

    const shouldFetch =
      trimmed.length > 0 ||
      !initialItems?.length ||
      (selectedId && !selectedExists);

    if (!shouldFetch) return;

    const fetchKey = `${tenantId}-${entitiesLocationId ?? "null"}-${trimmed}`;

    if (lastFetchKeyRef.current === fetchKey) return;

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
        setRemoteItems(extractNodes(data));
      })
      .catch(() => {
        setRemoteItems([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [
    tenantId,
    entitiesLocationId,
    searchTerm,
    selectedId,
    initialItems,
    queryDocument,
    extractNodes,
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
