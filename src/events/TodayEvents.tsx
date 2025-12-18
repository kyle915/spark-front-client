import { Suspense, useCallback, type ReactNode } from "react";
import DataTableRelay from "@/shared/DataTableRelay";
import Layout from "@/layout/Layout";
import { TodayEventsQuery } from "@/api/queries/TodayEventsQuery";
import type { TodayEventsQuery as TodayEventsQueryType } from "@api/queries/__generated__/TodayEventsQuery.graphql";
import Loading from "@/shared/Loading";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import type { EventRow } from "../types/columnsTypes";
import { eventColumns } from "@/utils/columns";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import CatalogsProvider from "@/shared/CatalogsProvider";
import FormAutocomplete from "@/shared/FormAutocomplete";
import { useAuthStore } from "@/store/authStore";

//Icons
import {
  CalendarDaysIcon,
  EyeIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { FilterIcon, FunnelXIcon } from "lucide-react";
import { dateFormat } from "@/public/form/utils/toDate";

const PAGE_SIZE = 10;

type EventsTableContentProps = {
  queryReference: PreloadedQuery<TodayEventsQueryType>;
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
  const data = usePreloadedQuery<TodayEventsQueryType>(
    TodayEventsQuery,
    queryReference
  );
  const connection = data.todayEvents;

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

type TodayEventsInnerProps = {
  filters?: {
    tenantId?: string;
    eventTypeId?: string;
    eventStatusId?: string;
    requestId?: string;
  };
};

const TodayEventsInner = ({ filters }: TodayEventsInnerProps) => {
  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    goNext,
    goPrevious,
    goToPage,
  } = useRelayPagination<TodayEventsQueryType>({
    query: TodayEventsQuery,
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

const TodayEvents = () => {
  const { tenantId } = useAuthStore();
  const { control, watch, reset } = useForm({
    defaultValues: {
      // tenant: "",
      eventType: "",
      status: "",
      request: "",
    },
  });
  // const selectedTenant = watch("tenant");
  const selectedEventType = watch("eventType");
  const selectedStatus = watch("status");
  const selectedRequest = watch("request");

  const filters = {
    tenantId: tenantId || undefined,
    eventTypeId: selectedEventType || undefined,
    eventStatusId: selectedStatus || undefined,
    requestId: selectedRequest || undefined,
  };

  const catalogFilters = undefined;

  return (
    <Layout>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <CalendarDaysIcon className="w-8 h-8" />
          </div>
          <h1>Today's Events</h1>
        </div>
        <p className="text-base-content/70">
          {`Manage and browse today's ${dateFormat(
            new Date().toISOString()
          )} events in the system.`}
        </p>
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
            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-200 rounded-lg">
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
            </div> */}
            <div className="rounded-xl  bg-base-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                  <FilterIcon className="w-4 h-4" />
                  <h2 className="text-sm font-semibold text-base-content/70">
                    Filters
                  </h2>
                </div>

                {Object.entries(watch()).some(([, value]) => value) && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => reset()}
                    >
                      <FunnelXIcon className="w-4 h-4" />
                      Clear filters
                    </button>
                  </>
                )}
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
              </div>
            </div>

            <TodayEventsInner
              key={`${selectedEventType}-${selectedStatus}-${selectedRequest}`}
              filters={filters}
            />
          </div>
        )}
      </CatalogsProvider>
    </Layout>
  );
};

export default TodayEvents;
