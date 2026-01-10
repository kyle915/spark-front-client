import { Suspense, useCallback, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import {
  useLazyLoadQuery,
  useMutation,
  usePreloadedQuery,
} from "react-relay/hooks";
import DataTableRelay from "@/shared/DataTableRelay";
import {
  useRelayPagination,
  type PageLoadedPayload,
} from "@/hooks/useRelayPagination";
import Loading from "@/shared/Loading";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { RecapsQuery as RecapsQueryType } from "@/api/queries/__generated__/RecapsQuery.graphql";
import { ApproveRecapMutation } from "@api/mutations/ApproveRecapMutation";
import type { ApproveRecapMutation as ApproveRecapMutationType } from "@api/mutations/__generated__/ApproveRecapMutation.graphql";
import type { PreloadedQuery } from "react-relay";
import type { RecapRow } from "@/types/columnsTypes";
import { createRecapColumns } from "@/utils/columns";
import { CameraIcon } from "@heroicons/react/24/solid";
import {
  CheckCircleIcon,
  EyeIcon,
  PencilIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { FilterIcon, FunnelXIcon } from "lucide-react";
import { useAlertStore } from "@/store/alertStore";

const PAGE_SIZE = 10;

// ======================================================
// TABLE CONTENT
// ======================================================
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
  onApprove: (recap: RecapRow) => void;
  onDecline: (recap: RecapRow) => void;
  approvingId: string | null;
  targetApproval: boolean | null;
  isApproving: boolean;
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
  onApprove,
  onDecline,
  approvingId,
  targetApproval,
  isApproving,
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
            <button
              type="button"
              className="btn btn-xs btn-outline btn-success tooltip disabled:text-success/50 hover:text-white"
              onClick={() => onApprove(row)}
              disabled={isApproving || Boolean(row.approved)}
              data-tip={row.approved ? "Already approved" : "Approve recap"}
              aria-label="Approve recap"
            >
              {isApproving &&
              approvingId === row.id &&
              targetApproval === true ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <CheckCircleIcon className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              className="btn btn-xs btn-outline btn-error tooltip disabled:text-error/50 hover:text-white"
              onClick={() => onDecline(row)}
              disabled={isApproving || !row.approved}
              data-tip={!row.approved ? "Already declined" : "Decline recap"}
              aria-label="Decline recap"
            >
              {isApproving &&
              approvingId === row.id &&
              targetApproval === false ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <XCircleIcon className="w-5 h-5" />
              )}
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

// ======================================================
// LIST INNER (PAGINATION)
// ======================================================
type RecapsListInnerProps = {
  filters?: {
    eventId?: string;
  };
  emptyMessage: string;
};

const RecapsListInner = ({ filters, emptyMessage }: RecapsListInnerProps) => {
  const showAlert = useAlertStore((state) => state.showAlert);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [targetApproval, setTargetApproval] = useState<boolean | null>(null);
  const [commitApprove, isApproving] =
    useMutation<ApproveRecapMutationType>(ApproveRecapMutation);
  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    refresh,
    goNext,
    goPrevious,
    goToPage,
  } = useRelayPagination<RecapsQueryType>({
    query: RecapsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: { filters },
  });

  const handleSetRecapApproval = useCallback(
    (recap: RecapRow, approved: boolean) => {
      if (!recap.id) return;

      setApprovingId(recap.id);
      setTargetApproval(approved);
      commitApprove({
        variables: { input: { id: recap.id, approved } },
        onCompleted: (response) => {
          const payload = response.approveRecap;
          if (payload.success) {
            showAlert(
              payload.message ?? "Recap updated successfully",
              "success"
            );
            refresh();
          } else {
            showAlert(
              payload.message ?? "Failed to update recap status",
              "error"
            );
          }
          setApprovingId(null);
          setTargetApproval(null);
        },
        onError: (error) => {
          showAlert(error.message, "error");
          setApprovingId(null);
          setTargetApproval(null);
        },
      });
    },
    [commitApprove, refresh, showAlert]
  );

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
          onApprove={(recap) => handleSetRecapApproval(recap, true)}
          onDecline={(recap) => handleSetRecapApproval(recap, false)}
          approvingId={approvingId}
          targetApproval={targetApproval}
          isApproving={isApproving}
        />
      ) : (
        <Loading />
      )}
    </Suspense>
  );
};

// ======================================================
// PAGE
// ======================================================
const RecapList = () => {
  const { tenantId } = useAuthStore();

  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // =========================
  // EVENTS (FROM TENANT)
  // =========================
  const eventsData = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    {
      filters: { tenantId: tenantId || undefined },
    },
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
            ? `${edge.node.name} – ${dateLabel}`
            : edge.node.name,
        };
      }),
    [eventsData]
  );

  const filters = selectedEventId ? { eventId: selectedEventId } : undefined;

  const emptyMessage = selectedEventId
    ? "No recaps found for this event."
    : "No recaps found.";

  return (
    <Layout>
      {/* =========================
          HEADER
      ========================= */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <CameraIcon className="w-6 h-6" />
          </div>
          <h1>Recaps</h1>
        </div>
        <p className="text-base-content/70">
          Manage your event recaps and summaries.
        </p>
      </div>

      {/* =========================
          FILTERS
      ========================= */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-base-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <FilterIcon className="w-4 h-4" />
              <h2 className="text-sm font-semibold text-base-content/70">
                Filters
              </h2>
            </div>

            {selectedEventId && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedEventId("")}
                >
                  <FunnelXIcon className="w-4 h-4" />
                  Clear filters
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="form-control w-full sm:w-64">
              <label className="label pb-1">
                <span className="label-text">Event</span>
              </label>
              <select
                className="select select-bordered w-full rounded-full"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                disabled={eventOptions.length === 0}
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
        </div>
        <div className="mt-2">
          {/* =========================
          TABLE
      ========================= */}
          <RecapsListInner
            key={selectedEventId}
            filters={filters}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>
    </Layout>
  );
};

export default RecapList;
