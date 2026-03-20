import ProductSelector from "../ProductSelector";
// import FormSelect from "@/shared/FormSelect";
import type { Control } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";

interface ProductItem {
  id: string;
  name: string;
  image?: string | null;
  productType: {
    id: string;
    name: string;
  };
}

interface SimpleCatalog {
  id: string;
  name: string;
}

interface Step2ProductsProps {
  control: Control<SparkFormData, any, SparkFormData>;
  products: ProductItem[];
  productsLoading?: boolean;
  productsHasMore?: boolean;
  productsTotalCount?: number;
  onLoadMoreProducts?: () => void;
  selectedProductTypeId?: string | null;
  onProductTypeChange?: (productTypeId: string | null) => void;
  productTypes: SimpleCatalog[];
  // clients: SimpleCatalog[];
  // distributors: SimpleCatalog[];
  // retailers: SimpleCatalog[];
  // requestTypes: SimpleCatalog[];
}

export function Step2Products({
  control,
  products,
  productsLoading = false,
  productsHasMore = false,
  productsTotalCount = 0,
  onLoadMoreProducts,
  selectedProductTypeId = null,
  onProductTypeChange,
  productTypes,
}: // clients,
// distributors,
// retailers,
// requestTypes,
Step2ProductsProps) {
  return (
    <div className="space-y-10">
      <ProductSelector
        name="skus"
        label="Choose SKUs"
        control={control}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          desc: "",
          image: p.image,
          productTypeId: p.productType.id,
        }))}
        productTypes={productTypes}
        loadingProducts={productsLoading}
        hasMoreProducts={productsHasMore}
        totalProductsCount={productsTotalCount}
        onLoadMoreProducts={onLoadMoreProducts}
        selectedType={selectedProductTypeId ?? "all"}
        onSelectedTypeChange={onProductTypeChange}
      />

      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="hidden">
          <FormSelect
            name="client"
            label="Client"
            control={control}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <FormSelect
          name="distributor"
          label="Distributor"
          control={control}
          options={distributors.map((d) => ({ value: d.id, label: d.name }))}
        />
        <FormSelect
          name="retailer"
          label="Retailer"
          control={control}
          options={retailers.map((r) => ({ value: r.id, label: r.name }))}
        />
        <FormSelect
          name="request_type"
          label="Request Type"
          control={control}
          options={requestTypes.map((rt) => ({
            value: rt.id,
            label: rt.name,
          }))}
        />
      </div> */}
    </div>
  );
}
