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
          clientId: formData.clientId ?? "",
          retailerId: formData.retailerId ?? "",
          distributorId: formData.distributorId ?? "",
          requestTypeId: formData.requestTypeId ?? "",
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
    startTime: request.startTime,
    endTime: request.endTime,
    address: request.address,
    coordinates: request.coordinates as number[] | null | undefined,
    clientId: request.client?.id,
    retailerId: request.retailer?.id,
    distributorId: request.distributor?.id,
    requestTypeId: request.requestType?.id,
  };

  const filters = { tenantId: request.tenantId };

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">Edit Request</h1>
        <p className="text-base-content/70">Request: {request.name}</p>
      </div>
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
            defaultValues={defaultValues}
            clients={catalogs.clients}
            retailers={catalogs.retailers}
            distributors={catalogs.distributors}
            requestTypes={catalogs.requestTypes}
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
