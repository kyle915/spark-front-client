import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_RETAILER_QUERY } from "@/public/api/queries/PublicRetailer.query";
import { mapQuery } from "../utils/map";

interface Retailer {
  id: string;
  name: string;
  location?: {
    id: string;
    name: string;
    state?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface NodeRetailer {
  publicRetailers: { edges: { node: Retailer }[] };
}

export function usePublicRetailer(
  requestUrlName: string,
  stateId?: string,
  q?: string
) {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<NodeRetailer>(PUBLIC_RETAILER_QUERY, {
      requestUrlName,
      filters: stateId ? { stateId } : null,
      q,
    })
      .then((data) => {
        setRetailers(mapQuery(data.publicRetailers?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName, stateId, q]);

  return { retailers, loading };
}
