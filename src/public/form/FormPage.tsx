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
  usePublicBillingEntities,
  usePublicStates,
  usePublicRetailer,
  usePublicPrefersRegionalRetailers,
} from "./hooks";

export default function SparkFormPage() {
  const { tenantSlug } = useParams();

  const slug = tenantSlug ?? "";
  const [stateQuery, setStateQuery] = useState("");
  const [selectedStateId, setSelectedStateId] = useState("");
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<
    string | null
  >(null);
  const [retailerQuery, setRetailerQuery] = useState("");
  const [billingEntityQuery, setBillingEntityQuery] = useState("");
  const [isNationalRetailer, setIsNationalRetailer] = useState(true);

  const {
    products,
    loading: loadingProducts,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
  } = usePublicProducts(slug, selectedProductTypeId);
  // const { clients } = usePublicClients(slug);
  const { requestTypes } = usePublicRequestTypes(slug);
  const { productTypes } = usePublicProductTypes(slug);
  const { timeZones } = usePublicTimeZones();
  const { distributors } = usePublicDistributors(slug, selectedStateId);
  const { retailers } = usePublicRetailer(
    slug,
    selectedStateId,
    retailerQuery,
    isNationalRetailer,
  );
  const prefersRegionalRetailers = usePublicPrefersRegionalRetailers(slug);
  const { billingEntities } = usePublicBillingEntities(slug, billingEntityQuery);
  const { states } = usePublicStates(stateQuery);

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
        billingEntities={billingEntities}
        onBillingEntitySearch={setBillingEntityQuery}
        states={states}
        onStateSearch={setStateQuery}
        onStateChange={setSelectedStateId}
        onRetailerSearch={setRetailerQuery}
        onNationalRetailerChange={setIsNationalRetailer}
        products={products}
        productsLoading={loadingProducts || loadingMore}
        productsHasMore={hasMore}
        productsTotalCount={totalCount}
        onLoadMoreProducts={loadMore}
        selectedProductTypeId={selectedProductTypeId}
        onProductTypeChange={setSelectedProductTypeId}
        productTypes={productTypes}
        distributors={distributors}
        retailers={retailers}
        prefersRegionalRetailers={prefersRegionalRetailers}
        tenantId={slug}
        requestUrlName={slug}
        timeZones={timeZones}
      />
    </SparkFormLayout>
  );
}
