import { Suspense, useCallback, useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import DataTableRelay from "@/shared/DataTableRelay";
import Layout from "@/layout/Layout";
import { TenantsQuery } from "@/api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import Loading from "@shared/Loading";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import { usePreloadedQuery, useQueryLoader } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import type { TenantRow } from "../types/columnsTypes";
import { tenantColumns } from "@/utils/columns";
import { useForm } from "react-hook-form";
import FormInputText from "@/shared/FormInputText";
import LoadingButton from "@/shared/LoadingButton";
import { useNavigate } from "react-router";
import { PencilIcon } from "@heroicons/react/24/outline";

const PAGE_SIZE = 10;

type TenantsTableContentProps = {
  queryReference: PreloadedQuery<TenantsQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: (cursor: string) => void;
  onPrevious: (cursor: string) => void;
  onGoToPage: (page: number) => void;
  onPageLoaded: (payload: PageLoadedPayload) => void;
  isNavigating: boolean;
  renderRowActions?: (row: TenantRow) => ReactNode;
};

const TenantsTableContent = ({
  queryReference,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
  renderRowActions,
}: TenantsTableContentProps) => {
  const data = usePreloadedQuery<TenantsQueryType>(
    TenantsQuery,
    queryReference
  );
  const connection = data.tenants;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>Tenant data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<TenantRow>
      connection={connection}
      columns={tenantColumns}
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

type TenantsListInnerProps = {
  filters?: {
    name?: string;
    requestUrlName?: string;
  };
  refreshKey?: number;
};

const TenantsListInner = ({
  filters,
  refreshKey = 0,
}: TenantsListInnerProps) => {
  const [, loadQuery] = useQueryLoader<TenantsQueryType>(TenantsQuery);
  const lastRefreshKeyRef = useRef(0);

  // Force reload when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0 && refreshKey !== lastRefreshKeyRef.current) {
      lastRefreshKeyRef.current = refreshKey;
      loadQuery(
        {
          filters,
          first: PAGE_SIZE,
          after: null,
          last: undefined,
          before: undefined,
        },
        { fetchPolicy: "network-only" }
      );
    }
  }, [refreshKey, filters, loadQuery]);

  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    goNext,
    goPrevious,
    goToPage,
  } = useRelayPagination<TenantsQueryType>({
    query: TenantsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
  });

  const navigate = useNavigate();

  const handleEditTenant = useCallback(
    (tenant: TenantRow) => {
      if (tenant.uuid) {
        navigate(`/tenants/edit/${tenant.uuid}`);
      }
    },
    [navigate]
  );

  const renderTenantActions = useCallback(
    (tenant: TenantRow) => (
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={() => handleEditTenant(tenant)}
          title="Edit Tenant"
        >
          <PencilIcon className="w-5 h-5" />
        </button>
      </div>
    ),
    [handleEditTenant]
  );

  return (
    <>
      <Suspense fallback={<Loading />}>
        {queryRef ? (
          <TenantsTableContent
            queryReference={queryRef}
            currentPage={displayPage}
            pageSize={PAGE_SIZE}
            onNext={goNext}
            onPrevious={goPrevious}
            onGoToPage={goToPage}
            isNavigating={isNavigating}
            onPageLoaded={handlePageLoaded}
            renderRowActions={renderTenantActions}
          />
        ) : (
          <Loading />
        )}
      </Suspense>
    </>
  );
};

// Export this component for use without Layout
export const TenantsListContent = ({
  refreshTrigger,
}: {
  refreshTrigger?: number;
}) => {
  const [refreshKey, setRefreshKey] = useState(refreshTrigger ?? 0);

  // Check if we need to refresh when component mounts
  useEffect(() => {
    const refreshFlag = sessionStorage.getItem("tenants_refresh");
    if (refreshFlag) {
      sessionStorage.removeItem("tenants_refresh");
      setRefreshKey((prev) => prev + 1);
    }
  }, []);

  // Update refreshKey when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      setRefreshKey(refreshTrigger);
    }
  }, [refreshTrigger]);

  const { control, watch } = useForm({
    defaultValues: {
      name: "",
      requestUrlName: "",
    },
  });

  const selectedName = watch("name");
  const selectedRequestUrlName = watch("requestUrlName");

  const filters = {
    name: selectedName || undefined,
    requestUrlName: selectedRequestUrlName || undefined,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-base-200 rounded-lg p-4">
        <FormInputText
          control={control}
          name="name"
          label="Filter by Name"
          placeholder=""
        />
        <FormInputText
          control={control}
          placeholder=""
          name="requestUrlName"
          label="Filter by Request URL Name"
        />
      </div>
      <TenantsListInner
        key={`${selectedName}-${selectedRequestUrlName}-${refreshKey}`}
        filters={filters}
        refreshKey={refreshKey}
      />
    </div>
  );
};

const TenantsList = () => {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Tenants</h1>
      </div>
      <div className="mb-4 flex justify-end">
        <LoadingButton
          onClick={() => navigate("/tenants/create")}
          className="mb-4"
          text="Create Tenant"
        />
      </div>
      <TenantsListContent />
    </Layout>
  );
};

export default TenantsList;
