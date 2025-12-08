import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_PRODUCT_TYPES_QUERY } from "@/public/api/queries/PublicProductTypes.query";
import { mapQuery } from "../utils/map";

interface ProductType {
  id: string;
  name: string;
}

interface NodeProductType {
  publicProductTypes: { edges: { node: ProductType }[] };
}

export function usePublicProductTypes(requestUrlName: string) {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<NodeProductType>(PUBLIC_PRODUCT_TYPES_QUERY, { requestUrlName })
      .then((data) => {
        setProductTypes(mapQuery(data.publicProductTypes?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  return { productTypes, loading };
}
