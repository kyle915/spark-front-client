import { Suspense } from "react";
import Layout from "@/layout/Layout";
import Loading from "@/shared/Loading";
import RequestForm, { type RequestFormValues } from "./components/RequestForm";

import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { RequestTypesQuery } from "@/api/queries/RequestTypesQuery";
import { ProductTypesQuery } from "@/api/queries/ProductTypesQuery";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import { CreateRequestMutation } from "@/api/mutations/RequestMutation";

import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import type { ProductsQuery as ProductsQueryType } from "@api/queries/__generated__/ProductsQuery.graphql";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import type { RequestMutation } from "@api/mutations/__generated__/RequestMutation.graphql";

import { useAlertStore } from "@store/alertStore";
// import { useAuthStore } from "@store/authStore";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { dateFormat } from "@/public/form/utils/toDate";

interface CreateRequestFormProps {
  tenantId: string;
}

const CreateRequestForm = ({ tenantId }: CreateRequestFormProps) => {
  // ========================
  // QUERIES
  // ========================
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

  // ========================
  // MUTATION
  // ========================
  const [commitCreateRequest, isCreating] = useMutation<RequestMutation>(
    CreateRequestMutation
  );

  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  // ========================
  // DATA MAPPING
  // ========================
  const requestTypes =
    requestTypesData.requestTypes?.edges.map((e) => e.node) || [];

  const productTypes =
    productTypesData.productTypes?.edges.map((e) => e.node) || [];

  const products = productsData.products?.edges.map((e) => e.node) || [];

  const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];

  const buildDateTime = (date: string, time: string) => {
    return `${date} ${time}:00`;
  };

  // ========================
  // SUBMIT
  // ========================
  const handleSubmit = (formData: RequestFormValues) => {
    commitCreateRequest({
      variables: {
        input: {
          tenantId: tenantId,
          name: formData.name,
          date: dateFormat(formData.date),
          startTime: formData.startTime
            ? buildDateTime(dateFormat(formData.date), formData.startTime)
            : "",
          endTime: formData.endTime
            ? buildDateTime(dateFormat(formData.date), formData.endTime)
            : "",
          address: formData.address,
          coordinates: (formData.coordinates ?? []) as readonly number[],
          timezoneId: formData.timezoneId!,
          requestTypeId: formData.requestTypeId!,

          // Create-only fields
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
          products: (formData.products || []).map((id) => ({
            productId: id,
          })),
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

// ========================
// PAGE CONTENT
// ========================
const CreateRequestContent = () => {
  const { tenantId } = useAuthStore();

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center py-20 text-base-content/60">
        No tenant selected. Please select a company first.
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<Loading />}>
        <CreateRequestForm tenantId={tenantId} />
      </Suspense>
    </>
  );
};

// ========================
// PAGE
// ========================
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
