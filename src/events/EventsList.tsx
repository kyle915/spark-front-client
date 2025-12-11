import { Suspense, useCallback, type ReactNode } from "react";
import DataTableRelay from "@/shared/DataTableRelay";
import Layout from "@/layout/Layout";
import { EventsQuery } from "@api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import Loading from "@shared/Loading";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import type { EventRow } from "../types/columnsTypes";
import { eventColumns } from "@utils/columns";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import CatalogsProvider from "@shared/CatalogsProvider";
import FormAutocomplete from "@shared/FormAutocomplete";
import FormInputText from "@shared/FormInputText";

//Icons
import { EyeIcon, PencilIcon } from "@heroicons/react/24/solid";

const PAGE_SIZE = 10;

type EventsTableContentProps = {
  queryReference: PreloadedQuery<EventsQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: (cursor: string) => void;
  onPrevious: (cursor: string) => void;
  onGoToPage: (page: number) => void;
  onPageLoaded: (payload: PageLoadedPayload) => void;
  isNavigating: boolean;
  renderRowActions?: (row: EventRow) => ReactNode;
};

const EventsTableContent = ({
  queryReference,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
  renderRowActions,
}: EventsTableContentProps) => {
  const data = usePreloadedQuery<EventsQueryType>(EventsQuery, queryReference);
  const connection = data.events;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>Event data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<EventRow>
      connection={connection}
      columns={eventColumns}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      isNavigating={isNavigating}
      onPageLoaded={onPageLoaded}
      customActions={
        renderRowActions
          ? {
              headerLabel: "Actions",
              render: renderRowActions,
            }
          : undefined
      }
    />
  );
};

type EventsListInnerProps = {
  filters?: {
    tenantId?: string;
    eventTypeId?: string;
    eventStatusId?: string;
    requestId?: string;
    date?: string;
  };
};

const EventsListInner = ({ filters }: EventsListInnerProps) => {
  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    goNext,
    goPrevious,
    goToPage,
  } = useRelayPagination<EventsQueryType>({
    query: EventsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
  });

  const navigate = useNavigate();

  const handleViewEvent = useCallback(
    (dataEvent: EventRow) => {
      console.info("Viewing request", dataEvent.uuid);
      navigate(`/event/view/${dataEvent.uuid}`);
    },
    [navigate]
  );

  const handleEditEvent = useCallback(
    (dataEvent: EventRow) => {
      console.info("Editing event", dataEvent.uuid);
      navigate(`/event/edit/${dataEvent.uuid}`);
    },
    [navigate]
  );

  const renderEventsActions = useCallback(
    (dataEvent: EventRow) => (
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={() => handleViewEvent(dataEvent)}
        >
          <EyeIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={() => handleEditEvent(dataEvent)}
        >
          <PencilIcon className="w-5 h-5" />
        </button>
      </div>
    ),
    [handleEditEvent, handleViewEvent]
  );

  return (
    <>
      <Suspense fallback={<Loading />}>
        {queryRef ? (
          <EventsTableContent
            queryReference={queryRef}
            currentPage={displayPage}
            pageSize={PAGE_SIZE}
            onNext={goNext}
            onPrevious={goPrevious}
            onGoToPage={goToPage}
            isNavigating={isNavigating}
            onPageLoaded={handlePageLoaded}
            renderRowActions={renderEventsActions}
          />
        ) : (
          <Loading />
        )}
      </Suspense>
    </>
  );
};

const EventsList = () => {
  const { control, watch } = useForm({
    defaultValues: {
      tenant: "",
      eventType: "",
      status: "",
      request: "",
      date: "",
    },
  });
  const selectedTenant = watch("tenant");
  const selectedEventType = watch("eventType");
  const selectedStatus = watch("status");
  const selectedRequest = watch("request");
  const selectedDate = watch("date");

  const filters = {
    tenantId: selectedTenant || undefined,
    eventTypeId: selectedEventType || undefined,
    eventStatusId: selectedStatus || undefined,
    requestId: selectedRequest || undefined,
    date: selectedDate || undefined,
  };

  const catalogFilters = selectedTenant
    ? { tenantId: selectedTenant }
    : undefined;

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Events</h1>
      </div>

      <CatalogsProvider
        tenants
        eventTypes
        eventTypesFilters={catalogFilters}
        eventStatuses
        eventStatusesFilters={catalogFilters}
        requests
        requestsFilters={catalogFilters}
      >
        {(catalogs) => (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-200 rounded-lg">
              <FormAutocomplete
                control={control}
                name="tenant"
                label="Filter by Tenant"
                options={catalogs.tenants.map((t) => ({
                  label: t.name,
                  value: t.id,
                }))}
                placeholder="Search tenant..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormAutocomplete
                control={control}
                name="eventType"
                label="Filter by Event Type"
                options={catalogs.eventTypes.map((t) => ({
                  label: t.name,
                  value: t.id,
                }))}
                placeholder="Search event type..."
              />
              <FormAutocomplete
                control={control}
                name="status"
                label="Filter by Status"
                options={catalogs.eventStatuses.map((s) => ({
                  label: s.name,
                  value: s.id,
                }))}
                placeholder="Search status..."
              />
              <FormAutocomplete
                control={control}
                name="request"
                label="Filter by Request"
                options={catalogs.requests.map((r) => ({
                  label: r.name,
                  value: r.id,
                }))}
                placeholder="Search request..."
              />
              <FormInputText
                control={control}
                name="date"
                placeholder=""
                label="Filter by Date"
                type="date"
              />
            </div>
            <EventsListInner
              key={`${selectedTenant}-${selectedEventType}-${selectedStatus}-${selectedRequest}-${selectedDate}`}
              filters={filters}
            />
          </div>
        )}
      </CatalogsProvider>
    </Layout>
  );
};

export default EventsList;
