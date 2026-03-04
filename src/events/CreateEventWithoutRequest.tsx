import { Suspense, useMemo } from "react";
import Layout from "@/layout/Layout";
import Loading from "@/shared/Loading";
import CatalogsProvider from "@/shared/CatalogsProvider";
import EventForm from "./components/EventForm";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { StatesQuery as StatesQueryType } from "@api/queries/__generated__/StatesQuery.graphql";
import { StatesQuery } from "@api/queries/StatesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import type { EventFormValues } from "../types/events/formTypes";
import { useMutation, useLazyLoadQuery } from "react-relay/hooks";
import { CreateEventMutation } from "@api/mutations/CreateEventMutation";
import type { CreateEventMutation as CreateEventMutationType } from "@api/mutations/__generated__/CreateEventMutation.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";

import { useAlertStore } from "@store/alertStore";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { dateFormat } from "@/public/form/utils/toDate";
import { buildDateTimeWithOffset } from "@/utils";

const CreateEventWithoutRequestContent = () => {
  const { tenantId, user } = useAuthStore();
  //   const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreateEvent] =
    useMutation<CreateEventMutationType>(CreateEventMutation);

  const rmmClientsData = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId: tenantId ?? "" },
    { fetchPolicy: "store-and-network" },
  );

  const rmmClients = rmmClientsData.rmmClients?.map((c) => c) || [];

  const statesData = useLazyLoadQuery<StatesQueryType>(
    StatesQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );

  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );

  const states = statesData.states?.edges.map((e) => e.node) || [];

  const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];

  const handleSubmit = (formData: EventFormValues) => {
    if (
      !formData.eventTypeId ||
      !formData.startTime ||
      !formData.endTime ||
      !formData.date ||
      !formData.timezoneId
    ) {
      showAlert("Missing required fields for event creation", "error");
      return;
    }

    if (!tenantId) {
      showAlert("Please select a tenant first.", "error");
      return;
    }

    const timezone =
      timezones.find((tz) => tz.id === formData.timezoneId) ?? null;
    const offsetMinutes = timezone?.offset ?? null;
    const dateValue = dateFormat(formData.date);
    const normalizedDate = dateValue
      ? buildDateTimeWithOffset(dateValue, "00:00", offsetMinutes)
      : "";

    const input: Record<string, unknown> = {
      name: formData.name,
      eventTypeId: formData.eventTypeId,
      address: formData.address,
      notes: formData.notes ?? "",
      isNational: formData.isNational ?? false,
      timezoneId: formData.timezoneId ?? null,
      rmmAsignedId: formData.rmmAsignedId,
      startTime:
        dateValue && formData.startTime
          ? buildDateTimeWithOffset(
              dateValue,
              formData.startTime,
              offsetMinutes,
            )
          : "",
      endTime:
        dateValue && formData.endTime
          ? buildDateTimeWithOffset(dateValue, formData.endTime, offsetMinutes)
          : "",
      tenantId: tenantId,
      date: normalizedDate,
    };

    if (formData.coordinates && formData.coordinates.length === 2) {
      input.coordinates = formData.coordinates;
    }

    if (formData.requestId) {
      input.requestId = formData.requestId;
    }

    commitCreateEvent({
      variables: {
        input: input as CreateEventMutationType["variables"]["input"],
      },
      onCompleted: (response) => {
        const createdEventUuid = response.createEvent?.event?.uuid;

        if (response.createEvent?.success) {
          showAlert(response.createEvent.message, "success");
          if (createdEventUuid) {
            navigate(`/event/view/${createdEventUuid}`);
          }
        } else {
          showAlert(
            response.createEvent?.message ?? "Error creating event",
            "error",
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating event: ${error.message}`, "error");
      },
    });
  };

  const defaultValues: Partial<EventFormValues> = useMemo(
    () => ({
      tenantId: tenantId ?? undefined,
      requestId: null,
      timezoneId: null,
      date: "",
      notes: "",
      isNational: false,
      isNationalRetailer: true,
      coordinates: undefined,
    }),
    [tenantId],
  );

  return (
    <div className="flex flex-col gap-6">
      <CatalogsProvider
        eventTypes
        eventTypesFilters={{ tenantId: tenantId }}
        requestStoreManagers
        requestStoreManagersFilters={{ tenantId: tenantId }}
      >
        {({
          eventTypes,
          requestStoreManagers,
          loading: catalogLoading,
          errors: catalogErrors,
          refetch,
        }) => {
          if (
            catalogLoading.eventTypes ||
            catalogLoading.distributors ||
            catalogLoading.retailers ||
            catalogLoading.requestStoreManagers
          ) {
            return <Loading />;
          }

          if (
            catalogErrors.eventTypes ||
            catalogErrors.distributors ||
            catalogErrors.retailers ||
            catalogErrors.requestStoreManagers
          ) {
            return (
              <div className="alert alert-error">
                <span>
                  Unable to load catalogs for this tenant. Please try again.
                </span>
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-4">
              <EventForm
                mode="create"
                eventTypes={eventTypes}
                tenantId={tenantId ?? ""}
                timezones={timezones}
                rmmClients={rmmClients}
                userIdLoggin={user?.id ?? ""}
                userUuidLoggin={user?.uuid ?? ""}
                requestStoreManagers={requestStoreManagers}
                onSubmit={handleSubmit}
                states={states}
                defaultValues={defaultValues}
                enableContactSection
                contactMode="manual"
                showIsNational={false}
                onRefetch={refetch}
                showRequestField={true}
                showAssociateRequestToggle={true}
              />
            </div>
          );
        }}
      </CatalogsProvider>
    </div>
  );
};

const CreateEventWithoutRequest = () => (
  <Layout>
    <Suspense fallback={<Loading />}>
      <CreateEventWithoutRequestContent />
    </Suspense>
  </Layout>
);

export default CreateEventWithoutRequest;
