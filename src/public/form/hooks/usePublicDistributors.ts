import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_DISTRIBUTORS_QUERY } from "@/public/api/queries/PublicDistributors.query";
import { mapQuery } from "../utils/map";

interface Distributor {
  id: string;
  name: string;
  location?: {
    id: string;
    name: string;
  } | null;
}

interface NodeDistributor {
  publicDistributors: { edges: { node: Distributor }[] };
}

export function usePublicDistributors(
  requestUrlName: string,
  locationId?: string
) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;

    setLoading(true);
    gqlRequest<NodeDistributor>(PUBLIC_DISTRIBUTORS_QUERY, {
      requestUrlName,
      filters: locationId ? { locationId } : null,
    })
      .then((data) => {
        setDistributors(mapQuery(data.publicDistributors.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName, locationId]);

  return { distributors, loading };
}
