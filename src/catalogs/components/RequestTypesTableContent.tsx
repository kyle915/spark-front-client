import { useNavigate } from "react-router";
import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import DataTableRelay from "@/shared/DataTableRelay";
import { RequestTypesQuery } from "@api/queries/RequestTypesQuery";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import { requestTypeColumns } from "@/utils/columns";
import type { RequestTypeRow } from "@/types/columnsTypes";
import { PencilIcon } from "@heroicons/react/24/outline";

type Props = {
  queryRef: PreloadedQuery<RequestTypesQueryType>;
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

export function RequestTypesTableContent({
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
  const data = usePreloadedQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    queryRef,
  );

  return (
    <DataTableRelay<RequestTypeRow>
      connection={data.requestTypes}
      columns={requestTypeColumns}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      onPageLoaded={onPageLoaded}
      isNavigating={isNavigating}
      emptyState={
        <div className="text-center text-sm text-base-content/60">
          No request types found.
        </div>
      }
      customActions={{
        headerLabel: "Actions",
        render: (row) => (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/catalogs/request-types/edit/${row.uuid}`)}
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
        ),
      }}
    />
  );
}
