import { useEffect, useState } from "react";
import { gqlRequest } from "@/public/api/graphqlClient";
import { PUBLIC_PRODUCTS_QUERY } from "@/public/api/queries/PublicProducts.query";
import { mapQuery } from "../utils/map";

interface Product {
  id: string;
  name: string;
  image?: string | null;
  productType: { id: string; name: string };
}

interface NodeProduct {
  publicProducts: { edges: { node: Product }[] };
}

export function usePublicProducts(requestUrlName: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestUrlName) return;
    setLoading(true);
    gqlRequest<NodeProduct>(PUBLIC_PRODUCTS_QUERY, {
      requestUrlName,
    })
      .then((data) => {
        setProducts(mapQuery(data.publicProducts?.edges));
      })
      .finally(() => setLoading(false));
  }, [requestUrlName]);

  console.log("usePublicProducts", products);

  return { products, loading };
}
