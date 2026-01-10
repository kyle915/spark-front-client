import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_RETAILER_QUERY } from "@/public/api/queries/PublicRetailer.query";
import { mapQuery } from "../utils/map";

interface Retailer {
  id: string;
  name: string;
}

interface NodeRetailer {
  publicRetailer: { edges: { node: Retailer }[] };
}

export function usePublicRetailer(requestUrlName: string) {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<NodeRetailer>(PUBLIC_RETAILER_QUERY, { requestUrlName })
      .then((data) => {
        setRetailers(mapQuery(data.publicRetailer?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { retailers, loading };
}
