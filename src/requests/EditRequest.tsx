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
import { LocationsQuery } from "@api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@api/queries/__generated__/LocationsQuery.graphql";
import { ProductTypesQuery } from "@/api/queries/ProductTypesQuery";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import type { ProductsQuery as ProductsQueryType } from "@api/queries/__generated__/ProductsQuery.graphql";
import { useAlertStore } from "@store/alertStore";

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
    UpdateRequestMutation
  );
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const productsData = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    { filters: { tenantId }, first: 100 },
    { fetchPolicy: "store-and-network" }
  );

  const locationsData = useLazyLoadQuery<LocationsQueryType>(LocationsQuery, {
    filters: { tenantId },
  });

  const locations = locationsData.locations.edges.map((e) => e.node);

  if (!request) {
    return (
      <div className="alert alert-warning">
        <span>The specified request was not found.</span>
      </div>
    );
  }

  const handleSubmit = (formData: RequestFormValues) => {
    commitUpdateRequest({
      variables: {
        input: {
          id: request.id,
          name: formData.name,
          date: formData.date,
          startTime: formData.startTime || "00:00",
          endTime: formData.endTime || "00:00",
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
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error updating request: ${error.message}`, "error");
      },
    });
  };

  const defaultValues: Partial<RequestFormValues> = {
    name: request.name ?? "",
    date: request.date ?? "",
    startTime: request.startTime ?? "",
    endTime: request.endTime ?? "",
    address: request.address ?? "",
    coordinates: request.coordinates?.length ? [...request.coordinates] : null,
    timezoneId: request.timezone?.id ?? null,
    retailerId: request.retailer?.id ?? null,
    distributorId: request.distributor?.id ?? null,
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
              retailers={retailers}
              distributors={distributors}
              requestTypes={requestTypes}
              timezones={timezones}
              productTypes={productTypes}
              products={products}
              locations={locations}
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
