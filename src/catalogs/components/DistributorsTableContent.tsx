import { useNavigate } from "react-router";
import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";

import DataTableRelay from "@/shared/DataTableRelay";
import { DistributorsQuery } from "@api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
import { PencilIcon } from "@heroicons/react/24/outline";
import type { DistributorRow } from "@/types/columnsTypes";
import { distributorColumns } from "@/utils/columns";

type Props = {
  queryRef: PreloadedQuery<DistributorsQueryType>;
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

export default function DistributorsTableContent({
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

  const data = usePreloadedQuery<DistributorsQueryType>(
    DistributorsQuery,
    queryRef,
  );

  if (!data.distributors) {
    return (
      <div className="alert alert-warning">
        <span>Distributor data is not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<DistributorRow>
      connection={data.distributors}
      columns={distributorColumns}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      onPageLoaded={onPageLoaded}
      isNavigating={isNavigating}
      emptyState={
        <div className="text-center text-sm text-base-content/60">
          No distributors found.
        </div>
      }
      customActions={{
        headerLabel: "Actions",
        render: (row) => (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/catalogs/distributors/edit/${row.uuid}`)}
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
        ),
      }}
    />
  );
}
