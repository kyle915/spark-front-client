import { Suspense, useEffect, useMemo, useState } from "react";
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
import { useAlertStore } from "@store/alertStore";
import { useNavigate } from "react-router";
import { fetchQuery } from "react-relay";
import environment from "@/api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import { dateFormat } from "@/public/form/utils/toDate";
import { buildDateTimeWithOffset } from "@/utils";

const CreateEventWithoutRequestContent = () => {
  const { tenantId } = useAuthStore();
  //   const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const [timezones, setTimezones] = useState<
    Array<{ id: string; name: string; code: string; offset: number }>
  >([]);
  const [loadingTimezones, setLoadingTimezones] = useState(false);
  const [timezonesError, setTimezonesError] = useState<Error | null>(null);
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreateEvent] =
    useMutation<CreateEventMutationType>(CreateEventMutation);

  const statesData = useLazyLoadQuery<StatesQueryType>(
    StatesQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );

  const states = statesData.states?.edges.map((e) => e.node) || [];

  useEffect(() => {
    if (!tenantId) {
      setTimezones([]);
      setTimezonesError(null);
      return;
    }

    setLoadingTimezones(true);
    setTimezonesError(null);

    const tzSubscription = fetchQuery<TimezonesQueryType>(
      environment,
      TimezonesQuery,
      {},
      { fetchPolicy: "network-only" },
    ).subscribe({
      next: (data) => {
        const parsed =
          data.timezones?.edges?.flatMap((edge) =>
            edge?.node ? [edge.node] : [],
          ) ?? [];
        setTimezones(parsed);
      },
      error: (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setTimezonesError(error);
        setTimezones([]);
        setLoadingTimezones(false);
      },
      complete: () => setLoadingTimezones(false),
    });

    return () => {
      tzSubscription.unsubscribe();
    };
  }, [tenantId]);

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
      coordinates: undefined,
    }),
    [tenantId],
  );

  return (
    <div className="flex flex-col gap-6">
      <CatalogsProvider tenants>
        {({ loading, errors }) => {
          if (loading.tenants) {
            return <Loading />;
          }

          if (errors.tenants) {
            return (
              <div className="alert alert-error">
                <span>Unable to load tenants. Please try again.</span>
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-4">
              <div className="max-w-xl"></div>

              {tenantId ? (
                <CatalogsProvider
                  eventTypes
                  eventTypesFilters={{ tenantId: tenantId }}
                  distributors
                  distributorsFilters={{ tenantId: tenantId }}
                  retailers
                  retailersFilters={{ tenantId: tenantId }}
                  requestStoreManagers
                  requestStoreManagersFilters={{ tenantId: tenantId }}
                >
                  {({
                    eventTypes,
                    distributors,
                    retailers,
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
                            Unable to load catalogs for this tenant. Please try
                            again.
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col gap-4">
                        {timezonesError && (
                          <div className="alert alert-warning">
                            <span>
                              Unable to load timezones: {timezonesError.message}
                            </span>
                          </div>
                        )}
                        {loadingTimezones && <Loading />}

                        <EventForm
                          mode="create"
                          eventTypes={eventTypes}
                          tenantId={tenantId}
                          distributors={distributors}
                          retailers={retailers}
                          timezones={timezones}
                          requestStoreManagers={requestStoreManagers}
                          onSubmit={handleSubmit}
                          states={states}
                          defaultValues={defaultValues}
                          enableContactSection
                          contactMode="manual"
                          onRefetch={refetch}
                        />
                      </div>
                    );
                  }}
                </CatalogsProvider>
              ) : (
                <div className="alert alert-info max-w-xl">
                  <span>Select a tenant to load event data.</span>
                </div>
              )}
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
