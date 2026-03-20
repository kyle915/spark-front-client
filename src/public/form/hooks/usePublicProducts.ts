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
  publicProducts: {
    totalCount?: number | null;
    edges: { cursor: string; node: Product }[];
    pageInfo?: {
      hasNextPage?: boolean;
      endCursor?: string | null;
    } | null;
  };
}

const PAGE_SIZE = 9;

export function usePublicProducts(
  requestUrlName: string,
  selectedProductTypeId: string | null = null,
) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!requestUrlName) {
      setProducts([]);
      setEndCursor(null);
      setHasMore(false);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadingMore(false);
    gqlRequest<NodeProduct>(PUBLIC_PRODUCTS_QUERY, {
      requestUrlName,
      first: PAGE_SIZE,
      after: null,
      filters: selectedProductTypeId
        ? { productTypeId: selectedProductTypeId }
        : null,
    })
      .then((data) => {
        const nextProducts = mapQuery(data.publicProducts?.edges);
        setProducts(nextProducts);
        setEndCursor(data.publicProducts?.pageInfo?.endCursor ?? null);
        setHasMore(Boolean(data.publicProducts?.pageInfo?.hasNextPage));
        setTotalCount(data.publicProducts?.totalCount ?? nextProducts.length);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [requestUrlName, selectedProductTypeId]);

  const loadMore = () => {
    if (!requestUrlName || !hasMore || loadingMore) return;

    setLoadingMore(true);
    gqlRequest<NodeProduct>(PUBLIC_PRODUCTS_QUERY, {
      requestUrlName,
      first: PAGE_SIZE,
      after: endCursor,
      filters: selectedProductTypeId
        ? { productTypeId: selectedProductTypeId }
        : null,
    })
      .then((data) => {
        const nextProducts = mapQuery(data.publicProducts?.edges);
        setProducts((prev) => {
          const merged = [...prev, ...nextProducts];
          const deduped = new Map(merged.map((product) => [product.id, product]));
          return Array.from(deduped.values());
        });
        setEndCursor(data.publicProducts?.pageInfo?.endCursor ?? null);
        setHasMore(Boolean(data.publicProducts?.pageInfo?.hasNextPage));
        setTotalCount((prev) => data.publicProducts?.totalCount ?? prev);
      })
      .finally(() => {
        setLoadingMore(false);
      });
  };

  return { products, loading, loadingMore, hasMore, totalCount, loadMore };
}
