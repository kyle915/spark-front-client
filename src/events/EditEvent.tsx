import { Suspense, useMemo, useRef } from "react";
import Layout from "@/layout/Layout";
import { useNavigate, useParams } from "react-router";
import Loading from "@/shared/Loading";
import CatalogsProvider from "@/shared/CatalogsProvider";
import EventForm from "./components/EventForm";
import type { EventFormValues } from "../types/events/formTypes";
import { EventUuidQuery } from "@/api/queries/EventUuidQuery";
import type { EventUuidQuery as EventUuidQueryType } from "@/api/queries/__generated__/EventUuidQuery.graphql";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { UpdateEventMutation } from "@/api/mutations/UpdateEventMutation";
import type { UpdateEventMutation as UpdateEventMutationType } from "@/api/mutations/__generated__/UpdateEventMutation.graphql";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import { StatesQuery } from "@/api/queries/StatesQuery";
import type { StatesQuery as StatesQueryType } from "@api/queries/__generated__/StatesQuery.graphql";
import { useAlertStore } from "@/store/alertStore";
import { dateFormat } from "@/public/form/utils/toDate";
import {
  buildDateTimeWithOffset,
  extractDatePart,
  extractTimePart,
} from "@/utils";

type EditEventContentProps = {
  uuid: string;
};

const EditEventContent = ({ uuid }: EditEventContentProps) => {
  const renderCountRef = useRef(0);
  renderCountRef.current++;

  console.log(
    `%c[EditEventContent] render #${renderCountRef.current}`,
    "color: cyan; font-weight: bold;",
  );

  const navigate = useNavigate();
  const data = useLazyLoadQuery<EventUuidQueryType>(EventUuidQuery, { uuid });
  const event = data.event;

  const [commitUpdateEvent] =
    useMutation<UpdateEventMutationType>(UpdateEventMutation);
  const { showAlert } = useAlertStore();

  const eventTypeFilters = useMemo(
    () => (event?.tenantId ? { tenantId: event.tenantId } : undefined),
    [event?.tenantId],
  );

  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );

  const timeZones = timezonesData.timezones.edges.map((e) => e.node);

  const statesData = useLazyLoadQuery<StatesQueryType>(
    StatesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );

  const states = statesData.states?.edges.map((e) => e.node) || [];

  if (!event) {
    return (
      <div className="alert alert-warning">
        <span>The specified event was not found.</span>
      </div>
    );
  }

  const handleSubmit = (formData: EventFormValues) => {
    if (!formData.eventTypeId || !formData.startTime || !formData.endTime) {
      showAlert("Missing required fields for event update", "success");
      return;
    }

    const timezone =
      timeZones.find((tz) => tz.id === formData.timezoneId) ??
      event.timezone ??
      null;
    const offsetMinutes = timezone?.offset ?? null;
    const dateValue = dateFormat(formData.date ?? event.date ?? "");
    const normalizedDate = dateValue
      ? buildDateTimeWithOffset(dateValue, "00:00", offsetMinutes)
      : "";

    commitUpdateEvent({
      variables: {
        input: {
          id: event.id,
          name: formData.name,
          eventTypeId: formData.eventTypeId,
          requestId: formData.associateRequest
            ? (formData.requestId ?? event.request?.id ?? "")
            : null,
          timezoneId: formData.timezoneId,
          coordinates: formData.coordinates ?? [],
          address: formData.address,
          distributorId: formData.distributorId ?? null,
          retailerId: formData.retailerId ?? null,
          notes: formData.notes ?? "",
          isNational: formData.isNational ?? false,
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
              ? buildDateTimeWithOffset(
                  dateValue,
                  formData.endTime,
                  offsetMinutes,
                )
              : "",
          tenantId: event.tenantId,
          date: normalizedDate,
        },
      },
      onCompleted: (response) => {
        if (response.updateEvent?.success) {
          showAlert(response.updateEvent.message, "success");
          navigate(`/event/view/${event.uuid ?? uuid}`);
        } else {
          showAlert(response.updateEvent.message, "error");
        }
      },
      onError: (error) => {
        showAlert(`Error updating event: ${error}`, "error");
      },
    });
  };

  const defaultDate = extractDatePart(event.date ?? "") ?? event.date ?? "";
  const defaultStartTime =
    extractTimePart(event.startTime ?? "") ?? event.startTime ?? undefined;
  const defaultEndTime =
    extractTimePart(event.endTime ?? "") ?? event.endTime ?? undefined;

  const defaultValues: Partial<EventFormValues> = {
    name: event.name ?? "",
    address: event.address ?? "",
    startTime: defaultStartTime,
    timezoneId: event.timezone?.id ?? undefined,
    endTime: defaultEndTime,
    notes: event.notes ?? "",
    date: defaultDate,
    isNational: event.isNational ?? false,
    coordinates: event.coordinates?.map((coord) => coord) ?? undefined,
    eventTypeId: event.eventType?.id,
    requestId: event.request?.id ?? undefined,
    associateRequest: Boolean(event.request),
    distributorId:
      event.distributor?.id ?? event.request?.distributor?.id ?? undefined,
    retailerId: event.retailer?.id ?? event.request?.retailer?.id ?? undefined,
    stateId:
      event.retailer?.location?.state?.id ??
      event.distributor?.location?.state?.id ??
      event.request?.retailer?.location?.state?.id ??
      event.request?.distributor?.location?.state?.id ??
      undefined,

    entitiesLocationId:
      event.retailer?.location?.id ??
      event.distributor?.location?.id ??
      event.request?.retailer?.location?.id ??
      event.request?.distributor?.location?.id ??
      undefined,

    distributorLocationId:
      event.distributor?.location?.id ??
      event.request?.distributor?.location?.id ??
      undefined,

    retailerLocationId:
      event.retailer?.location?.id ??
      event.request?.retailer?.location?.id ??
      undefined,
  };

  return (
    <>
      <CatalogsProvider eventTypes eventTypesFilters={eventTypeFilters}>
        {({ eventTypes, loading, errors, refetch }) => {
          if (loading.eventTypes) {
            return <Loading />;
          }

          if (errors.eventTypes) {
            return (
              <div className="alert alert-error">
                <span>Unable to load catalogs. Please try again.</span>
              </div>
            );
          }

          return (
            <EventForm
              mode="edit"
              eventTypes={eventTypes}
              tenantId={event.tenantId ?? ""}
              timezones={timeZones}
              showIsNational={false}
              onSubmit={handleSubmit}
              states={states}
              defaultValues={defaultValues}
              enableContactSection
              contactMode="manual"
              onRefetch={refetch}
              showRequestField={true}
              showAssociateRequestToggle={true}
            />
          );
        }}
      </CatalogsProvider>
    </>
  );
};

const EditEvent = () => {
  const { uuid } = useParams<{ uuid: string }>();

  if (!uuid) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>The event identifier is not defined.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <EditEventContent uuid={uuid} />
      </Suspense>
    </Layout>
  );
};

export default EditEvent;
