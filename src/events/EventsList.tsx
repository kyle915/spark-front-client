import { Suspense, useCallback, useState, type ReactNode } from "react";
import DataTableRelay from "@/shared/DataTableRelay";
import Layout from "@/layout/Layout";
import { EventsQuery } from "@api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import Loading from "@shared/Loading";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import { useMutation, usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import type { EventRow } from "../types/columnsTypes";
import { eventColumns } from "@utils/columns";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import CatalogsProvider from "@shared/CatalogsProvider";
import FormAutocomplete from "@shared/FormAutocomplete";
import FormDatePicker from "@/shared/FormDatePicker";
import { useAuthStore } from "@/store/authStore";
import { SuspendEventMutation } from "@api/mutations/SuspendEventMutation";
import { ArchiveEventMutation } from "@api/mutations/ArchiveEventMutation";
import { ApproveEventMutation } from "@api/mutations/ApproveEventMutation";

//Icons
import { EyeIcon, PencilIcon } from "@heroicons/react/24/outline";
import {
  Archive,
  CheckCircleIcon,
  FilterIcon,
  FunnelXIcon,
  PauseCircleIcon,
} from "lucide-react";
import { CalendarDaysIcon } from "@heroicons/react/24/solid";
import { useAlertStore } from "@/store/alertStore";
import ConfirmationModal from "@/shared/ConfirmationModal";

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
    refresh,
    goNext,
    goPrevious,
    goToPage,
  } = useRelayPagination<EventsQueryType>({
    query: EventsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
  });

  const navigate = useNavigate();
  const showAlert = useAlertStore((state) => state.showAlert);
  const [commitSuspend, isSuspending] = useMutation<any>(SuspendEventMutation);
  const [commitArchive, isArchiving] = useMutation<any>(ArchiveEventMutation);
  const [commitApprove, isApproving] = useMutation<any>(ApproveEventMutation);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [eventToSuspend, setEventToSuspend] = useState<EventRow | null>(null);
  const [eventToArchive, setEventToArchive] = useState<EventRow | null>(null);
  const [eventToApprove, setEventToApprove] = useState<EventRow | null>(null);

  const handleViewEvent = useCallback(
    (dataEvent: EventRow) => {
      console.info("Viewing request", dataEvent.uuid);
      navigate(`/event/view/${dataEvent.uuid}`);
    },
    [navigate],
  );

  const handleEditEvent = useCallback(
    (dataEvent: EventRow) => {
      console.info("Editing event", dataEvent.uuid);
      navigate(`/event/edit/${dataEvent.uuid}`);
    },
    [navigate],
  );

  const handleSuspendClick = useCallback((dataEvent: EventRow) => {
    setEventToSuspend(dataEvent);
    setIsSuspendModalOpen(true);
  }, []);

  const handleArchiveClick = useCallback((dataEvent: EventRow) => {
    setEventToArchive(dataEvent);
    setIsArchiveModalOpen(true);
  }, []);

  const handleApproveClick = useCallback((dataEvent: EventRow) => {
    setEventToApprove(dataEvent);
    setIsApproveModalOpen(true);
  }, []);

  const handleConfirmSuspend = useCallback(() => {
    if (!eventToSuspend?.id) {
      console.error("Event ID is missing");
      return;
    }
    commitSuspend({
      variables: {
        input: {
          id: eventToSuspend.id,
        },
      },
      onCompleted: (response) => {
        if (response.suspendEvent?.success) {
          showAlert("Event suspended successfully", "success");
          refresh();
        } else {
          showAlert(
            `Error: ${response.suspendEvent?.message ?? "Unable to suspend event"}`,
            "error",
          );
        }
      },
      onError: (error) => {
        showAlert(`Error suspending event: ${error.message}`, "error");
      },
    });
  }, [commitSuspend, eventToSuspend, refresh, showAlert]);

  const handleConfirmArchive = useCallback(() => {
    if (!eventToArchive?.id) {
      console.error("Event ID is missing");
      return;
    }
    commitArchive({
      variables: {
        input: {
          id: eventToArchive.id,
        },
      },
      onCompleted: (response) => {
        if (response.archiveEvent?.success) {
          showAlert("Event archived successfully", "success");
          refresh();
        } else {
          showAlert(
            `Error: ${response.archiveEvent?.message ?? "Unable to archive event"}`,
            "error",
          );
        }
      },
      onError: (error) => {
        showAlert(`Error archiving event: ${error.message}`, "error");
      },
    });
  }, [commitArchive, eventToArchive, refresh, showAlert]);

  const handleConfirmApprove = useCallback(() => {
    if (!eventToApprove?.id) {
      console.error("Event ID is missing");
      return;
    }
    commitApprove({
      variables: {
        input: {
          id: eventToApprove.id,
        },
      },
      onCompleted: (response) => {
        if (response.approveEvent?.success) {
          showAlert("Event approved successfully", "success");
          refresh();
        } else {
          showAlert(
            `Error: ${response.approveEvent?.message ?? "Unable to approve event"}`,
            "error",
          );
        }
      },
      onError: (error) => {
        showAlert(`Error approving event: ${error.message}`, "error");
      },
    });
  }, [commitApprove, eventToApprove, refresh, showAlert]);

  const handleCloseSuspendModal = useCallback(() => {
    setIsSuspendModalOpen(false);
    setEventToSuspend(null);
  }, []);

  const handleCloseArchiveModal = useCallback(() => {
    setIsArchiveModalOpen(false);
    setEventToArchive(null);
  }, []);

  const handleCloseApproveModal = useCallback(() => {
    setIsApproveModalOpen(false);
    setEventToApprove(null);
  }, []);

  const renderEventsActions = useCallback(
    (dataEvent: EventRow) => {
      const statusSlug = dataEvent.status?.slug?.toLowerCase();
      const statusName = dataEvent.status?.name?.toLowerCase();
      const isSuspended =
        statusSlug === "suspended" ||
        statusName === "suspended" ||
        statusName === "suspendido";
      const isArchived =
        statusSlug === "archived" ||
        statusName === "archived" ||
        statusName === "archivado";
      const isApproved =
        statusSlug === "approved" ||
        statusName === "approved" ||
        statusName === "aprobado";
      return (
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
          <button
            type="button"
            className={`btn btn-xs btn-ghost tooltip ${isApproved ? "text-success/50 btn-disabled" : "text-success"}`}
            data-tip={isApproved ? "Already approved" : "Approve event"}
            onClick={() => handleApproveClick(dataEvent)}
            disabled={isApproved || isApproving}
            aria-label="Approve event"
          >
            <CheckCircleIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            className={`btn btn-xs btn-ghost tooltip ${isSuspended ? "text-warning/50 btn-disabled" : "text-warning"}`}
            data-tip={isSuspended ? "Already suspended" : "Suspend event"}
            onClick={() => handleSuspendClick(dataEvent)}
            disabled={isSuspended || isSuspending}
            aria-label="Suspend event"
          >
            <PauseCircleIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            className={`btn btn-xs btn-ghost tooltip ${isArchived ? "text-error/50 btn-disabled" : "text-error"}`}
            data-tip={isArchived ? "Already archived" : "Archive event"}
            onClick={() => handleArchiveClick(dataEvent)}
            disabled={isArchived || isArchiving}
            aria-label="Archive event"
          >
            <Archive className="w-5 h-5" />
          </button>
        </div>
      );
    },
    [
      handleEditEvent,
      handleViewEvent,
      handleApproveClick,
      handleSuspendClick,
      handleArchiveClick,
      isApproving,
      isSuspending,
      isArchiving,
    ],
  );

  return (
    <>
      <ConfirmationModal
        isOpen={isApproveModalOpen}
        onClose={handleCloseApproveModal}
        onConfirm={handleConfirmApprove}
        title="Approve Event"
        message={`Are you sure you want to approve the event "${eventToApprove?.name || ""}"?`}
        confirmText="Approve"
        cancelText="Cancel"
        confirmButtonClass="btn-success"
      />
      <ConfirmationModal
        isOpen={isSuspendModalOpen}
        onClose={handleCloseSuspendModal}
        onConfirm={handleConfirmSuspend}
        title="Suspend Event"
        message={`Are you sure you want to suspend the event "${eventToSuspend?.name || ""}"?`}
        confirmText="Suspend"
        cancelText="Cancel"
        confirmButtonClass="btn-warning"
      />
      <ConfirmationModal
        isOpen={isArchiveModalOpen}
        onClose={handleCloseArchiveModal}
        onConfirm={handleConfirmArchive}
        title="Archive Event"
        message={`Are you sure you want to archive the event "${eventToArchive?.name || ""}"?`}
        confirmText="Archive"
        cancelText="Cancel"
        confirmButtonClass="btn-error"
      />
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
  const { tenantId } = useAuthStore();

  const { control, watch, reset } = useForm({
    defaultValues: {
      // tenant: "",
      eventType: "",
      status: "",
      request: "",
      date: "",
    },
  });
  // const selectedTenant = watch("tenant");
  const selectedEventType = watch("eventType");
  const selectedStatus = watch("status");
  const selectedRequest = watch("request");
  const selectedDate = watch("date");

  const filters = {
    tenantId: tenantId || undefined,
    eventTypeId: selectedEventType || undefined,
    eventStatusId: selectedStatus || undefined,
    requestId: selectedRequest || undefined,
    date: selectedDate || undefined,
  };

  const catalogFilters = undefined;

  return (
    <Layout>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <CalendarDaysIcon className="w-8 h-8" />
          </div>
          <h1>All Events</h1>
        </div>
        <p className="text-base-content/70">
          Manage and browse all events in the system.
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
                <FormDatePicker
                  control={control}
                  name="date"
                  label="Filter by Date"
                  placeholder="Select date"
                />
              </div>
            </div>

            <EventsListInner
              key={`${selectedEventType}-${selectedStatus}-${selectedRequest}-${selectedDate}`}
              filters={filters}
            />
          </div>
        )}
      </CatalogsProvider>
    </Layout>
  );
};

export default EventsList;
