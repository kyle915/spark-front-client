import { Suspense } from "react";
import Layout from "@/layout/Layout";
import { useParams } from "react-router";
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
import { useAlertStore } from "@store/alertStore";

type EditRequestContentProps = {
  uuid: string;
};

const EditRequestContent = ({ uuid }: EditRequestContentProps) => {
  const data = useLazyLoadQuery<RequestUuidQueryType>(RequestUuidQuery, {
    uuid,
  });
  const request = data.request;
  const [commitUpdateRequest] = useMutation<UpdateRequestMutationType>(
    UpdateRequestMutation
  );
  const { showAlert } = useAlertStore();

  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

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
          products: [],
        },
      },
      onCompleted: (response) => {
        if (response.updateRequest?.success) {
          showAlert(response.updateRequest.message, "success");
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
  };

  const filters = { tenantId: request.tenantId };
  const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];

  return (
    <>
      <CatalogsProvider
        clients={true}
        clientsFilters={filters}
        retailers={true}
        retailersFilters={filters}
        distributors={true}
        distributorsFilters={filters}
        requestTypes={true}
        requestTypesFilters={filters}
      >
        {(catalogs) => (
          <RequestForm
            onSubmit={handleSubmit}
            mode="edit"
            defaultValues={defaultValues}
            clients={catalogs.clients}
            retailers={catalogs.retailers}
            distributors={catalogs.distributors}
            requestTypes={catalogs.requestTypes}
            timezones={timezones}
          />
        )}
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
