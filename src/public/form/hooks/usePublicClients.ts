import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_CLIENTS_QUERY } from "@/public/api/queries/PublicClients.query";
import { mapQuery } from "../utils/map";

interface Clients {
  id: string;
  name: string;
}

interface NodeClients {
  publicClients: { edges: { node: Clients }[] };
}

export function usePublicClients(requestUrlName: string) {
  const [clients, setClients] = useState<Clients[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;

    setLoading(true);
    gqlRequest<NodeClients>(PUBLIC_CLIENTS_QUERY, { requestUrlName })
      .then((data) => {
        setClients(mapQuery(data.publicClients?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { clients, loading };
}
