import { Suspense, useMemo } from "react";
import Layout from "@/layout/Layout";
import Loading from "@/shared/Loading";
import CatalogsProvider from "@/shared/CatalogsProvider";
import EventForm from "./components/EventForm";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { StatesQuery as StatesQueryType } from "@api/queries/__generated__/StatesQuery.graphql";
import { StatesQuery } from "@api/queries/StatesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import { RetailersQuery } from "@/api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@api/queries/__generated__/RetailersQuery.graphql";
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

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CreateEventWithoutRequestContent = () => {
  const { tenantId, tenantSlug, user } = useAuthStore();
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

  const retailersData = useLazyLoadQuery<RetailersQueryType>(
    RetailersQuery,
    {
      filters: { tenantId: tenantId ?? "" },
      first: 500,
    },
    { fetchPolicy: "store-and-network" },
  );

  const states = useMemo(
    () => statesData.states?.edges.map((e) => e.node) ?? [],
    [statesData.states?.edges],
  );
  const isJeeterTenant = tenantSlug?.toLowerCase() === "jeeter";
  const californiaState = useMemo(
    () =>
      states.find(
        (state) =>
          state.name?.toLowerCase() === "california" ||
          state.code?.toLowerCase() === "ca",
      ) ?? null,
    [states],
  );
  const allowedStates = useMemo(() => {
    if (!isJeeterTenant) return states;
    return californiaState ? [californiaState] : [];
  }, [isJeeterTenant, states, californiaState]);

  const timezones = timezonesData.timezones?.edges.map((e) => e.node) || [];
  const retailersById = useMemo(
    () =>
      new Map(
        (retailersData.retailers?.edges ?? []).map((edge) => [
          edge.node.id,
          edge.node.name,
        ]),
      ),
    [retailersData.retailers?.edges],
  );
  const retailerIdByName = useMemo(
    () =>
      new Map(
        (retailersData.retailers?.edges ?? [])
          .map((edge) => [edge.node.name.trim().toLowerCase(), edge.node.id] as const),
      ),
    [retailersData.retailers?.edges],
  );

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
    const dateForName = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ? `${dateValue.slice(5, 7)}/${dateValue.slice(8, 10)}/${dateValue.slice(0, 4)}`
      : dateValue;
    const selectedRetailerId =
      formData.retailerId?.toString().trim() ||
      (formData.retailerName
        ? (retailerIdByName.get(formData.retailerName.trim().toLowerCase()) ?? "")
        : "") ||
      null;
    const selectedRetailerName =
      (selectedRetailerId ? retailersById.get(selectedRetailerId) : null) ??
      formData.retailerName?.trim() ??
      "";
    const sanitizedBaseName = selectedRetailerName
      ? (formData.name ?? "").trim().replace(
          new RegExp(
            `\\s-\\s${escapeRegExp(selectedRetailerName)}(?:\\s-\\s\\d{2}\\/\\d{2}\\/\\d{4})?$`,
            "i",
          ),
          "",
        ).trim()
      : (formData.name ?? "").trim();
    const eventName = [
      sanitizedBaseName || formData.name?.trim(),
      selectedRetailerName.trim(),
      dateForName,
    ]
      .filter(Boolean)
      .join(" - ");
    const normalizedDate = dateValue
      ? buildDateTimeWithOffset(dateValue, "00:00", offsetMinutes)
      : "";

    const input: Record<string, unknown> = {
      name: eventName || formData.name,
      eventTypeId: formData.eventTypeId,
      address: formData.address,
      notes: formData.notes ?? "",
      isNational: formData.isNational ?? false,
      timezoneId: formData.timezoneId ?? null,
      rmmAsignedId: formData.rmmAsignedId,
      distributorId: isJeeterTenant ? null : (formData.distributorId ?? null),
      retailerId: selectedRetailerId,
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
      stateId: isJeeterTenant ? californiaState?.id ?? null : null,
      distributorId: isJeeterTenant ? null : undefined,
    }),
    [tenantId, isJeeterTenant, californiaState],
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
                states={allowedStates}
                defaultValues={defaultValues}
                disableStateSelect={isJeeterTenant}
                hideDistributorFields={isJeeterTenant}
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
