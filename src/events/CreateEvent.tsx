import { Suspense, useMemo } from "react";
import Layout from "@/layout/Layout";
import { useParams } from "react-router";
import Loading from "@shared/Loading";
import CatalogsProvider from "@/shared/CatalogsProvider";
import EventForm from "./components/EventForm";
import type { EventFormValues } from "../types/events/formTypes";
import { RequestUuidQuery } from "@/api/queries/RequestUuidQuery";
import type { RequestUuidQuery as RequestUuidQueryType } from "@/api/queries/__generated__/RequestUuidQuery.graphql";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { CreateEventMutation } from "@/api/mutations/CreateEventMutation";
import type { CreateEventMutation as CreateEventMutationType } from "@/api/mutations/__generated__/CreateEventMutation.graphql";
import { ApproveRequestMutation } from "@/api/mutations/ApproveRequestMutation";
import type { ApproveRequestMutation as ApproveRequestMutationType } from "@/api/mutations/__generated__/ApproveRequestMutation.graphql";
import { UpdateRequestMutation } from "@/api/mutations/UpdateRequestMutation";
import type { UpdateRequestMutation as UpdateRequestMutationType } from "@/api/mutations/__generated__/UpdateRequestMutation.graphql";
import { LocationsQuery } from "@/api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@/api/queries/__generated__/LocationsQuery.graphql";
import { useAlertStore } from "@/store/alertStore";
import { useNavigate } from "react-router";

type CreateEventContentProps = {
  uuid: string;
};

const CreateEventContent = ({ uuid }: CreateEventContentProps) => {
  const data = useLazyLoadQuery<RequestUuidQueryType>(RequestUuidQuery, {
    uuid,
  });
  const request = data.request;

  const locationsData = useLazyLoadQuery<LocationsQueryType>(LocationsQuery, {
    filters: { tenantId: request?.tenantId },
  });
  const locations = locationsData.locations.edges.map((e) => e.node);

  const navigate = useNavigate();
  const [commitCreateEvent] =
    useMutation<CreateEventMutationType>(CreateEventMutation);
  const [commitApproveRequest] = useMutation<ApproveRequestMutationType>(
    ApproveRequestMutation
  );
  const [commitUpdateRequest] = useMutation<UpdateRequestMutationType>(
    UpdateRequestMutation
  );
  const { showAlert } = useAlertStore();

  const eventTypeFilters = useMemo(
    () => (request?.tenantId ? { tenantId: request.tenantId } : undefined),
    [request?.tenantId]
  );

  if (!request) {
    return (
      <div className="alert alert-warning">
        <span>The specified request was not found.</span>
      </div>
    );
  }

  const getLegacyField = (fieldName: string) => {
    const value = (request as Record<string, unknown> | null | undefined)?.[
      fieldName
    ];
    return typeof value === "string" ? value : null;
  };
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
      storeManagerId: null,
      storeManagerName: getLegacyField("storeManagerName") ?? null,
      storeManagerPhone: getLegacyField("storeManagerPhone") ?? null,
    }),
    [request]
  );

  const shouldUpdateRequest = (formData: EventFormValues) => {
    const desiredDistributorId = formData.distributorId ?? null;
    const desiredRetailerId = formData.retailerId ?? null;
    const hasStoreManagerData = Boolean(
      formData.storeManagerName || formData.storeManagerPhone
    );

    return (
      (!!desiredDistributorId &&
        desiredDistributorId !== request.distributor?.id) ||
      (!!desiredRetailerId && desiredRetailerId !== request.retailer?.id) ||
      (!request.distributor?.id && !!desiredDistributorId) ||
      (!request.retailer?.id && !!desiredRetailerId) ||
      hasStoreManagerData
    );
  };

  const runCreateEvent = (formData: EventFormValues) => {
    if (!formData.eventTypeId || !formData.startTime || !formData.endTime) {
      showAlert("Missing required fields for event creation", "error");
      return;
    }

    commitCreateEvent({
      variables: {
        input: {
          name: formData.name,
          eventTypeId: formData.eventTypeId,
          requestId: request.id,
          address: formData.address,
          notes: formData.notes ?? "",
          isNational: formData.isNational ?? false,
          startTime: formData.startTime,
          endTime: formData.endTime,
          tenantId: request.tenantId,
        },
      },
      onCompleted: (response) => {
        const createEventResponse = response.createEvent;
        const createdEventUuid = createEventResponse?.event?.uuid;

        if (createEventResponse?.success) {
          showAlert(createEventResponse.message, "success");

          commitApproveRequest({
            variables: {
              input: {
                id: request.id,
              },
            },
            onCompleted: (approveResponse) => {
              const approveRequestResponse = approveResponse.approveRequest;
              if (approveRequestResponse?.success) {
                showAlert(approveRequestResponse.message, "success");
                if (createdEventUuid) {
                  navigate(`/event/view/${createdEventUuid}`);
                } else {
                  showAlert("Event created but UUID not available", "error");
                }
              } else {
                showAlert(
                  approveRequestResponse?.message ?? "Error approving request",
                  "error"
                );
              }
            },
            onError: (error) => {
              showAlert(`Error approving request: ${error.message}`, "error");
            },
          });
        } else {
          showAlert(
            createEventResponse?.message ?? "Error creating event",
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating event: ${error.message}`, "error");
      },
    });
  };

  const handleSubmit = (formData: EventFormValues) => {
    if (!formData.eventTypeId || !formData.startTime || !formData.endTime) {
      showAlert("Missing required fields for event creation", "error");
      return;
    }

    if (shouldUpdateRequest(formData)) {
      if (!request.timezone?.id || !request.requestType?.id) {
        showAlert(
          "Request is missing required data to update contacts.",
          "error"
        );
        return;
      }

      commitUpdateRequest({
        variables: {
          input: {
            id: request.id,
            name: request.name ?? formData.name,
            date: request.date ?? "",
            startTime: request.startTime ?? "00:00",
            endTime: request.endTime ?? "00:00",
            address: request.address ?? formData.address,
            coordinates: (request.coordinates ?? []) as readonly number[],
            timezoneId: request.timezone.id,
            requestTypeId: request.requestType.id,
            distributorId:
              formData.distributorId ?? request.distributor?.id ?? "",
            retailerId: formData.retailerId ?? request.retailer?.id ?? "",
            storeManagerName:
              formData.storeManagerName ??
              requestContactInfo.storeManagerName ??
              requestContactInfo.retailerStoreContact ??
              "",
            storeManagerPhone:
              formData.storeManagerPhone ??
              requestContactInfo.storeManagerPhone ??
              "",
            details: [],
            products: [],
          },
        },
        onCompleted: (response) => {
          if (response.updateRequest?.success) {
            runCreateEvent(formData);
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

      return;
    }

    runCreateEvent(formData);
  };

  const baseDefaultValues: Partial<EventFormValues> = {
    name: request.name ?? "",
    address: request.address ?? "",
    startTime: request.startTime ?? undefined,
    endTime: request.endTime ?? undefined,
    distributorId: request.distributor?.id ?? undefined,
    retailerId: request.retailer?.id ?? undefined,
    storeManagerName:
      requestContactInfo.storeManagerName ??
      requestContactInfo.retailerStoreContact ??
      undefined,
    storeManagerPhone: requestContactInfo.storeManagerPhone ?? undefined,
    notes: "",
    isNational: false,
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Create event</h1>
        <p className="text-base-content/70">Request: {request.name}</p>
      </div>
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
          if (
            loading.eventTypes ||
            loading.distributors ||
            loading.retailers ||
            loading.requestStoreManagers
          ) {
            return <Loading />;
          }

          if (errors.eventTypes || errors.distributors || errors.retailers) {
            return (
              <div className="alert alert-error">
                <span>Unable to load catalogs. Please try again.</span>
              </div>
            );
          }

          const matchByEmailDomain = (
            items: typeof distributors,
            email?: string | null
          ) => {
            const domain = email?.split("@")[1]?.toLowerCase();
            if (!domain) return null;
            return (
              items.find(
                (item) => item.email?.split("@")[1]?.toLowerCase() === domain
              ) ?? null
            );
          };

          const defaultValues: Partial<EventFormValues> = {
            ...baseDefaultValues,
            distributorId:
              baseDefaultValues.distributorId ??
              matchByEmailDomain(
                distributors,
                requestContactInfo.distributorEmail
              )?.id,
            retailerId:
              baseDefaultValues.retailerId ??
              (requestContactInfo.retailerName
                ? retailers.find(
                    (retailer) =>
                      retailer.name === requestContactInfo.retailerName
                  )?.id
                : undefined),
            storeManagerId:
              baseDefaultValues.storeManagerId ??
              requestStoreManagers.find((m) => {
                if (requestContactInfo.storeManagerName) {
                  return m.name === requestContactInfo.storeManagerName;
                }
                if (requestContactInfo.storeManagerPhone) {
                  return m.phone === requestContactInfo.storeManagerPhone;
                }
                return false;
              })?.id,
          };

          return (
            <EventForm
              eventTypes={eventTypes}
              tenantId={request.tenantId}
              requestId={request.id}
              distributors={distributors}
              retailers={retailers}
              requestStoreManagers={requestStoreManagers}
              requestContactInfo={requestContactInfo}
              onSubmit={handleSubmit}
              locations={locations}
              defaultValues={defaultValues}
              onRefetch={refetch}
            />
          );
        }}
      </CatalogsProvider>
    </>
  );
};

const CreateEvent = () => {
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

export default CreateEvent;
