import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_CLIENTS_QUERY } from "@/public/api/queries/PublicClients.query";
import { mapQuery } from "../utils/map";

export function usePublicClients(requestUrlName: string) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;

    setLoading(true);
    gqlRequest<any>(PUBLIC_CLIENTS_QUERY, { requestUrlName })
      .then((data) => {
        setClients(mapQuery(data.publicClients?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { clients, loading };
}
