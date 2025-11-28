// import { useLazyLoadQuery } from "react-relay";
// import { PublicProductTypesQuery } from "../../api/queries/PublicProductTypes.query";
// import type { PublicProductTypesQuery as Q } from "../../api/queries/__generated__/PublicProductTypesQuery.graphql";
// import { mapQuery } from "../utils/map";

// export function usePublicProductTypes(requestUrlName: string) {
//   const data = useLazyLoadQuery<Q>(
//     PublicProductTypesQuery,
//     { requestUrlName },
//     { fetchPolicy: "store-and-network" }
//   );

//   console.log("usePublicProductTypes data:", data);

//   return mapQuery(data.publicProductTypes?.edges);
// }

import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_PRODUCT_TYPES_QUERY } from "@/public/api/queries/PublicProductTypes.query";
import { mapQuery } from "../utils/map";

export function usePublicProductTypes(requestUrlName: string) {
  const [productTypes, setProductTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<any>(PUBLIC_PRODUCT_TYPES_QUERY, { requestUrlName })
      .then((data) => {
        setProductTypes(mapQuery(data.publicProductTypes?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { productTypes, loading };
}
