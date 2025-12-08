import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_REQUEST_TYPES_QUERY } from "@/public/api/queries/PublicRequestType.query";
import { mapQuery } from "../utils/map";

interface RequestType {
  id: string;
  name: string;
}

interface NodeRequestType {
  publicRequestType: { edges: { node: RequestType }[] };
}

export function usePublicRequestTypes(requestUrlName: string) {
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<NodeRequestType>(PUBLIC_REQUEST_TYPES_QUERY, { requestUrlName })
      .then((data) => {
        setRequestTypes(mapQuery(data.publicRequestType?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { requestTypes, loading };
}
