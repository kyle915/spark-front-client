import { Suspense } from "react";
import Layout from "@/layout/Layout";
import { useNavigate, useParams } from "react-router";
import Loading from "@shared/Loading";
import RequestForm, { type RequestFormValues } from "./components/RequestForm";
import CatalogsProvider from "@shared/CatalogsProvider";
import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { UpdateRequestMutation } from "@api/mutations/UpdateRequestMutation";
import type { UpdateRequestMutation as UpdateRequestMutationType } from "@api/mutations/__generated__/UpdateRequestMutation.graphql";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import { ProductTypesQuery } from "@/api/queries/ProductTypesQuery";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import type { ProductsQuery as ProductsQueryType } from "@api/queries/__generated__/ProductsQuery.graphql";
import { StatesQuery } from "@/api/queries/StatesQuery";
import type { StatesQuery as StatesQueryType } from "@api/queries/__generated__/StatesQuery.graphql";
import { useAlertStore } from "@store/alertStore";
import { dateFormat } from "@/public/form/utils/toDate";
import {
  buildDateTimeWithOffset,
  extractDatePart,
  extractTimePart,
} from "@utils/index";

type EditRequestContentProps = {
  uuid: string;
};

const EditRequestContent = ({ uuid }: EditRequestContentProps) => {
  const data = useLazyLoadQuery<RequestUuidQueryType>(RequestUuidQuery, {
    uuid,
  });
  const request = data.request;
  const tenantId = request?.tenantId ?? "";
  const [commitUpdateRequest] = useMutation<UpdateRequestMutationType>(
    UpdateRequestMutation,
  );
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );

  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-or-network" },
  );

  const productsData = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    { filters: { tenantId }, first: 100 },
    { fetchPolicy: "store-or-network" },
  );

  const statesData = useLazyLoadQuery<StatesQueryType>(
    StatesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );

  const states = statesData.states?.edges.map((e) => e.node) || [];

  if (!request) {
    return (
      <div className="alert alert-warning">
        <span>The specified request was not found.</span>
      </div>
    );
  }

  const handleSubmit = (formData: RequestFormValues) => {
    const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];
    const timezone =
      timezones.find((tz) => tz.id === formData.timezoneId) ?? null;
    const offsetMinutes = timezone?.offset ?? null;
    const dateValue = dateFormat(formData.date);

    commitUpdateRequest({
      variables: {
        input: {
          id: request.id,
          name: formData.name,
          notes: formData.notes?.trim() ?? "",
          date: buildDateTimeWithOffset(dateValue, "00:00", offsetMinutes),
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
          timezoneId: formData.timezoneId ?? "",
          requestTypeId: formData.requestTypeId ?? "",
          distributorId: formData.distributorId ?? "",
          retailerId: formData.retailerId ?? "",
          storeManagerName: formData.storeManagerName ?? "",
          storeManagerPhone: formData.storeManagerPhone ?? "",
          details: [],
          products: (formData.products || []).map((id) => ({
            productId: id,
          })),
        },
      },
      onCompleted: (response) => {
        if (response.updateRequest?.success) {
          showAlert(response.updateRequest.message, "success");
          navigate(`/request/view/${request.uuid}`);
        } else {
          showAlert(
            response.updateRequest?.message ?? "Error updating request",
            "error",
          );
        }
      },
      onError: (error) => {
        showAlert(`Error updating request: ${error.message}`, "error");
      },
    });
  };

  const defaultDate = extractDatePart(request.date ?? "") ?? request.date ?? "";
  const defaultStartTime =
    extractTimePart(request.startTime ?? "") ?? request.startTime ?? undefined;
  const defaultEndTime =
    extractTimePart(request.endTime ?? "") ?? request.endTime ?? undefined;

  const defaultValues: Partial<RequestFormValues> = {
    name: request.name ?? "",
    notes: (request as { notes?: string | null }).notes ?? "",
    date: defaultDate,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    address: request.address ?? "",
    coordinates: request.coordinates?.length ? [...request.coordinates] : null,
    timezoneId: request.timezone?.id ?? null,
    distributorId:
      request.distributor?.id ?? request?.distributor?.id ?? undefined,
    retailerId: request.retailer?.id ?? request?.retailer?.id ?? undefined,
    stateId:
      request.retailer?.location?.state?.id ??
      request.distributor?.location?.state?.id ??
      request?.retailer?.location?.state?.id ??
      request?.distributor?.location?.state?.id ??
      undefined,
    entitiesLocationId:
      request.retailer?.location?.id ??
      request.distributor?.location?.id ??
      request?.retailer?.location?.id ??
      request?.distributor?.location?.id ??
      undefined,

    distributorLocationId:
      request.distributor?.location?.id ??
      request?.distributor?.location?.id ??
      undefined,

    retailerLocationId:
      request.retailer?.location?.id ??
      request?.retailer?.location?.id ??
      undefined,
    requestTypeId: request.requestType?.id ?? null,
    // storeManagerId: request.storeManager?.id ?? null, // Falta en el query request.graphql
    products: request.products?.map((product) => product.id) ?? [],
  };

  const filters = { tenantId: request.tenantId };
  const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];
  const productTypes =
    productTypesData.productTypes?.edges.map((e) => e.node) || [];
  const products = productsData.products?.edges.map((e) => e.node) || [];

  return (
    <>
      <CatalogsProvider
        clients
        clientsFilters={filters}
        retailers
        retailersFilters={filters}
        distributors
        distributorsFilters={filters}
        requestTypes
        requestTypesFilters={filters}
        requestStoreManagers
        requestStoreManagersFilters={filters}
      >
        {({
          clients,
          retailers,
          distributors,
          requestTypes,
          requestStoreManagers,
          loading,
          errors,
          refetch,
        }) => {
          if (Object.values(loading).some(Boolean)) return <Loading />;
          if (Object.values(errors).some(Boolean))
            return <div className="alert alert-error">Catalog error</div>;

          return (
            <RequestForm
              mode="edit"
              tenantId={request.tenantId}
              requestId={request.id}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              clients={clients}
              states={states}
              retailers={
                request.retailer?.id
                  ? retailers.filter((r) => r.id === request.retailer?.id)
                  : retailers
              }
              distributors={
                request.distributor?.id
                  ? distributors.filter((d) => d.id === request.distributor?.id)
                  : distributors
              }
              requestTypes={requestTypes}
              timezones={timezones}
              productTypes={productTypes}
              products={products}
              requestStoreManagers={requestStoreManagers}
              enableContactSection={true}
              contactMode="manual"
              onRefetch={refetch}
            />
          );
        }}
      </CatalogsProvider>
    </>
  );
};

const EditRequest = () => {
  const { uuid } = useParams<{ uuid: string }>();

  if (!uuid) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>The request identifier is not defined.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <EditRequestContent uuid={uuid} />
      </Suspense>
    </Layout>
  );
};

export default EditRequest;
