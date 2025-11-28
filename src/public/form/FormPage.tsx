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

  const { clients, loading: loadingClients } = usePublicClients(tenantSlug);
  const { requestTypes, loading: loadingRequestTypes } =
    usePublicRequestTypes(tenantSlug);
  const { products, loading: loadingProducts } = usePublicProducts(tenantSlug);
  const { productTypes, loading: loadingProductTypes } =
    usePublicProductTypes(tenantSlug);
  const { distributors, loading: loadingDistributors } =
    usePublicDistributors(tenantSlug);
  const { retailers, loading: loadingRetailers } =
    usePublicRetailer(tenantSlug);

  const isLoading =
    loadingClients ||
    loadingRequestTypes ||
    loadingProducts ||
    loadingProductTypes ||
    loadingDistributors ||
    loadingRetailers;

  if (isLoading) {
    return <div className="p-6 text-center animate-pulse">Cargando datos…</div>;
  }

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

/**
 * address: String!
clientId: ID!
clientMutationId: ID = null
coordinates: [Float!]!
date: String!
details: [CreateRequestDetailInput!]!
distributorId: ID!
endTime: String!
name: String!
products: [CreateRequestProductInput!]!
requestTypeId: ID!
retailerId: ID!
startTime: String!
tenantId: ID = null
 */
