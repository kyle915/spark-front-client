import { Suspense, useEffect, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import Loading from "@/shared/Loading";
import CatalogsProvider from "@/shared/CatalogsProvider";
import EventForm from "./components/EventForm";
import type { EventFormValues } from "../types/events/formTypes";
import { useMutation } from "react-relay/hooks";
import { CreateEventMutation } from "@api/mutations/CreateEventMutation";
import type { CreateEventMutation as CreateEventMutationType } from "@api/mutations/__generated__/CreateEventMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import { useNavigate } from "react-router";
import { fetchQuery } from "react-relay";
import { LocationsQuery } from "@/api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@/api/queries/__generated__/LocationsQuery.graphql";
import environment from "@/api/relay/environment";
import { useAuthStore } from "@/store/authStore";

const CreateEventWithoutRequestContent = () => {
  const { tenantId } = useAuthStore();
  //   const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationsError, setLocationsError] = useState<Error | null>(null);
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreateEvent] =
    useMutation<CreateEventMutationType>(CreateEventMutation);

  useEffect(() => {
    if (!tenantId) {
      setLocations([]);
      setLocationsError(null);
      return;
    }

    setLoadingLocations(true);
    setLocationsError(null);

    const subscription = fetchQuery<LocationsQueryType>(
      environment,
      LocationsQuery,
      { filters: { tenantId: tenantId } },
      { fetchPolicy: "network-only" }
    ).subscribe({
      next: (data) => {
        const parsed =
          data.locations?.edges?.flatMap((edge) =>
            edge?.node ? [edge.node] : []
          ) ?? [];
        setLocations(parsed);
      },
      error: (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setLocationsError(error);
        setLocations([]);
        setLoadingLocations(false);
      },
      complete: () => setLoadingLocations(false),
    });

    return () => subscription.unsubscribe();
  }, [tenantId]);

  const handleSubmit = (formData: EventFormValues) => {
    if (
      !formData.eventTypeId ||
      !formData.startTime ||
      !formData.endTime ||
      !formData.date
    ) {
      showAlert("Missing required fields for event creation", "error");
      return;
    }

    if (!tenantId) {
      showAlert("Please select a tenant first.", "error");
      return;
    }

    const startTimeWithDate = formData.date
      ? `${formData.date} ${formData.startTime}`
      : formData.startTime;
    const endTimeWithDate = formData.date
      ? `${formData.date} ${formData.endTime}`
      : formData.endTime;

    const input: Record<string, unknown> = {
      name: formData.name,
      eventTypeId: formData.eventTypeId,
      address: formData.address,
      notes: formData.notes ?? "",
      isNational: formData.isNational ?? false,
      startTime: startTimeWithDate,
      endTime: endTimeWithDate,
      tenantId: tenantId,
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
            "error"
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
      date: "",
      notes: "",
      isNational: false,
      coordinates: undefined,
    }),
    [tenantId]
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
              <div className="max-w-xl">
                {/* <label className="label pb-1">
                  <span className="label-text">Tenant</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={tenantId ?? ""}
                  onChange={(e) => setSelectedTenantId(e.target.value || null)}
                >
                  <option value="" disabled>
                    Select tenant
                  </option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select> */}
              </div>

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
                        {locationsError && (
                          <div className="alert alert-warning">
                            <span>
                              Unable to load locations: {locationsError.message}
                            </span>
                          </div>
                        )}
                        {loadingLocations && <Loading />}

                        <EventForm
                          mode="create"
                          eventTypes={eventTypes}
                          tenantId={tenantId}
                          distributors={distributors}
                          retailers={retailers}
                          requestStoreManagers={requestStoreManagers}
                          onSubmit={handleSubmit}
                          locations={locations}
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
