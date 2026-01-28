import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import DataTableRelay from "@/shared/DataTableRelay";
import { RetailersQuery } from "@/api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@/api/queries/__generated__/RetailersQuery.graphql";
import type { RetailerRow } from "@/types/columnsTypes"; // o donde lo pongas
import { retailerColumns } from "@utils/columns";
import { PencilIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router";

type RetailersTableContentProps = {
  queryRef: PreloadedQuery<RetailersQueryType>;
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

export function RetailersTableContent({
  queryRef,
  currentPage,
  pageSize,
  onNext,
  onPrevious,
  onGoToPage,
  onPageLoaded,
  isNavigating,
}: RetailersTableContentProps) {
  const navigate = useNavigate();
  const data = usePreloadedQuery<RetailersQueryType>(RetailersQuery, queryRef);

  const connection = data.retailers;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>Retailer data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<RetailerRow>
      connection={connection}
      columns={retailerColumns}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      onPageLoaded={onPageLoaded}
      isNavigating={isNavigating}
      emptyState={
        <div className="text-center text-sm text-base-content/60">
          No retailers found.
        </div>
      }
      customActions={{
        headerLabel: "Actions",
        render: (row) => (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/catalogs/retailers/edit/${row.uuid}`)}
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
        ),
      }}
    />
  );
}
