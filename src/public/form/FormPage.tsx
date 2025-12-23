import { useParams } from "react-router";
import SparkFormLayout from "./layout/FormLayout";
import SparkForm from "./components/Form";
import {
  // usePublicClients,
  usePublicProductTypes,
  usePublicProducts,
  usePublicRequestTypes,
  usePublicTimeZones,
  usePublicDistributors,
  usePublicRetailer,
} from "./hooks";

export default function SparkFormPage() {
  const { tenantSlug } = useParams();

  const slug = tenantSlug ?? "";

  const { products } = usePublicProducts(slug);
  // const { clients } = usePublicClients(slug);
  const { requestTypes } = usePublicRequestTypes(slug);
  const { productTypes } = usePublicProductTypes(slug);
  const { timeZones } = usePublicTimeZones();
  const { distributors } = usePublicDistributors(slug);
  const { retailers } = usePublicRetailer(slug);

  // if (
  //   !tenantSlug ||
  //   loadingProducts ||
  //   loadingClients ||
  //   loadingRequestTypes ||
  //   loadingProductTypes ||
  //   loadingDistributors ||
  //   loadingRetailers
  // ) {
  //   return <div className="p-6 text-center">Loading…</div>;
  // }

  return (
    <SparkFormLayout>
      <SparkForm
        // clients={clients}
        requestTypes={requestTypes}
        products={products}
        productTypes={productTypes}
        distributors={distributors}
        retailers={retailers}
        tenantId={slug}
        timeZones={timeZones}
      />
    </SparkFormLayout>
  );
}
