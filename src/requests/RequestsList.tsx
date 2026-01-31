import { Suspense, useCallback, useState } from "react";
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
import { useMutation, usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import { useForm } from "react-hook-form";
import CatalogsProvider, { type CatalogsState } from "@shared/CatalogsProvider";

//Icons
import {
  EyeIcon,
  CheckCircleIcon,
  PencilIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
  FunnelIcon as FilterIcon,
} from "@heroicons/react/24/outline";
import { FunnelXIcon } from "lucide-react";
import FormAutocomplete from "@/shared/FormAutocomplete";
import type { DeclineRequestMutation as DeclineRequestMutationType } from "@api/mutations/__generated__/DeclineRequestMutation.graphql";
import ConfirmationModal from "@/shared/ConfirmationModal";
import { useAlertStore } from "@/store/alertStore";
import { DeclineRequestMutation } from "@/api/mutations/DeclineRequestMutation";
import FormDatePicker from "@/shared/FormDatePicker";

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
    date?: string;
    edited?: boolean;
  };
  onRefreshReady?: (refreshFn: () => void) => void;
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
    commitDecline({
      variables: {
        input: {
          id: requestToDecline.id,
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
  }, [requestToDecline, commitDecline, showAlert, refresh]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setRequestToDecline(null);
  }, []);

  const renderRequestActions = useCallback(
    (request: RequestRow) => {
      const statusSlug = request.status?.slug?.toLowerCase();
      const statusName = request.status?.name?.toLowerCase();
      const isApproved = statusName === "approved" || statusName === "aprobado";
      const isDeclined = statusSlug === "decline";

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
      />

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
  const [retailerSearchTerm, setRetailerSearchTerm] = useState("");
  const [distributorSearchTerm, setDistributorSearchTerm] = useState("");
  const { control, watch, reset } = useForm({
    defaultValues: {
      // tenant: "",
      client: "",
      retailer: "",
      distributor: "",
      status: "",
      date: "",
    },
  });
  // const selectedTenant = watch("tenant");
  //   const selectedClient = watch("client");
  const selectedRetailer = watch("retailer");
  const selectedDistributor = watch("distributor");
  const selectedStatus = watch("status");
  const selectedDate = watch("date");

  const filters = {
    retailerId: selectedRetailer || undefined,
    distributorId: selectedDistributor || undefined,
    statusId: selectedStatus || undefined,
    date: selectedDate || undefined,
    ...fixedFilters,
  };

  const catalogFilters = undefined;

  return (
    <Layout>
      <div className="mb-4 flex flex-col gap-2">
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
        requestStatuses={true}
        clientsFilters={catalogFilters}
        retailersFilters={catalogFilters}
        retailersQuery={retailerSearchTerm.trim() || null}
        distributorsFilters={catalogFilters}
        distributorsQuery={distributorSearchTerm.trim() || null}
        requestStatusesFilters={catalogFilters}
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
              <div className="rounded-xl  bg-base-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1">
                    <FilterIcon className="w-4 h-4" />
                    <h2 className="text-sm font-semibold text-base-content/70">
                      Filters
                    </h2>
                  </div>

                  <div className="flex gap-2">
                    {Object.entries(watch()).some(([, value]) => value) && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => reset()}
                      >
                        <FunnelXIcon className="w-4 h-4" />
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormAutocomplete
                    control={control}
                    name="retailer"
                    label="Retailer"
                    options={catalogs.retailers.map((r) => ({
                      label: r.name,
                      value: r.id,
                    }))}
                    loading={isLoading("retailers")}
                    placeholder="Search retailer..."
                    onSearch={setRetailerSearchTerm}
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
                    placeholder="Search distributor..."
                    onSearch={setDistributorSearchTerm}
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
                </div>
              </div>

              <div className="mt-2">
                <RequestsListInner
                  key={`${selectedRetailer}-${selectedDistributor}-${selectedStatus}-${selectedDate}`}
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
