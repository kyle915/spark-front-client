import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_DISTRIBUTORS_QUERY } from "@/public/api/queries/PublicDistributors.query";
import { mapQuery } from "../utils/map";

interface Distributor {
  id: string;
  name: string;
}

interface NodeDistributor {
  edges: { node: Distributor }[];
}

export function usePublicDistributors(requestUrlName: string) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;

    setLoading(true);
    gqlRequest<NodeDistributor>(PUBLIC_DISTRIBUTORS_QUERY, { requestUrlName })
      .then((data) => {
        setDistributors(mapQuery(data.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { distributors, loading };
}
