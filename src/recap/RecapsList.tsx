import { Suspense, useEffect, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import { useLazyLoadQuery, usePreloadedQuery } from "react-relay/hooks";
import DataTableRelay from "@/shared/DataTableRelay";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import Loading from "@/shared/Loading";
import { TenantsQuery } from "@/api/queries/TenantsQuery";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { TenantsQuery as TenantsQueryType } from "@/api/queries/__generated__/TenantsQuery.graphql";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { RecapsQuery as RecapsQueryType } from "@/api/queries/__generated__/RecapsQuery.graphql";
import type { PreloadedQuery } from "react-relay";
import type { RecapRow } from "@/types/columnsTypes";
import { createRecapColumns } from "@/utils/columns";
import { EyeIcon, PencilIcon } from "@heroicons/react/24/solid";
import { useNavigate } from "react-router";

const PAGE_SIZE = 10;

type RecapsTableContentProps = {
  queryReference: PreloadedQuery<RecapsQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: (cursor: string | null) => void;
  onPrevious: (cursor: string | null) => void;
  onGoToPage: (page: number) => void;
  onPageLoaded: (payload: PageLoadedPayload) => void;
  isNavigating: boolean;
  emptyMessage: string;
};

const RecapsTableContent = ({
  queryReference,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
  emptyMessage,
}: RecapsTableContentProps) => {
  const navigate = useNavigate();
  const data = usePreloadedQuery<RecapsQueryType>(RecapsQuery, queryReference);
  const connection = data.recaps;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>Recap data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<RecapRow>
      connection={connection}
      columns={createRecapColumns()}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      isNavigating={isNavigating}
      onPageLoaded={onPageLoaded}
      customActions={{
        headerLabel: "Actions",
        render: (row) => (
          <div className="flex gap-1">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => navigate(`/recap/view/${row.uuid}`)}
            >
              <EyeIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => navigate(`/recap/edit/${row.uuid}`)}
            >
              <PencilIcon className="w-5 h-5" />
            </button>
          </div>
        ),
      }}
      emptyState={
        <div className="alert alert-info">
          <span>{emptyMessage}</span>
        </div>
      }
    />
  );
};

type RecapsListInnerProps = {
  filters?: {
    eventId?: string;
  };
  emptyMessage: string;
};

const RecapsListInner = ({ filters, emptyMessage }: RecapsListInnerProps) => {
  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    goNext,
    goPrevious,
    goToPage,
  } = useRelayPagination<RecapsQueryType>({
    query: RecapsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
  });

  return (
    <Suspense fallback={<Loading />}>
      {queryRef ? (
        <RecapsTableContent
          queryReference={queryRef}
          currentPage={displayPage}
          pageSize={PAGE_SIZE}
          onNext={goNext}
          onPrevious={goPrevious}
          onGoToPage={goToPage}
          isNavigating={isNavigating}
          onPageLoaded={handlePageLoaded}
          emptyMessage={emptyMessage}
        />
      ) : (
        <Loading />
      )}
    </Suspense>
  );
};

const RecapList = () => {
  const tenantsData = useLazyLoadQuery<TenantsQueryType>(
    TenantsQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const tenantOptions = useMemo(
    () =>
      tenantsData.tenants.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    [tenantsData]
  );

  useEffect(() => {
    if (!selectedTenantId && tenantOptions.length > 0) {
      setSelectedTenantId(tenantOptions[0].value);
    }
  }, [selectedTenantId, tenantOptions]);

  useEffect(() => {
    setSelectedEventId("");
  }, [selectedTenantId]);

  const eventsData = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    { filters: { tenantId: selectedTenantId || undefined } },
    { fetchPolicy: "store-and-network" }
  );

  const eventOptions = useMemo(
    () =>
      eventsData.events.edges.map((edge) => {
        const dateLabel = edge.node.startTime
          ? new Date(edge.node.startTime).toLocaleDateString()
          : "";
        return {
          value: edge.node.id,
          label: dateLabel
            ? `${edge.node.name} - ${dateLabel}`
            : edge.node.name,
        };
      }),
    [eventsData]
  );

  const filters = selectedEventId ? { eventId: selectedEventId } : undefined;
  const emptyMessage = selectedEventId
    ? "No recaps found for this event."
    : "No recaps found for this tenant.";

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Recaps</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4 mb-6">
        <div className="form-control w-full sm:w-64">
          <label className="label pb-1">
            <span className="label-text">Tenant</span>
          </label>
          <select
            className="select select-bordered w-full rounded-full"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            disabled={tenantOptions.length === 0}
          >
            {tenantOptions.length === 0 && (
              <option value="">No tenants found</option>
            )}
            {tenantOptions.map((tenant) => (
              <option key={tenant.value} value={tenant.value}>
                {tenant.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-control w-full sm:w-64">
          <label className="label pb-1">
            <span className="label-text">Event</span>
          </label>
          <select
            className="select select-bordered w-full rounded-full"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={!selectedTenantId || eventOptions.length === 0}
          >
            <option value="">All events</option>
            {eventOptions.map((event) => (
              <option key={event.value} value={event.value}>
                {event.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedTenantId ? (
        <div className="alert alert-warning">
          <span>Please select a tenant to view recaps.</span>
        </div>
      ) : (
        <RecapsListInner
          key={`${selectedTenantId}-${selectedEventId}`}
          filters={filters}
          emptyMessage={emptyMessage}
        />
      )}
    </Layout>
  );
};

export default RecapList;
