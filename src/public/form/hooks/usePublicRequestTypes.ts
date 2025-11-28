// import { useLazyLoadQuery } from "react-relay";
// import { PublicRequestTypeQuery } from "../../api/queries/PublicRequestType.query";
// import type { PublicRequestTypeQuery as Q } from "../../api/queries/__generated__/PublicRequestTypeQuery.graphql";
// import { mapQuery } from "../utils/map";

// export function usePublicRequestTypes(requestUrlName: string) {
//   const data = useLazyLoadQuery<Q>(
//     PublicRequestTypeQuery,
//     { requestUrlName },
//     { fetchPolicy: "store-and-network" }
//   );

//   return mapQuery(data.publicRequestType?.edges);
// }

import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_REQUEST_TYPES_QUERY } from "@/public/api/queries/PublicRequestType.query";
import { mapQuery } from "../utils/map";

export function usePublicRequestTypes(requestUrlName: string) {
  const [requestTypes, setRequestTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<any>(PUBLIC_REQUEST_TYPES_QUERY, { requestUrlName })
      .then((data) => {
        setRequestTypes(mapQuery(data.publicRequestType?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { requestTypes, loading };
}
