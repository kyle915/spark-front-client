// import { useLazyLoadQuery } from "react-relay";
// import { PublicProductsQuery } from "../../api/queries/PublicProducts.query";
// import type { PublicProductsQuery as Q } from "../../api/queries/__generated__/PublicProductsQuery.graphql";
// import { mapQuery } from "../utils/map";

// export function usePublicProducts(requestUrlName: string) {
//   const data = useLazyLoadQuery<Q>(
//     PublicProductsQuery,
//     { requestUrlName },
//     { fetchPolicy: "store-and-network" }
//   );

//   console.log("usePublicProducts data:", data);

//   return mapQuery(data.publicProducts?.edges);
// }

import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_PRODUCTS_QUERY } from "@/public/api/queries/PublicProducts.query";
import { mapQuery } from "../utils/map";

export function usePublicProducts(requestUrlName: string) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<any>(PUBLIC_PRODUCTS_QUERY, { requestUrlName })
      .then((data) => {
        setProducts(mapQuery(data.publicProducts?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { products, loading };
}
