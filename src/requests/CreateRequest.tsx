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
import { StatesQuery } from "@api/queries/StatesQuery";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";

import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import type { ProductsQuery as ProductsQueryType } from "@api/queries/__generated__/ProductsQuery.graphql";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import type { RequestMutation } from "@api/mutations/__generated__/RequestMutation.graphql";
import type { StatesQuery as StatesQueryType } from "@api/queries/__generated__/StatesQuery.graphql";

import { useAlertStore } from "@store/alertStore";
// import { useAuthStore } from "@store/authStore";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { dateFormat } from "@/public/form/utils/toDate";
import { buildDateTimeWithOffset } from "@utils/index";
import CatalogsProvider from "@/shared/CatalogsProvider";

interface CreateRequestFormProps {
  tenantId: string;
  userId?: string;
  userUuid?: string;
}

const CreateRequestForm = ({
  tenantId,
  userId,
  userUuid,
}: CreateRequestFormProps) => {
  // ========================
  // QUERIES
  // ========================
  const rmmClientsData = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId },
    { fetchPolicy: "store-and-network" },
  );

  const requestTypesData = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" },
  );

  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" },
  );

  const productsData = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    { filters: { tenantId }, first: 100 },
    { fetchPolicy: "store-and-network" },
  );

  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );

  const statesData = useLazyLoadQuery<StatesQueryType>(
    StatesQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );

  // ========================
  // MUTATION
  // ========================
  const [commitCreateRequest, isCreating] = useMutation<RequestMutation>(
    CreateRequestMutation,
  );

  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  // ========================
  // DATA MAPPING
  // ========================
  const rmmClients = rmmClientsData.rmmClients?.map((c) => c) || [];

  const states = statesData.states?.edges.map((e) => e.node) || [];

  const requestTypes =
    requestTypesData.requestTypes?.edges.map((e) => e.node) || [];

  const productTypes =
    productTypesData.productTypes?.edges.map((e) => e.node) || [];

  const products = productsData.products?.edges.map((e) => e.node) || [];

  const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];

  // ========================
  // SUBMIT
  // ========================
  const handleSubmit = (formData: RequestFormValues) => {
    const timezone =
      timezones.find((tz) => tz.id === formData.timezoneId) ?? null;
    const offsetMinutes = timezone?.offset ?? null;
    const dateValue = dateFormat(formData.date);

    commitCreateRequest({
      variables: {
        input: {
          tenantId: tenantId,
          name: formData.name,
          date: buildDateTimeWithOffset(dateValue, "00:00", offsetMinutes),
          notes: formData.notes?.trim() ?? "",
          startTime: formData.startTime
            ? buildDateTimeWithOffset(
                dateValue,
                formData.startTime,
                offsetMinutes,
              )
            : "",
          endTime: formData.endTime
            ? buildDateTimeWithOffset(
                dateValue,
                formData.endTime,
                offsetMinutes,
              )
            : "",
          address: formData.address,
          coordinates: (formData.coordinates ?? []) as readonly number[],
          timezoneId: formData.timezoneId!,
          requestTypeId: formData.requestTypeId!,
          distributorId: formData.distributorId ?? null,
          retailerId: formData.retailerId ?? null,
          storeManagerId: formData.storeManagerId ?? null,
          rmmAsignedId: formData.rmmAsignedId,
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
            "error",
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

  const filters = { tenantId: tenantId };

  return (
    <CatalogsProvider
      // retailers
      // retailersFilters={filters}
      // distributors
      // distributorsFilters={filters}
      requestStoreManagers
      requestStoreManagersFilters={filters}
    >
      {({ requestStoreManagers }) => (
        <RequestForm
          mode="create"
          onSubmit={handleSubmit}
          requestTypes={requestTypes}
          timezones={timezones}
          productTypes={productTypes}
          products={products}
          tenantId={tenantId}
          rmmClients={rmmClients}
          userIdLoggin={userId ? userId : ""}
          userUuidLoggin={userUuid ? userUuid : ""}
          // retailers={retailers}
          states={states}
          // distributors={distributors}
          requestStoreManagers={requestStoreManagers}
          enableContactSection={true}
          contactMode="manual"
        />
      )}
    </CatalogsProvider>
  );
};

// ========================
// PAGE CONTENT
// ========================
const CreateRequestContent = () => {
  const { tenantId, user } = useAuthStore();

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
        <CreateRequestForm
          tenantId={tenantId}
          userId={user?.id}
          userUuid={user?.uuid}
        />
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
