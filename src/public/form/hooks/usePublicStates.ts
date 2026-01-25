import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_STATES_QUERY } from "@/public/api/queries/PublicStates.query";
import { mapQuery } from "../utils/map";

interface State {
  id: string;
  name: string;
  code: string;
}

interface NodeState {
  publicStates: { edges: { node: State }[] };
}

export function usePublicStates(q?: string) {
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const normalizedQ = q?.trim() || undefined;

  useEffect(() => {
    setLoading(true);
    gqlRequest<NodeState>(PUBLIC_STATES_QUERY, { q: normalizedQ })
      .then((data) => {
        setStates(mapQuery(data.publicStates?.edges));
      })
      .finally(() => setLoading(false));
  }, [normalizedQ]);

  return { states, loading };
}
