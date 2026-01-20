import type { GraphQLTaggedNode } from "react-relay";
import type { OperationType } from "relay-runtime";
import { useEffect, useState } from "react";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";

interface UseEntitiesByLocationProps<TItem, TQuery extends OperationType> {
  tenantId: string | null;
  entitiesLocationId: string | null;
  initialItems: TItem[];
  queryDocument: GraphQLTaggedNode;
  extractNodes: (data: TQuery["response"]) => TItem[];
}

export function useEntitiesByLocation<TItem, TQuery extends OperationType>({
  tenantId,
  entitiesLocationId,
  initialItems,
  queryDocument,
  extractNodes,
}: UseEntitiesByLocationProps<TItem, TQuery>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [remoteItems, setRemoteItems] = useState<TItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setRemoteItems([]);
      setHasFetched(false);
      return;
    }

    const q = searchTerm.trim();
    const filters = {
      tenantId,
      ...(entitiesLocationId ? { locationId: entitiesLocationId } : {}),
    };

    let subscription: { unsubscribe: () => void } | null = null;

    const timeout = setTimeout(() => {
      subscription = fetchQuery<TQuery>(
        environment,
        queryDocument,
        {
          filters,
          q: q || null,
        },
        { fetchPolicy: "network-only" },
      ).subscribe({
        next: (data) => {
          setRemoteItems(extractNodes(data));
        },
        error: () => {
          setRemoteItems([]);
          setHasFetched(true);
        },
        complete: () => setHasFetched(true),
      });
    }, 300);

    return () => {
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, [tenantId, entitiesLocationId, searchTerm, queryDocument, extractNodes]);

  const items = hasFetched ? remoteItems : initialItems;

  return {
    items,
    searchTerm,
    setSearchTerm,
    hasFetched,
  };
}
