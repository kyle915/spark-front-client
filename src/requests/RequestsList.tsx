import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import Layout from "@/layout/Layout";
import DataTableRelay from "@/shared/DataTableRelay";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { requestColumns } from "@/utils/columns";
import Loading from "@shared/Loading";
import type { RequestRow } from "@/types/columnsTypes";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import {
  useLazyLoadQuery,
  useMutation,
  usePreloadedQuery,
} from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import { useForm } from "react-hook-form";
import CatalogsProvider, { type CatalogsState } from "@shared/CatalogsProvider";

import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";

import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";

import { LocationsQuery } from "@api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@api/queries/__generated__/LocationsQuery.graphql";

//Icons
import {
  EyeIcon,
  CheckCircleIcon,
  PencilIcon,
  XCircleIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { ChevronDown, Funnel, FunnelXIcon } from "lucide-react";
import FormAutocomplete from "@/shared/FormAutocomplete";
import type { DeclineRequestMutation as DeclineRequestMutationType } from "@api/mutations/__generated__/DeclineRequestMutation.graphql";
import ConfirmationModal from "@/shared/ConfirmationModal";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import { DeclineRequestMutation } from "@/api/mutations/DeclineRequestMutation";
import FormDatePicker from "@/shared/FormDatePicker";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type RequestsTableContentProps = {
  queryReference: PreloadedQuery<RequestsQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: () => void;
  onPrevious: () => void;
  onNextChunk?: () => void;
  onPreviousChunk?: () => void;
  onGoToPage?: (page: number) => void;
  onPageLoaded: (payload: PageLoadedPayload) => void;
  isNavigating: boolean;
  renderRowActions?: (row: RequestRow) => ReactNode;
  isPageReachable: (page: number) => boolean;
  onReload?: () => void;
  isRefreshing?: boolean;
};

const RequestsTableContent = ({
  queryReference,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onNextChunk,
  onPreviousChunk,
  onGoToPage,
  onPageLoaded,
  isNavigating,
  renderRowActions,
  isPageReachable,
  onReload,
  isRefreshing,
}: RequestsTableContentProps) => {
  const data = usePreloadedQuery<RequestsQueryType>(
    RequestsQuery,
    queryReference,
  );
  const connection = data.requests;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>Request data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<RequestRow>
      connection={connection}
      columns={requestColumns}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onNextChunk={onNextChunk}
      onPreviousChunk={onPreviousChunk}
      isPageReachable={isPageReachable}
      onGoToPage={onGoToPage}
      onRefresh={onReload}
      isRefreshing={isRefreshing}
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

type RequestsListInnerProps = {
  filters?: {
    tenantId?: string;
    clientId?: string;
    retailerId?: string;
    distributorId?: string;
    statusId?: string;
    stateId?: string;
    date?: string;
    edited?: boolean;
    rmmClientId?: string;
  };
};

const RequestsListInner = ({ filters }: RequestsListInnerProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const showAlert = useAlertStore((state) => state.showAlert);
  const [commitDecline, isDeclineInFlight] =
    useMutation<DeclineRequestMutationType>(DeclineRequestMutation);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestToDecline, setRequestToDecline] = useState<RequestRow | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState("");

  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    isRefreshing,
    refresh,
    goNext,
    goPrevious,
    goNextChunk,
    goPreviousChunk,
    goToPage,
    isPageReachable,
  } = useRelayPagination<RequestsQueryType>({
    query: RequestsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
  });

  const handleViewRequest = useCallback(
    (request: RequestRow) => {
      navigate(`/request/view/${request.uuid}`, {
        state: {
          from: location.pathname,
        },
      });
    },
    [navigate, location.pathname],
  );

  const handleApproveRequest = useCallback(
    (request: RequestRow) => {
      navigate(`/event/create/${request.uuid}`);
    },
    [navigate],
  );

  const handleCreateEvent = useCallback(
    (request: RequestRow) => {
      navigate(`/event/create/${request.uuid}`);
    },
    [navigate],
  );

  const handleEditRequest = useCallback(
    (request: RequestRow) => {
      navigate(`/request/edit/${request.uuid}`);
    },
    [navigate],
  );

  const handleDeclineClick = useCallback((request: RequestRow) => {
    setRequestToDecline(request);
    setIsModalOpen(true);
  }, []);

  const handleConfirmDecline = useCallback(() => {
    if (!requestToDecline?.id) {
      console.error("Request ID is missing");
      return;
    }
    const normalizedDeclineReason = declineReason.trim() || null;

    commitDecline({
      variables: {
        input: {
          id: requestToDecline.id,
          declineReason: normalizedDeclineReason,
        },
      },
      onCompleted: (response) => {
        if (response.declineRequest.success) {
          showAlert("Request declined successfully", "success");
          refresh();
        } else {
          showAlert(`Error: ${response.declineRequest.message}`, "error");
        }
      },
      onError: (error) => {
        showAlert(`Error declining request: ${error.message}`, "error");
      },
    });
  }, [requestToDecline, declineReason, commitDecline, showAlert, refresh]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setRequestToDecline(null);
    setDeclineReason("");
  }, []);

  const renderRequestActions = useCallback(
    (request: RequestRow) => {
      const statusSlug = request.status?.slug?.toLowerCase();
      const statusName = request.status?.name?.toLowerCase();
      const isApproved = statusName === "approved";
      const isDeclined = statusSlug === "declined";
      const hasEvent = Boolean(request.event?.id);
      const canCreateEvent = !hasEvent && !isApproved && !isDeclined;

      return (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => handleViewRequest(request)}
          >
            <EyeIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => handleEditRequest(request)}
          >
            <PencilIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            className={`btn btn-xs btn-outline btn-info tooltip ${
              !canCreateEvent ? "disabled:text-info/50 hover:text-white" : ""
            }`}
            data-tip={
              hasEvent
                ? "Event already created"
                : isApproved
                  ? "Cannot create event from approved request"
                  : isDeclined
                    ? "Cannot create event from declined request"
                    : "Create Event from Request"
            }
            onClick={() => handleCreateEvent(request)}
            disabled={!canCreateEvent}
          >
            <CalendarDaysIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="btn btn-xs btn-outline btn-success tooltip disabled:text-success/50 hover:text-white"
            data-tip={isApproved ? "Already approved" : "Approve Request"}
            onClick={() => handleApproveRequest(request)}
            disabled={isApproved}
          >
            <CheckCircleIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="btn btn-xs btn-outline btn-error tooltip disabled:text-error/50 hover:text-white"
            data-tip={isDeclined ? "Already declined" : "Decline Request"}
            onClick={() => handleDeclineClick(request)}
            disabled={isDeclined || isDeclineInFlight}
          >
            <XCircleIcon className="w-5 h-5" />
          </button>
        </div>
      );
    },
    [
      handleApproveRequest,
      handleViewRequest,
      handleCreateEvent,
      handleEditRequest,
      handleDeclineClick,
      isDeclineInFlight,
    ],
  );

  return (
    <>
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmDecline}
        title="Decline Request"
        message={`Are you sure you want to decline the request "${
          requestToDecline?.name || ""
        }"?`}
        confirmText="Decline"
        cancelText="Cancel"
        confirmButtonClass="btn-error"
      >
        <div className="pb-4">
          <label className="form-control w-full">
            <span className="label">
              <span className="label-text">Decline reason</span>
            </span>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={4}
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              placeholder="Write the reason for declining this request..."
            />
          </label>
        </div>
      </ConfirmationModal>

      <Suspense fallback={<Loading />}>
        {queryRef ? (
          <RequestsTableContent
            queryReference={queryRef}
            currentPage={displayPage}
            pageSize={PAGE_SIZE}
            onNext={goNext}
            onPrevious={goPrevious}
            onNextChunk={goNextChunk}
            onPreviousChunk={goPreviousChunk}
            isPageReachable={isPageReachable}
            onGoToPage={goToPage}
            isNavigating={isNavigating}
            onPageLoaded={handlePageLoaded}
            onReload={refresh}
            isRefreshing={isRefreshing}
            renderRowActions={renderRequestActions}
          />
        ) : (
          <Loading />
        )}
      </Suspense>
    </>
  );
};

type RequestsListProps = {
  fixedFilters?: {
    edited?: boolean;
  };
};

const RequestsList = ({ fixedFilters }: RequestsListProps) => {
  const { tenantId } = useAuthStore();
  const navigate = useNavigate();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filtersOverflow, setFiltersOverflow] = useState<"hidden" | "visible">(
    "hidden",
  );
  const filtersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quick date-filter chips + Date sort, per the tracker-findability fix.
  // Default: no date filter ("all") + OLDEST-first ("asc"), so the board
  // reads chronologically top-to-bottom. This deliberately surfaces
  // recently-wrapped events (e.g. last week's Girl Beer bulk batch) near
  // the top instead of burying them ~100 rows down beneath future-dated
  // placeholders — the recurring "my bulk upload is missing" confusion.
  // Users can flip to newest-first via the Date sort toggle anytime.
  const [dateChip, setDateChip] = useState<
    "all" | "this_week" | "upcoming" | "past"
  >("all");
  const [dateSort, setDateSort] = useState<"asc" | "desc">("asc");

  // Translate the active chip into an inclusive YYYY-MM-DD range the
  // backend understands (RequestFiltersInput.start_date / end_date).
  const { startDate, endDate } = useMemo(() => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const todayIso = iso(today);
    if (dateChip === "this_week") {
      const wk = new Date(today);
      wk.setDate(wk.getDate() + 7);
      return { startDate: todayIso, endDate: iso(wk) };
    }
    if (dateChip === "upcoming") {
      return { startDate: todayIso, endDate: undefined as string | undefined };
    }
    if (dateChip === "past") {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      return {
        startDate: undefined as string | undefined,
        endDate: iso(yest),
      };
    }
    return {
      startDate: undefined as string | undefined,
      endDate: undefined as string | undefined,
    };
  }, [dateChip]);

  const handleToggleFilters = () => {
    if (filtersTimerRef.current) clearTimeout(filtersTimerRef.current);
    if (isFiltersOpen) {
      setFiltersOverflow("hidden");
      setIsFiltersOpen(false);
    } else {
      setIsFiltersOpen(true);
      filtersTimerRef.current = setTimeout(
        () => setFiltersOverflow("visible"),
        320,
      );
    }
  };

  // Reailer States
  const [retailerLocationSearchTerm, setRetailerLocationSearchTerm] =
    useState("");
  const [retailerLocations, setRetailerLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isRetailerLocationsLoading, setIsRetailerLocationsLoading] =
    useState(false);
  const [retailerSearchTerm, setRetailerSearchTerm] = useState("");
  // Distributor states
  const [distributorLocationSearchTerm, setDistributorLocationSearchTerm] =
    useState("");
  const [distributorLocations, setDistributorLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isDistributorLocationsLoading, setIsDistributorLocationsLoading] =
    useState(false);
  const [distributorSearchTerm, setDistributorSearchTerm] = useState("");

  const { control, watch, reset, setValue } = useForm({
    defaultValues: {
      // tenant: "",
      client: "",
      retailerState: "",
      retailerLocation: "",
      distributorState: "",
      distributorLocation: "",
      rmmAsigned: "",
      retailer: "",
      distributor: "",
      requestType: "",
      status: "",
      state: "",
      date: "",
    },
  });
  // const selectedTenant = watch("tenant");
  //   const selectedClient = watch("client");
  const selectedRetailerState = watch("retailerState");
  const selectedRetailerLocation = watch("retailerLocation");
  const selectedRetailer = watch("retailer");

  const selectedDistributorState = watch("distributorState");
  const selectedDistributorLocation = watch("distributorLocation");
  const selectedDistributor = watch("distributor");
  const selectedStatus = watch("status");
  const selectedState = watch("state");
  const selectedRequestType = watch("requestType");
  const selectedDate = watch("date");
  const selectedRmmClient = watch("rmmAsigned");

  // rmm clients query (for filters)
  const rmmClientsData = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId: tenantId ?? "" },
    { fetchPolicy: "store-and-network" },
  );

  // Construct filters object for the query, excluding empty values
  const filters = useMemo(
    () => ({
      tenantId: tenantId || undefined,
      retailerId: selectedRetailer || undefined,
      retailerStateId: selectedRetailerState || undefined,
      distributorId: selectedDistributor || undefined,
      distributorStateId: selectedDistributorState || undefined,
      requestTypeId: selectedRequestType || undefined,
      statusId: selectedStatus || undefined,
      stateId: selectedState || undefined,
      date: selectedDate || undefined,
      // Quick-chip date range + Date column sort (backend PR #616).
      startDate,
      endDate,
      dateSort,
      rmmAsigned: selectedRmmClient || undefined,
      ...fixedFilters,
    }),
    [
      selectedDistributor,
      selectedDistributorState,
      selectedRequestType,
      selectedRetailer,
      selectedRetailerState,
      selectedState,
      selectedStatus,
      tenantId,
      fixedFilters,
      selectedDate,
      selectedRmmClient,
      startDate,
      endDate,
      dateSort,
    ],
  );

  const catalogFilters = useMemo(
    () => ({
      tenantId: tenantId || undefined,
    }),
    [tenantId],
  );

  const retailerCatalogFilters = useMemo(
    () => ({
      ...(selectedRetailerState ? { stateId: selectedRetailerState } : {}),
      ...(selectedRetailerLocation
        ? { locationId: selectedRetailerLocation }
        : {}),
    }),
    [selectedRetailerState, selectedRetailerLocation],
  );

  useEffect(() => {
    setValue("retailerLocation", "");
    setValue("retailer", "");
    setRetailerLocationSearchTerm("");
    setRetailerSearchTerm("");
  }, [selectedRetailerState, setValue]);

  useEffect(() => {
    setRetailerSearchTerm("");
    setValue("retailer", "");
  }, [selectedRetailerLocation, setValue]);

  useEffect(() => {
    if (!selectedRetailerState) {
      setRetailerLocations([]);
      setIsRetailerLocationsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsRetailerLocationsLoading(true);

    fetchQuery<LocationsQueryType>(environment, LocationsQuery, {
      filters: {
        ...(selectedRetailerState ? { stateId: selectedRetailerState } : {}),
      },
      q: retailerLocationSearchTerm || null,
    })
      .toPromise()
      .then((data) => {
        if (!isCurrent) return;
        const nextLocations =
          data?.locations?.edges?.flatMap((edge) =>
            edge?.node ? [{ id: edge.node.id, name: edge.node.name }] : [],
          ) ?? [];
        setRetailerLocations(nextLocations);
        setIsRetailerLocationsLoading(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setRetailerLocations([]);
        setIsRetailerLocationsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [retailerLocationSearchTerm, selectedRetailerState]);

  // Distributor locations effect
  const distributorCatalogFilters = useMemo(
    () => ({
      ...(selectedDistributorState
        ? { stateId: selectedDistributorState }
        : {}),
      ...(selectedDistributorLocation
        ? { locationId: selectedDistributorLocation }
        : {}),
    }),
    [selectedDistributorLocation, selectedDistributorState],
  );

  useEffect(() => {
    setValue("distributorLocation", "");
    setValue("distributor", "");
    setDistributorLocationSearchTerm("");
    setDistributorSearchTerm("");
  }, [selectedDistributorState, setValue]);

  useEffect(() => {
    setDistributorSearchTerm("");
    setValue("distributor", "");
  }, [selectedDistributorLocation, setValue]);

  useEffect(() => {
    if (!selectedDistributorState) {
      setDistributorLocations([]);
      setIsDistributorLocationsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsDistributorLocationsLoading(true);

    fetchQuery<LocationsQueryType>(environment, LocationsQuery, {
      filters: {
        ...(selectedDistributorState
          ? { stateId: selectedDistributorState }
          : {}),
      },
      q: distributorLocationSearchTerm || null,
    })
      .toPromise()
      .then((data) => {
        if (!isCurrent) return;
        const nextLocations =
          data?.locations?.edges?.flatMap((edge) =>
            edge?.node ? [{ id: edge.node.id, name: edge.node.name }] : [],
          ) ?? [];
        setDistributorLocations(nextLocations);
        setIsDistributorLocationsLoading(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setDistributorLocations([]);
        setIsDistributorLocationsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [distributorLocationSearchTerm, selectedDistributorState, tenantId]);

  const handleResetFilters = useCallback(() => {
    reset({
      client: "",
      retailerState: "",
      retailerLocation: "",
      distributorState: "",
      distributorLocation: "",
      retailer: "",
      distributor: "",
      requestType: "",
      status: "",
      state: "",
      date: "",
    });
    setRetailerSearchTerm("");
    setDistributorSearchTerm("");
    setRetailerLocationSearchTerm("");
    setDistributorLocationSearchTerm("");
  }, [reset]);

  const activeFiltersCount = Object.values(watch()).filter(Boolean).length;

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              {fixedFilters?.edited ? (
                <PencilIcon className="w-8 h-8" />
              ) : (
                <ClipboardDocumentListIcon className="w-8 h-8" />
              )}
            </div>
            <h1>{fixedFilters?.edited ? "Edited Requests" : "All Requests"}</h1>
          </div>

          {/* BOTÓN CREAR EVENTO */}
          <button
            type="button"
            onClick={() => navigate("/event/create")}
            className="btn btn-primary btn-sm gap-2"
          >
            <CalendarDaysIcon className="w-4 h-4" />
            Create Event
          </button>
        </div>

        <p className="text-base-content/70">
          {fixedFilters?.edited
            ? "Manage and review all edited requests submitted within the system."
            : "Manage and review all requests submitted within the system."}
        </p>
      </div>

      <CatalogsProvider
        // tenants={true}
        clients={true}
        retailers={true}
        distributors={true}
        requestTypes={true}
        requestStatuses={true}
        clientsFilters={catalogFilters}
        requestTypesFilters={catalogFilters}
        retailersFilters={retailerCatalogFilters}
        retailersQuery={retailerSearchTerm.trim() || null}
        distributorsFilters={distributorCatalogFilters}
        distributorsQuery={distributorSearchTerm.trim() || null}
        requestStatusesFilters={catalogFilters}
        states={true}
      >
        {(catalogs) => {
          const isLoading = (key: keyof CatalogsState["loading"]) =>
            catalogs.loading[key];

          return (
            <div className="flex flex-col gap-4">
              {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-200 rounded-lg">
              <FormSelect
                control={control}
                name="tenant"
                label="Filter by Tenant"
                options={catalogs.tenants.map((t) => ({
                  label: t.name,
                  value: t.id,
                }))}
                placeholder="Select a tenant"
              />
            </div> */}
              <div className="bg-base-100 rounded-xl border border-base-300 shadow-sm">
                <div
                  className="flex items-center justify-between cursor-pointer px-6 py-4 select-none"
                  onClick={handleToggleFilters}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <Funnel size={18} className="text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-base-content">
                        Filters
                      </h3>
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center justify-between gap-3">
                      {activeFiltersCount > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={handleResetFilters}
                        >
                          <FunnelXIcon className="w-4 h-4" />
                          Clear
                        </button>
                      )}

                      <span className="text-xs text-base-content/60">
                        {isFiltersOpen ? "Hide" : "Show"}
                      </span>

                      <ChevronDown
                        size={20}
                        className={cn(
                          "transition-transform duration-300",
                          isFiltersOpen ? "rotate-180" : "rotate-0",
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: isFiltersOpen ? "900px" : "0px",
                    overflow: filtersOverflow,
                    transition: "max-height 0.3s ease",
                  }}
                >
                  <div className="px-6 pb-6 pt-2 flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <FormAutocomplete
                        control={control}
                        name="state"
                        label="State"
                        options={catalogs.states.map((state) => ({
                          label: state.code
                            ? `${state.name} (${state.code})`
                            : state.name,
                          value: state.id,
                          searchText: state.code
                            ? `${state.name} ${state.code}`
                            : state.name,
                        }))}
                        loading={isLoading("states")}
                        placeholder="Search state..."
                      />

                      <FormAutocomplete
                        control={control}
                        name="status"
                        label="Status"
                        options={catalogs.requestStatuses.map((s) => ({
                          label: s.name,
                          value: s.id,
                        }))}
                        loading={isLoading("requestStatuses")}
                        placeholder="Search status..."
                      />

                      <FormDatePicker
                        control={control}
                        name="date"
                        label="Filter by Date"
                        placeholder="Select date"
                      />

                      <FormAutocomplete
                        control={control}
                        name="requestType"
                        label="Request Type"
                        options={catalogs.requestTypes.map((s) => ({
                          label: s.name,
                          value: s.id,
                        }))}
                        loading={isLoading("requestTypes")}
                        placeholder="Search request type..."
                      />

                      <FormAutocomplete
                        control={control}
                        name="rmmAsigned"
                        label="RMM Client"
                        options={rmmClientsData.rmmClients.map((c) => ({
                          label: `${c.firstName} ${c.lastName}`,
                          value: c.id,
                        }))}
                        loading={isLoading("clients")}
                        placeholder="Search client..."
                      />
                      {/** Retailer control filter */}
                      <FormAutocomplete
                        control={control}
                        name="retailerState"
                        label="Retailer State"
                        options={catalogs.states.map((state) => ({
                          label: state.code
                            ? `${state.name} (${state.code})`
                            : state.name,
                          value: state.id,
                        }))}
                        placeholder="Search state..."
                        loading={isLoading("states")}
                        disabled={Boolean(selectedState)}
                      />
                      <FormAutocomplete
                        control={control}
                        name="retailerLocation"
                        label="Retailer Location"
                        options={retailerLocations.map((location) => ({
                          label: location.name,
                          value: location.id,
                        }))}
                        placeholder={
                          selectedRetailerState
                            ? "Search location..."
                            : "Select a state first"
                        }
                        loading={isRetailerLocationsLoading}
                        disabled={!selectedRetailerState}
                        onSearch={setRetailerLocationSearchTerm}
                      />
                      <FormAutocomplete
                        control={control}
                        name="retailer"
                        label="Filter by Retailer"
                        options={catalogs.retailers.map((r) => ({
                          label: r.name,
                          value: r.id,
                        }))}
                        placeholder={
                          selectedRetailerLocation
                            ? "Search retailer..."
                            : "Select a location first"
                        }
                        loading={isLoading("retailers")}
                        onSearch={setRetailerSearchTerm}
                        disabled={!selectedRetailerLocation}
                      />

                      {/** Distributor control filter */}
                      <FormAutocomplete
                        control={control}
                        name="distributorState"
                        label="Distributor State"
                        options={catalogs.states.map((state) => ({
                          label: state.code
                            ? `${state.name} (${state.code})`
                            : state.name,
                          value: state.id,
                          searchText: state.code
                            ? `${state.name} ${state.code}`
                            : state.name,
                        }))}
                        placeholder="Search state..."
                        loading={isLoading("states")}
                        disabled={Boolean(selectedState)}
                      />

                      <FormAutocomplete
                        control={control}
                        name="distributorLocation"
                        label="Distributor Location"
                        options={distributorLocations.map((location) => ({
                          label: location.name,
                          value: location.id,
                        }))}
                        placeholder={
                          selectedDistributorState
                            ? "Search location..."
                            : "Select a state first"
                        }
                        loading={isDistributorLocationsLoading}
                        disabled={!selectedDistributorState}
                        onSearch={setDistributorLocationSearchTerm}
                      />

                      <FormAutocomplete
                        control={control}
                        name="distributor"
                        label="Distributor"
                        options={catalogs.distributors.map((d) => ({
                          label: d.name,
                          value: d.id,
                        }))}
                        loading={isLoading("distributors")}
                        placeholder={
                          selectedDistributorLocation
                            ? "Search distributor..."
                            : "Select a location first"
                        }
                        onSearch={setDistributorSearchTerm}
                        disabled={!selectedDistributorLocation}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick date-filter chips + Date sort toggle. Lets ops jump
                  to Past (wrapped events owing recaps) / This week /
                  Upcoming without digging through the Filters panel, and
                  flip the date order so soonest-first is one click away. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {([
                  ["all", "All"],
                  ["this_week", "This week"],
                  ["upcoming", "Upcoming"],
                  ["past", "Past"],
                ] as const).map(([key, label]) => {
                  const active = dateChip === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDateChip(key)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                      style={{
                        background: active
                          ? "var(--spark-lime)"
                          : "transparent",
                        color: active ? "#0a0d09" : "var(--spark-text)",
                        border: `1px solid ${
                          active ? "var(--spark-lime)" : "var(--spark-border)"
                        }`,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setDateSort((s) => (s === "desc" ? "asc" : "desc"))
                  }
                  className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  style={{
                    background: "transparent",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                  }}
                  title="Toggle event-date sort"
                >
                  Date {dateSort === "desc" ? "↓ Latest first" : "↑ Soonest first"}
                </button>
              </div>

              <div className="mt-2">
                <RequestsListInner
                  key={`${selectedRetailer}-${selectedDistributor}-${selectedStatus}-${selectedState}-${selectedDate}-${selectedRequestType}-${selectedRmmClient}-${dateChip}-${dateSort}-${JSON.stringify(fixedFilters)}`} // Reset inner component when filters change to reset pagination
                  filters={filters}
                />
              </div>
            </div>
          );
        }}
      </CatalogsProvider>
    </Layout>
  );
};

export default RequestsList;
