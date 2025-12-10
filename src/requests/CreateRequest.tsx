import { Suspense, useState } from "react";
import Layout from "@/layout/Layout";
import Loading from "@/shared/Loading";
import RequestForm, { type RequestFormValues } from "./components/RequestForm";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { TenantsQuery } from "@/api/queries/TenantsQuery";
import { RequestTypesQuery } from "@/api/queries/RequestTypesQuery";
import { ProductTypesQuery } from "@/api/queries/ProductTypesQuery";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import { CreateRequestMutation } from "@/api/mutations/RequestMutation";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import type { ProductsQuery as ProductsQueryType } from "@api/queries/__generated__/ProductsQuery.graphql";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import type { RequestMutation } from "@api/mutations/__generated__/RequestMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import { useNavigate } from "react-router";

interface CreateRequestFormProps {
  tenantId: string;
}

const CreateRequestForm = ({ tenantId }: CreateRequestFormProps) => {
  const requestTypesData = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const productsData = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const [commitCreateRequest, isCreating] = useMutation<RequestMutation>(
    CreateRequestMutation
  );
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  const requestTypes =
    requestTypesData.requestTypes?.edges.map((e) => e.node) || [];
  const productTypes =
    productTypesData.productTypes?.edges.map((e) => e.node) || [];
  const products = productsData.products?.edges.map((e) => e.node) || [];
  const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];

  const handleSubmit = (formData: RequestFormValues) => {
    commitCreateRequest({
      variables: {
        input: {
          tenantId,
          name: formData.name,
          date: formData.date,
          startTime: formData.startTime || "00:00",
          endTime: formData.endTime || "00:00",
          address: formData.address,
          coordinates: (formData.coordinates ?? []) as readonly number[],
          timezoneId: formData.timezoneId!,
          requestTypeId: formData.requestTypeId!,
          // Create mode fields
          clientName: formData.clientName!,
          clientEmail: formData.clientEmail!,
          distributorName: formData.distributorName!,
          distributorEmail: formData.distributorEmail!,
          retailerName: formData.retailerName!,
          retailerAddress: formData.retailerAddress!,
          retailerStoreContact: formData.retailerStoreContact!,
          storeManagerName: formData.storeManagerName!,
          storeManagerPhone: formData.storeManagerPhone!,
          // Details
          details: [
            {
              isTableNeeded: formData.isTableNeeded || false,
              tableSize: formData.tableSize
                ? parseInt(formData.tableSize)
                : null,
            },
          ],
          // Products
          products: (formData.products || []).map((id) => ({ productId: id })),
        },
      },
      onCompleted: (response) => {
        if (
          response.createRequest?.success &&
          response.createRequest.request?.uuid
        ) {
          showAlert(response.createRequest.message, "success");
          navigate(`/request/view/${response.createRequest.request.uuid}`);
        } else {
          showAlert(
            response.createRequest?.message ?? "Error creating request",
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating request: ${error.message}`, "error");
      },
    });
  };

  if (isCreating) {
    return <Loading />;
  }

  return (
    <RequestForm
      mode="create"
      onSubmit={handleSubmit}
      requestTypes={requestTypes}
      timezones={timezones}
      productTypes={productTypes}
      products={products}
    />
  );
};

const CreateRequestContent = () => {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  const tenantsData = useLazyLoadQuery<TenantsQueryType>(
    TenantsQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const tenants = tenantsData.tenants?.edges.map((e) => e.node) || [];

  return (
    <>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Create Request</h1>
        </div>

        <div className="form-control w-full max-w-xs">
          <label className="label">
            <span className="label-text">Select Tenant</span>
          </label>
          <select
            className="select select-bordered"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
          >
            <option value="">Select a tenant...</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTenantId && (
        <Suspense fallback={<Loading />}>
          <CreateRequestForm tenantId={selectedTenantId} />
        </Suspense>
      )}
    </>
  );
};

const CreateRequest = () => {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <CreateRequestContent />
      </Suspense>
    </Layout>
  );
};

export default CreateRequest;
