import { useParams } from "react-router";
import { useState } from "react";
import SparkFormLayout from "./layout/FormLayout";
import SparkForm from "./components/Form";
import {
  // usePublicClients,
  usePublicProductTypes,
  usePublicProducts,
  usePublicRequestTypes,
  usePublicTimeZones,
  usePublicDistributors,
  usePublicLocations,
  usePublicRetailer,
} from "./hooks";

export default function SparkFormPage() {
  const { tenantSlug } = useParams();

  const slug = tenantSlug ?? "";
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [retailerQuery, setRetailerQuery] = useState("");

  const { products } = usePublicProducts(slug);
  // const { clients } = usePublicClients(slug);
  const { requestTypes } = usePublicRequestTypes(slug);
  const { productTypes } = usePublicProductTypes(slug);
  const { timeZones } = usePublicTimeZones();
  const { distributors } = usePublicDistributors(slug, selectedLocationId);
  const { retailers } = usePublicRetailer(
    slug,
    selectedLocationId,
    retailerQuery
  );
  const { locations } = usePublicLocations(slug, locationQuery);

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
    <SparkFormLayout slug={slug}>
      <SparkForm
        // clients={clients}
        requestTypes={requestTypes}
        locations={locations}
        onLocationSearch={setLocationQuery}
        onLocationChange={setSelectedLocationId}
        onRetailerSearch={setRetailerQuery}
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
