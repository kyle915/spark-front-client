import { useNavigate } from "react-router";
import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import DataTableRelay from "@/shared/DataTableRelay";
import { EventTypeQuery } from "@api/queries/EventTypeQuery";
import type { EventTypeQuery as EventTypeQueryType } from "@api/queries/__generated__/EventTypeQuery.graphql";
import { eventTypeColumns } from "@/utils/columns";
import type { EventTypeRow } from "@/types/columnsTypes";
import { PencilIcon } from "@heroicons/react/24/outline";

type Props = {
  queryRef: PreloadedQuery<EventTypeQueryType>;
  currentPage: number;
  pageSize: number;
  onNext: () => void;
  onPrevious: () => void;
  onGoToPage: (page: number) => void;
  onPageLoaded: (payload: {
    pageNumber: number;
    pageInfo: { startCursor: string | null; endCursor: string | null };
    totalCount: number;
  }) => void;
  isNavigating: boolean;
};

export function EventTypesTableContent({
  queryRef,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
}: Props) {
  const navigate = useNavigate();
  const data = usePreloadedQuery<EventTypeQueryType>(EventTypeQuery, queryRef);

  return (
    <DataTableRelay<EventTypeRow>
      connection={data.eventTypes}
      columns={eventTypeColumns}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      onPageLoaded={onPageLoaded}
      isNavigating={isNavigating}
      emptyState={
        <div className="text-center text-sm text-base-content/60">
          No event types found.
        </div>
      }
      customActions={{
        headerLabel: "Actions",
        render: (row) => (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/catalogs/event-types/edit/${row.uuid}`)}
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
        ),
      }}
    />
  );
}
