import { Suspense, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";

import Layout from "@/layout/Layout";
import Loading from "@shared/Loading";
import CatalogsProvider from "@shared/CatalogsProvider";
import EventForm from "./components/EventForm";

import { useAlertStore } from "@store/alertStore";

import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";

import { LocationsQuery } from "@api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@api/queries/__generated__/LocationsQuery.graphql";

import { CreateEventMutation } from "@api/mutations/CreateEventMutation";
import type { CreateEventMutation as CreateEventMutationType } from "@api/mutations/__generated__/CreateEventMutation.graphql";

import { ApproveRequestMutation } from "@api/mutations/ApproveRequestMutation";
import type { ApproveRequestMutation as ApproveRequestMutationType } from "@api/mutations/__generated__/ApproveRequestMutation.graphql";

import { UpdateRequestMutation } from "@api/mutations/UpdateRequestMutation";
import type { UpdateRequestMutation as UpdateRequestMutationType } from "@api/mutations/__generated__/UpdateRequestMutation.graphql";

import type { EventFormValues } from "../types/events/formTypes";

/* ================= Page ================= */
const CreateEventPage = () => {
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
        <CreateEventContent uuid={uuid} />
      </Suspense>
    </Layout>
  );
};

/* ================= Content only load ================= */
const CreateEventContent = ({ uuid }: { uuid: string }) => {
  const data = useLazyLoadQuery<RequestUuidQueryType>(RequestUuidQuery, {
    uuid,
  });

  if (!data.request) {
    return (
      <div className="alert alert-warning">
        <span>The specified request was not found.</span>
      </div>
    );
  }

  return <CreateEventForm request={data.request} />;
};

/* ================= Form ================= */
type FormProps = {
  request: NonNullable<RequestUuidQueryType["response"]["request"]>;
};

const CreateEventForm = ({ request }: FormProps) => {
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();

  const [commitCreateEvent] =
    useMutation<CreateEventMutationType>(CreateEventMutation);

  const [commitApproveRequest] = useMutation<ApproveRequestMutationType>(
    ApproveRequestMutation
  );

  const [commitUpdateRequest] = useMutation<UpdateRequestMutationType>(
    UpdateRequestMutation
  );

  const locationsData = useLazyLoadQuery<LocationsQueryType>(LocationsQuery, {
    filters: { tenantId: request.tenantId },
  });

  const locations = locationsData.locations.edges.map((e) => e.node);

  const eventTypeFilters = useMemo(
    () => ({ tenantId: request.tenantId }),
    [request.tenantId]
  );

  const getLegacyField = useMemo(
    () => (field: string) => {
      const value = (request as Record<string, unknown>)[field];
      return typeof value === "string" ? value : null;
    },
    [request]
  );

  const requestContactInfo = useMemo(
    () => ({
      distributorName:
        getLegacyField("distributorName") ?? request.distributor?.name ?? null,
      distributorEmail:
        getLegacyField("distributorEmail") ??
        request.distributor?.email ??
        null,
      retailerName:
        getLegacyField("retailerName") ?? request.retailer?.name ?? null,
      retailerAddress:
        getLegacyField("retailerAddress") ?? request.retailer?.address ?? null,
      retailerStoreContact:
        getLegacyField("retailerStoreContact") ??
        request.retailer?.storeContact ??
        null,
      storeManagerName: getLegacyField("storeManagerName") ?? null,
      storeManagerPhone: getLegacyField("storeManagerPhone") ?? null,
    }),
    [request, getLegacyField]
  );

  const shouldUpdateRequest = (data: EventFormValues) => {
    return (
      data.distributorId !== request.distributor?.id ||
      data.retailerId !== request.retailer?.id ||
      Boolean(data.storeManagerName || data.storeManagerPhone)
    );
  };

  /* ================= Mutation ================= */
  const runCreateEvent = (data: EventFormValues) => {
    if (!data.eventTypeId || !data.startTime || !data.endTime || !data.date) {
      showAlert("Missing required fields", "error");
      return;
    }

    commitCreateEvent({
      variables: {
        input: {
          name: data.name,
          eventTypeId: data.eventTypeId,
          requestId: request.id,
          address: data.address,
          notes: data.notes ?? "",
          isNational: data.isNational ?? false,
          startTime: `${data.date} ${data.startTime}`,
          endTime: `${data.date} ${data.endTime}`,
          coordinates: data.coordinates ?? request.coordinates ?? undefined,
          tenantId: request.tenantId,
        },
      },
      onCompleted: ({ createEvent }) => {
        if (!createEvent?.success) {
          showAlert(createEvent?.message ?? "Error creating event", "error");
          return;
        }

        commitApproveRequest({
          variables: { input: { id: request.id } },
          onCompleted: ({ approveRequest }) => {
            if (approveRequest?.success) {
              navigate(`/event/view/${createEvent.event?.uuid}`);
            } else {
              showAlert(
                approveRequest?.message ?? "Error approving request",
                "error"
              );
            }
          },
        });
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  /* ================= Submit ================= */
  const handleSubmit = (data: EventFormValues) => {
    if (!shouldUpdateRequest(data)) {
      runCreateEvent(data);
      return;
    }

    if (!request.timezone?.id || !request.requestType?.id) {
      showAlert("Request missing required data", "error");
      return;
    }

    commitUpdateRequest({
      variables: {
        input: {
          id: request.id,
          name: request.name ?? data.name,
          date: request.date ?? data.date ?? "",
          startTime: request.startTime ?? data.startTime ?? "00:00",
          endTime: request.endTime ?? data.endTime ?? "00:00",
          address: request.address ?? data.address,
          coordinates: data.coordinates ?? request.coordinates ?? [],
          timezoneId: request.timezone.id,
          requestTypeId: request.requestType.id,
          distributorId: data.distributorId ?? "",
          retailerId: data.retailerId ?? "",
          storeManagerName:
            data.storeManagerName ?? requestContactInfo.storeManagerName ?? "",
          storeManagerPhone:
            data.storeManagerPhone ??
            requestContactInfo.storeManagerPhone ??
            "",
          details: [],
          products: [],
        },
      },
      onCompleted: ({ updateRequest }) => {
        if (updateRequest?.success) runCreateEvent(data);
        else showAlert(updateRequest?.message ?? "Update failed", "error");
      },
    });
  };

  /* ================= Default Values ================= */
  const defaultValues: Partial<EventFormValues> = {
    name: request.name ?? "",
    address: request.address ?? "",
    date: request.date ?? "",
    startTime: request.startTime ?? undefined,
    endTime: request.endTime ?? undefined,
    coordinates: request.coordinates.map((coord) => coord) ?? undefined,
    distributorId: request.distributor?.id,
    retailerId: request.retailer?.id,
    storeManagerName:
      requestContactInfo.storeManagerName ??
      requestContactInfo.retailerStoreContact ??
      undefined,
    storeManagerPhone: requestContactInfo.storeManagerPhone ?? undefined,
    notes: "",
    isNational: false,
  };

  return (
    <CatalogsProvider
      eventTypes
      eventTypesFilters={eventTypeFilters}
      distributors
      distributorsFilters={eventTypeFilters}
      retailers
      retailersFilters={eventTypeFilters}
      requestStoreManagers
      requestStoreManagersFilters={{ tenantId: request.tenantId }}
    >
      {({
        eventTypes,
        distributors,
        retailers,
        requestStoreManagers,
        loading,
        errors,
        refetch,
      }) => {
        if (Object.values(loading).some(Boolean)) return <Loading />;
        if (Object.values(errors).some(Boolean))
          return <div className="alert alert-error">Catalog error</div>;

        return (
          <EventForm
            mode="create"
            eventTypes={eventTypes}
            tenantId={request.tenantId}
            requestId={request.id}
            distributors={distributors}
            retailers={retailers}
            requestStoreManagers={requestStoreManagers}
            requestContactInfo={requestContactInfo}
            locations={locations}
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            onRefetch={refetch}
          />
        );
      }}
    </CatalogsProvider>
  );
};

export default CreateEventPage;
