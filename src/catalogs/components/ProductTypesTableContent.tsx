import { useNavigate } from "react-router";
import { usePreloadedQuery } from "react-relay/hooks";
import type { PreloadedQuery } from "react-relay";
import DataTableRelay from "@/shared/DataTableRelay";
import { ProductTypesQuery } from "@api/queries/ProductTypesQuery";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import { productTypeColumns } from "@/utils/columns";
import type { ProductTypeRow } from "@/types/columnsTypes";
import { PencilIcon } from "@heroicons/react/24/outline";

type Props = {
  queryRef: PreloadedQuery<ProductTypesQueryType>;
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

export function ProductTypesTableContent({
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
  const data = usePreloadedQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    queryRef,
  );

  const connection = data.productTypes;

  if (!connection) {
    return (
      <div className="alert alert-warning">
        <span>Product types data not available.</span>
      </div>
    );
  }

  return (
    <DataTableRelay<ProductTypeRow>
      connection={connection}
      columns={productTypeColumns}
      currentPage={currentPage}
      pageSize={pageSize}
      onNext={onNext}
      onPrevious={onPrevious}
      onGoToPage={onGoToPage}
      onPageLoaded={onPageLoaded}
      isNavigating={isNavigating}
      emptyState={
        <div className="text-center text-sm text-base-content/60">
          No product types found.
        </div>
      }
      customActions={{
        headerLabel: "Actions",
        render: (row) => (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/catalogs/product-types/edit/${row.uuid}`)}
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
        ),
      }}
    />
  );
}
