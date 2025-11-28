import { useParams } from "react-router";
import SparkFormLayout from "./layout/FormLayout";
import SparkForm from "./components/Form";
import {
  usePublicClients,
  usePublicDistributors,
  usePublicProductTypes,
  usePublicProducts,
  usePublicRequestTypes,
  usePublicRetailer,
} from "./hooks";

export default function SparkFormPage() {
  const { tenantSlug } = useParams();

  if (!tenantSlug) {
    return <div className="p-6 text-center">Loading…</div>;
  }

  const { clients } = usePublicClients(tenantSlug);
  const { requestTypes } = usePublicRequestTypes(tenantSlug);
  const { products } = usePublicProducts(tenantSlug);
  const { productTypes } = usePublicProductTypes(tenantSlug);
  const { distributors } = usePublicDistributors(tenantSlug);
  const { retailers } = usePublicRetailer(tenantSlug);

  // const isLoading =
  //   loadingClients ||
  //   loadingRequestTypes ||
  //   loadingProducts ||
  //   loadingProductTypes ||
  //   loadingDistributors ||
  //   loadingRetailers;

  return (
    <SparkFormLayout>
      <SparkForm
        clients={clients}
        requestTypes={requestTypes}
        products={products}
        productTypes={productTypes}
        distributors={distributors}
        retailers={retailers}
        tenantId={tenantSlug}
      />
    </SparkFormLayout>
  );
}
