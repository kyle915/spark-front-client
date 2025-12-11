import { useEffect, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantsQuery } from "@api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import { ProductTypesQuery } from "@api/queries/ProductTypesQuery";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import TenantProductsGrid from "@/shared/TenantProductsGrid";

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
  const tenantsData = useLazyLoadQuery<TenantsQueryType>(
    TenantsQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const tenantOptions = useMemo(
    () =>
      tenantsData.tenants.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    [tenantsData]
  );

  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedProductTypeId, setSelectedProductTypeId] =
    useState<string>("");

  useEffect(() => {
    if (!selectedTenantId && tenantOptions.length > 0) {
      setSelectedTenantId(tenantOptions[0].value);
    }
  }, [selectedTenantId, tenantOptions]);

  useEffect(() => {
    setSelectedProductTypeId("");
  }, [selectedTenantId]);

  return (
    <Layout>
      <div className="mb-4">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-bold">Products</h1>
            <p className="text-base-content/70 text-sm">
              Select a tenant to view its products
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="form-control w-full sm:w-64">
              <label className="label pb-1">
                <span className="label-text">Tenant</span>
              </label>
              <select
                className="select select-bordered w-full rounded-full"
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                disabled={tenantOptions.length === 0}
              >
                {tenantOptions.length === 0 && (
                  <option value="">No tenants found</option>
                )}
                {tenantOptions.map((tenant) => (
                  <option key={tenant.value} value={tenant.value}>
                    {tenant.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedTenantId ? (
              <ProductTypeFilter
                tenantId={selectedTenantId}
                value={selectedProductTypeId}
                onChange={setSelectedProductTypeId}
              />
            ) : null}
          </div>
        </div>
      </div>

      {!selectedTenantId ? (
        <div className="alert alert-warning">
          <span>Please select a tenant to see products.</span>
        </div>
      ) : (
        <TenantProductsGrid
          tenantId={selectedTenantId}
          productTypeIdFilter={selectedProductTypeId}
          hideTypeFilter
        />
      )}
    </Layout>
  );
};

export default ProductsList;
