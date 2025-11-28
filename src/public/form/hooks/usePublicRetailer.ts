// import { useLazyLoadQuery } from "react-relay";
// import { PublicRetailerQuery } from "../../api/queries/PublicRetailer.query";
// import type { PublicRetailerQuery as Q } from "../../api/queries/__generated__/PublicRetailerQuery.graphql";
// import { mapQuery } from "../utils/map";

// export function usePublicRetailer(requestUrlName: string) {
//   const data = useLazyLoadQuery<Q>(
//     PublicRetailerQuery,
//     { requestUrlName },
//     { fetchPolicy: "store-and-network" }
//   );

//   console.log("usePublicRetailer data:", data);

//   return mapQuery(data.publicRetailer?.edges);
// }

import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_RETAILER_QUERY } from "@/public/api/queries/PublicRetailer.query";
import { mapQuery } from "../utils/map";

export function usePublicRetailer(requestUrlName: string) {
  const [retailers, setRetailers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<any>(PUBLIC_RETAILER_QUERY, { requestUrlName })
      .then((data) => {
        setRetailers(mapQuery(data.publicRetailer?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { retailers, loading };
}
