import { useMemo, useState } from "react";
import { Link } from "react-router";
import Layout from "@/layout/Layout";
import { useLazyLoadQuery } from "react-relay/hooks";
import { ProductTypesQuery } from "@api/queries/ProductTypesQuery";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import TenantProductsGrid from "@/products/TenantProductsGrid";
import { useAuthStore } from "@/store/authStore";
import { ShoppingCartIcon, PlusIcon } from "@heroicons/react/24/solid";
import { FilterIcon, FunnelXIcon } from "lucide-react";

type ProductTypeFilterProps = {
  tenantId: string;
  value: string;
  onChange: (value: string) => void;
};

const ProductTypeFilter = ({
  tenantId,
  value,
  onChange,
}: ProductTypeFilterProps) => {
  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } }
  );

  const options = useMemo(
    () => [
      { value: "", label: "All types" },
      ...productTypesData.productTypes.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    ],
    [productTypesData]
  );

  return (
    <div className="form-control w-full sm:w-64">
      <label className="label pb-1">
        <span className="label-text">Product type</span>
      </label>
      <select
        className="select select-bordered w-full rounded-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value || "all"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const ProductsList = () => {
  const { tenantId } = useAuthStore();

  const [selectedProductTypeId, setSelectedProductTypeId] =
    useState<string>("");

  return (
    <Layout>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShoppingCartIcon className="w-8 h-8 text-primary" />
            </div>
            <h1>All Products</h1>
          </div>
          <p className="text-base-content/70">
            Manage and browse all products in the system.
          </p>
        </div>
        <Link
          to="/products/create-product"
          className="btn btn-primary rounded-full gap-1 whitespace-nowrap self-start sm:self-auto"
        >
          <PlusIcon className="w-4 h-4" /> Add product
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        <div className="spark-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <FilterIcon className="w-4 h-4" />
              <h2 className="text-sm font-semibold text-base-content/70">
                Filters
              </h2>
            </div>

            {selectedProductTypeId && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedProductTypeId("")}
                >
                  <FunnelXIcon className="w-4 h-4" />
                  Clear filters
                </button>
              </>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tenantId ? (
              <ProductTypeFilter
                tenantId={tenantId}
                value={selectedProductTypeId}
                onChange={setSelectedProductTypeId}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4"></div>
        </div>
      </div>

      {!tenantId ? (
        <div className="alert alert-warning">
          <span>Please select a tenant to see products.</span>
        </div>
      ) : (
        <TenantProductsGrid
          tenantId={tenantId}
          productTypeIdFilter={selectedProductTypeId}
          hideTypeFilter
        />
      )}
    </Layout>
  );
};

export default ProductsList;
