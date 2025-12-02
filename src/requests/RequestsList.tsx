import { Suspense, useCallback } from "react";
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
import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import CatalogsProvider from "@shared/CatalogsProvider";
import FormSelect from "@shared/FormSelect";
import FormInputText from "@shared/FormInputText";

//Icons
import {
  EyeIcon,
  CheckCircleIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

const PAGE_SIZE = 10;

type RequestsTableContentProps = {
  queryReference: PreloadedQuery<RequestsQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: (cursor: string) => void;
  onPrevious: (cursor: string) => void;
  onGoToPage: (page: number) => void;
  onPageLoaded: (payload: PageLoadedPayload) => void;
  isNavigating: boolean;
  renderRowActions?: (row: RequestRow) => ReactNode;
};

const RequestsTableContent = ({
  queryReference,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
  renderRowActions,
}: RequestsTableContentProps) => {
  const data = usePreloadedQuery<RequestsQueryType>(
    RequestsQuery,
    queryReference
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

type RequestsListInnerProps = {
  filters?: {
    tenantId?: string;
    clientId?: string;
    retailerId?: string;
    distributorId?: string;
    statusId?: string;
    date?: string;
  };
};

const RequestsListInner = ({ filters }: RequestsListInnerProps) => {
  const navigate = useNavigate();
  const handleViewRequest = useCallback(
    (request: RequestRow) => {
      console.info("Viewing request", request.uuid);
      navigate(`/request/view/${request.uuid}`);
    },
    [navigate]
  );

  const handleApproveRequest = useCallback(
    (request: RequestRow) => {
      navigate(`/event/create/${request.uuid}`);
    },
    [navigate]
  );

  const handleEditRequest = useCallback(
    (request: RequestRow) => {
      navigate(`/request/edit/${request.uuid}`);
    },
    [navigate]
  );

  const renderRequestActions = useCallback(
    (request: RequestRow) => {
      const statusName = request.status?.name?.toLowerCase();
      const isApproved = statusName === "approved" || statusName === "aprobado";

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
            className={`btn btn-xs tooltip ${
              isApproved ? "btn-disabled" : "btn-primary"
            }`}
            data-tip={isApproved ? "Already approved" : "Approve Request"}
            onClick={() => handleApproveRequest(request)}
            disabled={isApproved}
          >
            <CheckCircleIcon className="w-5 h-5" />
          </button>
        </div>
      );
    },
    [handleApproveRequest, handleViewRequest, handleEditRequest]
  );

  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    goNext,
    goPrevious,
    goToPage,
  } = useRelayPagination<RequestsQueryType>({
    query: RequestsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
  });

  return (
    <>
      <Suspense fallback={<Loading />}>
        {queryRef ? (
          <RequestsTableContent
            queryReference={queryRef}
            currentPage={displayPage}
            pageSize={PAGE_SIZE}
            onNext={goNext}
            onPrevious={goPrevious}
            onGoToPage={goToPage}
            isNavigating={isNavigating}
            onPageLoaded={handlePageLoaded}
            renderRowActions={renderRequestActions}
          />
        ) : (
          <Loading />
        )}
      </Suspense>
    </>
  );
};

const RequestsList = () => {
  const { control, watch } = useForm({
    defaultValues: {
      tenant: "",
      client: "",
      retailer: "",
      distributor: "",
      status: "",
      date: "",
    },
  });
  const selectedTenant = watch("tenant");
  //   const selectedClient = watch("client");
  const selectedRetailer = watch("retailer");
  const selectedDistributor = watch("distributor");
  const selectedStatus = watch("status");
  const selectedDate = watch("date");

  const filters = {
    tenantId: selectedTenant || undefined,
    // clientId: selectedClient || undefined,
    retailerId: selectedRetailer || undefined,
    distributorId: selectedDistributor || undefined,
    statusId: selectedStatus || undefined,
    date: selectedDate || undefined,
  };

  const catalogFilters = selectedTenant
    ? { tenantId: selectedTenant }
    : undefined;

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Requests</h1>
      </div>

      <CatalogsProvider
        tenants={true}
        clients={true}
        retailers={true}
        distributors={true}
        requestStatuses={true}
        clientsFilters={catalogFilters}
        retailersFilters={catalogFilters}
        distributorsFilters={catalogFilters}
        requestStatusesFilters={catalogFilters}
      >
        {(catalogs) => (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-200 rounded-lg">
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* <FormSelect
                control={control}
                name="client"
                label="Filter by Client"
                options={catalogs.clients.map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
                placeholder="Select a client"
              /> */}
              <FormSelect
                control={control}
                name="retailer"
                label="Filter by Retailer"
                options={catalogs.retailers.map((r) => ({
                  label: r.name,
                  value: r.id,
                }))}
                placeholder="Select a retailer"
              />
              <FormSelect
                control={control}
                name="distributor"
                label="Filter by Distributor"
                options={catalogs.distributors.map((d) => ({
                  label: d.name,
                  value: d.id,
                }))}
                placeholder="Select a distributor"
              />
              <FormSelect
                control={control}
                name="status"
                label="Filter by Status"
                options={catalogs.requestStatuses.map((s) => ({
                  label: s.name,
                  value: s.id,
                }))}
                placeholder="Select a status"
              />
              <FormInputText
                control={control}
                name="date"
                label="Filter by Date"
                type="date"
              />
            </div>
            <RequestsListInner
              key={`${selectedTenant}-${selectedRetailer}-${selectedDistributor}-${selectedStatus}-${selectedDate}`}
              filters={filters}
            />
          </div>
        )}
      </CatalogsProvider>
    </Layout>
  );
};

export default RequestsList;
