import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_LOCATIONS_QUERY } from "@/public/api/queries/PublicLocations.query";
import { mapQuery } from "../utils/map";

interface Location {
  id: string;
  name: string;
}

interface NodeLocation {
  publicLocations: { edges: { node: Location }[] };
}

export function usePublicLocations(requestUrlName: string, q?: string) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<NodeLocation>(PUBLIC_LOCATIONS_QUERY, { requestUrlName, q })
      .then((data) => {
        setLocations(mapQuery(data.publicLocations?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName, q]);

  return { locations, loading };
}
