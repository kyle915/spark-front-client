import { Suspense, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";

import Layout from "@/layout/Layout";
import Loading from "@shared/Loading";
import CatalogsProvider from "@shared/CatalogsProvider";
import EventForm from "./components/EventForm";

import { useAlertStore } from "@store/alertStore";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";

import { RequestUuidQuery } from "@api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@api/queries/__generated__/RequestUuidQuery.graphql";

// import { LocationsQuery } from "@api/queries/LocationsQuery";
// import type { LocationsQuery as LocationsQueryType } from "@api/queries/__generated__/LocationsQuery.graphql";

import { CreateEventMutation } from "@api/mutations/CreateEventMutation";
import type { CreateEventMutation as CreateEventMutationType } from "@api/mutations/__generated__/CreateEventMutation.graphql";

import { ApproveRequestMutation } from "@api/mutations/ApproveRequestMutation";
import type { ApproveRequestMutation as ApproveRequestMutationType } from "@api/mutations/__generated__/ApproveRequestMutation.graphql";

import { UpdateRequestMutation } from "@api/mutations/UpdateRequestMutation";
import type { UpdateRequestMutation as UpdateRequestMutationType } from "@api/mutations/__generated__/UpdateRequestMutation.graphql";

import type { EventFormValues } from "../types/events/formTypes";
import { normalizeDateTime, dateFormat } from "@/public/form/utils/toDate";

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

  // ========================
  // QUERIES
  // ========================
  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const timeZones = timezonesData.timezones.edges.map((e) => e.node);

  // const locationsData = useLazyLoadQuery<LocationsQueryType>(LocationsQuery, {
  //   filters: { tenantId: request.tenantId },
  // });

  // const locations = locationsData.locations.edges.map((e) => e.node);

  // ========================
  // MUTATIONS
  // ========================
  const [commitCreateEvent] =
    useMutation<CreateEventMutationType>(CreateEventMutation);

  const [commitApproveRequest] = useMutation<ApproveRequestMutationType>(
    ApproveRequestMutation
  );

  const [commitUpdateRequest] = useMutation<UpdateRequestMutationType>(
    UpdateRequestMutation
  );

  const eventTypeFilters = useMemo(
    () => ({ tenantId: request.tenantId }),
    [request.tenantId]
  );

  // const getLegacyField = useMemo(
  //   () => (field: string) => {
  //     const value = (request as Record<string, unknown>)[field];
  //     return typeof value === "string" ? value : null;
  //   },
  //   [request]
  // );

  // const requestContactInfo = useMemo(
  //   () => ({
  //     distributorName:
  //       getLegacyField("distributorName") ?? request.distributor?.name ?? null,
  //     distributorEmail:
  //       getLegacyField("distributorEmail") ??
  //       request.distributor?.email ??
  //       null,
  //     retailerName:
  //       getLegacyField("retailerName") ?? request.retailer?.name ?? null,
  //     retailerAddress:
  //       getLegacyField("retailerAddress") ?? request.retailer?.address ?? null,
  //     retailerStoreContact:
  //       getLegacyField("retailerStoreContact") ??
  //       request.retailer?.storeContact ??
  //       null,
  //     storeManagerName: getLegacyField("storeManagerName") ?? null,
  //     storeManagerPhone: getLegacyField("storeManagerPhone") ?? null,
  //   }),
  //   [request, getLegacyField]
  // );

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
          date: dateFormat(data.date),
          eventTypeId: data.eventTypeId,
          requestId: request.id,
          address: data.address,
          notes: data.notes ?? "",
          isNational: data.isNational ?? false,
          startTime: normalizeDateTime(data.date ?? "", data.startTime) ?? "",
          endTime: normalizeDateTime(data.date ?? "", data.endTime) ?? "",
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
          address: data.address ?? request.address,
          coordinates: data.coordinates ?? request.coordinates ?? [],
          date: data.date ?? dateFormat(data.date ?? "") ?? request.date,
          name: data.name ?? request.name,
          startTime: normalizeDateTime(data.date ?? "", data.startTime) ?? "",
          endTime: normalizeDateTime(data.date ?? "", data.endTime) ?? "",
          timezoneId: data.timezoneId ?? request.timezone.id,
          requestTypeId: request.requestType.id,
          distributorId: request.distributor?.id ?? "",
          retailerId: request.retailer?.id ?? "",
          storeManagerName: request.storeManagerName ?? "",
          storeManagerPhone: request.storeManagerPhone ?? "",
          // details: // faltan en el request.
          // products: [] // faltan en el request.
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
    tenant: request.tenantId,
    eventTypeId: request.requestType?.id ?? "",
    date: request.date ?? "",
    startTime: request.startTime ?? undefined,
    endTime: request.endTime ?? undefined,
    notes: "",
    coordinates: request.coordinates.map((coord) => coord) ?? undefined,
    isNational: false,
    timezoneId: request.timezone?.id ?? null,
    // distributorId: request.distributor?.id,
    // retailerId: request.retailer?.id,
    // storeManagerName:
    //   requestContactInfo.storeManagerName ??
    //   requestContactInfo.retailerStoreContact ??
    //   undefined,
    // storeManagerPhone: requestContactInfo.storeManagerPhone ?? undefined,
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
        // distributors,
        // retailers,
        // requestStoreManagers,
        loading,
        errors,
        // refetch,
      }) => {
        if (Object.values(loading).some(Boolean)) return <Loading />;
        if (Object.values(errors).some(Boolean))
          return <div className="alert alert-error">Catalog error</div>;

        return (
          <EventForm
            mode="create"
            eventTypes={eventTypes}
            tenantId={request.tenantId}
            // requestId={request.id}
            // distributors={distributors}
            timezones={timeZones}
            // retailers={retailers}
            // requestStoreManagers={requestStoreManagers}
            // requestContactInfo={requestContactInfo}
            // locations={locations}
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            // onRefetch={refetch}
          />
        );
      }}
    </CatalogsProvider>
  );
};

export default CreateEventPage;
