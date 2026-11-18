import { ProductsQuery } from "@/api/queries/ProductsQuery";
import type { ProductsQuery as ProductsQueryType } from "@/api/queries/__generated__/ProductsQuery.graphql";
import { useAllConnectionPages } from "@/hooks/useAllConnectionPages";

/** Product pickers show a brand's whole catalog, up to this many SKUs. */
export const PRODUCT_PICKER_MAX = 1000;

type ProductsConnection = ProductsQueryType["response"]["products"];
export type TenantProduct = NonNullable<
  NonNullable<ProductsConnection["edges"][number]>["node"]
>;

/**
 * A brand's product catalog for the recap pickers. Suspends on the first
 * page; brand users (200 rows a request) get the rest a moment later.
 */
export function useTenantProducts(tenantId: string | null): TenantProduct[] {
  const { nodes } = useAllConnectionPages<ProductsQueryType, TenantProduct>(
    ProductsQuery,
    { first: PRODUCT_PICKER_MAX, filters: tenantId ? { tenantId } : null },
    (response) => response.products,
  );
  return nodes;
}
