import { useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { fetchQuery, graphql } from "react-relay";
import { useForm } from "react-hook-form";
import { ProductsQuery } from "@api/queries/ProductsQuery";
import { DeleteProductMutation } from "@api/mutations/DeleteProductMutation";
import { UpdateProductMutation } from "@api/mutations/UpdateProductMutation";
import { ProductTypesQuery } from "@api/queries/ProductTypesQuery";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import type { DeleteProductMutation as DeleteProductMutationType } from "@api/mutations/__generated__/DeleteProductMutation.graphql";
import type { UpdateProductMutation as UpdateProductMutationType } from "@api/mutations/__generated__/UpdateProductMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import ConfirmationModal from "./ConfirmationModal";
import ImageUpload from "./ImageUpload";
import LoadingButton from "./LoadingButton";
import environment from "@api/relay/environment";

type ProductNode = {
  id: string;
  name: string;
  image?: string | null;
  productType?: {
    id: string;
    name: string;
  } | null;
};

type ProductsQueryType = {
  response: {
    products?: {
      totalCount?: number | null;
      pageInfo?: {
        hasNextPage?: boolean | null;
        hasPreviousPage?: boolean | null;
        startCursor?: string | null;
        endCursor?: string | null;
      } | null;
      edges?: ({ node?: ProductNode | null } | null)[] | null;
    } | null;
  };
  variables: {
    first?: number | null;
    after?: string | null;
    last?: number | null;
    before?: string | null;
    filters?: {
      tenantId?: string | null;
      tenantUuid?: string | null;
      clientMutationId?: string | null;
      productTypeId?: string | null;
    } | null;
  };
};

type TenantProductsGridProps = {
  tenantId: string;
  onDeleted?: () => void;
  refreshKey?: number;
  onUpdated?: () => void;
  productTypeIdFilter?: string;
  hideTypeFilter?: boolean;
};

type DeleteProductProps = {
  productId: string;
  productName: string;
  onDeleted: () => void;
};

const PAGE_SIZE = 9;

const DeleteProductButton = ({
  productId,
  productName,
  onDeleted,
}: DeleteProductProps) => {
  const { showAlert } = useAlertStore();
  const [commitDelete, isDeleting] = useMutation<DeleteProductMutationType>(
    DeleteProductMutation
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleDelete = () => {
    commitDelete({
      variables: { input: { id: productId } },
      onCompleted: (response) => {
        const deleteResp = response.deleteProduct;
        if (deleteResp?.success) {
          showAlert(deleteResp.message, "success");
          onDeleted();
        } else {
          showAlert(deleteResp?.message ?? "Failed to delete product", "error");
        }
      },
      onError: (error) => {
        showAlert(`Error deleting product: ${error.message}`, "error");
      },
    });
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm text-error"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isDeleting}
        title={`Delete ${productName}`}
      >
        {isDeleting ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          "Delete"
        )}
      </button>
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete product"
        message={`Are you sure you want to delete "${productName}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="btn-error"
      />
    </>
  );
};

type EditProductFormValues = {
  name: string;
  productTypeId: string;
};

type GetUploadUrlQueryType = {
  response: {
    getUploadUrl?: {
      uploadUrl: string;
      blobName: string;
    } | null;
  };
  variables: {
    filePath: string;
    contentType: string;
  };
};

const GetUploadUrlQuery = graphql`
  query TenantProductsGrid_GetUploadUrlQuery(
    $filePath: String!
    $contentType: String!
  ) {
    getUploadUrl(filePath: $filePath, contentType: $contentType) {
      uploadUrl
      blobName
    }
  }
`;

type EditProductModalProps = {
  product: ProductNode;
  tenantId: string;
  onClose: () => void;
  onUpdated: () => void;
};

const EditProductModal = ({
  product,
  tenantId,
  onClose,
  onUpdated,
}: EditProductModalProps) => {
  const { showAlert } = useAlertStore();
  const [commitUpdate, isUpdating] = useMutation<UpdateProductMutationType>(
    UpdateProductMutation
  );
  const [loading, setLoading] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditProductFormValues>({
    defaultValues: {
      name: product.name,
      productTypeId: product.productType?.id ?? "",
    },
  });

  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const productTypeOptions = useMemo(
    () =>
      productTypesData.productTypes.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    [productTypesData]
  );

  const isBusy = loading || isUpdating;

  const onSubmit = (values: EditProductFormValues) => {
    setLoading(true);
    const uploadImageIfNeeded = async (): Promise<string | null> => {
      if (selectedImageFile) {
        const timestamp = Date.now();
        const fileName = `products/${timestamp}_${selectedImageFile.name}`;
        const uploadData = await fetchQuery<GetUploadUrlQueryType>(
          environment,
          GetUploadUrlQuery,
          {
            filePath: fileName,
            contentType: selectedImageFile.type,
          }
        ).toPromise();

        const uploadUrl = uploadData?.getUploadUrl?.uploadUrl;
        const blobName = uploadData?.getUploadUrl?.blobName;

        if (!uploadUrl || !blobName) {
          throw new Error("Unable to get upload URL.");
        }

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedImageFile.type },
          body: selectedImageFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload image to storage.");
        }

        return blobName;
      }

      if (removeImage) {
        return null;
      }

      return product.image ?? null;
    };

    uploadImageIfNeeded()
      .then((imageBlob) => {
        commitUpdate({
          variables: {
            input: {
              id: product.id,
              name: values.name,
              productTypeId: values.productTypeId,
              tenantId,
              image: imageBlob,
            },
          },
          onCompleted: (response) => {
            const updateResp = response.updateProduct;
            if (updateResp?.success) {
              showAlert(updateResp.message, "success");
              onUpdated();
              onClose();
            } else {
              showAlert(
                updateResp?.message ?? "Failed to update product",
                "error"
              );
            }
            setLoading(false);
          },
          onError: (error) => {
            showAlert(`Error updating product: ${error.message}`, "error");
            setLoading(false);
          },
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Error uploading image.";
        showAlert(message, "error");
        setLoading(false);
      });
  };

  return (
    <dialog open className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Edit product</h3>
        <form className="space-y-4 mt-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Name</span>
            </label>
            <input
              className={`input input-bordered w-full ${
                errors.name ? "input-error" : ""
              }`}
              {...register("name", {
                required: "Name is required",
                minLength: { value: 2, message: "Min 2 characters" },
              })}
            />
            {errors.name && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.name.message}
                </span>
              </label>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Product type</span>
            </label>
            <select
              className={`select select-bordered w-full ${
                errors.productTypeId ? "select-error" : ""
              }`}
              {...register("productTypeId", {
                required: "Product type is required",
              })}
            >
              <option value="">Select a type</option>
              {productTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.productTypeId && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {errors.productTypeId.message}
                </span>
              </label>
            )}
          </div>

          <ImageUpload
            currentImage={product.image ?? null}
            onImageSelected={(file) => {
              setSelectedImageFile(file);
              setRemoveImage(file === null);
            }}
            onError={(err) => showAlert(err, "error")}
          />

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <LoadingButton type="submit" loading={isBusy} text="Save" />
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
};

const TenantProductsGrid = ({
  tenantId,
  onDeleted,
  refreshKey = 0,
  onUpdated,
  productTypeIdFilter,
  hideTypeFilter = false,
}: TenantProductsGridProps) => {
  const [fetchKey, setFetchKey] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductNode | null>(
    null
  );
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<string>(
    productTypeIdFilter ?? ""
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    first: number | null;
    after: string | null;
    last: number | null;
    before: string | null;
  }>({
    first: PAGE_SIZE,
    after: null,
    last: null,
    before: null,
  });
  const combinedFetchKey = fetchKey + refreshKey;

  useEffect(() => {
    setSelectedProductTypeId(productTypeIdFilter ?? "");
    setPagination({
      first: PAGE_SIZE,
      after: null,
      last: null,
      before: null,
    });
    setCurrentPage(1);
  }, [tenantId, productTypeIdFilter]);

  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const productTypeOptions = useMemo(() => {
    const edges = productTypesData?.productTypes?.edges ?? [];
    return [
      { value: "", label: "All types" },
      ...edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    ];
  }, [productTypesData]);

  const variables = useMemo(
    () => ({
      first: pagination.first,
      after: pagination.after,
      last: pagination.last,
      before: pagination.before,
      filters: {
        tenantId,
        ...(selectedProductTypeId
          ? { productTypeId: selectedProductTypeId }
          : {}),
      },
    }),
    [
      pagination.after,
      pagination.before,
      pagination.first,
      pagination.last,
      selectedProductTypeId,
      tenantId,
    ]
  );

  const fetchKeyWithPage = useMemo(
    () =>
      `${combinedFetchKey}-${currentPage}-${pagination.after ?? ""}-${
        pagination.before ?? ""
      }`,
    [combinedFetchKey, currentPage, pagination.after, pagination.before]
  );

  const data = useLazyLoadQuery<ProductsQueryType>(ProductsQuery, variables, {
    fetchPolicy: "store-and-network",
    fetchKey: fetchKeyWithPage,
  });

  const products: ProductNode[] =
    data?.products?.edges?.flatMap(
      (edge: { node?: ProductNode | null } | null) =>
        edge?.node ? [edge.node] : []
    ) ?? [];

  const pageInfo = data?.products?.pageInfo;
  const totalCount = data?.products?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleDeleted = () => {
    setFetchKey((prev) => prev + 1);
    onDeleted?.();
  };

  const handleUpdated = () => {
    setFetchKey((prev) => prev + 1);
    onUpdated?.();
  };

  const handleNextPage = () => {
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) {
      return;
    }
    setPagination({
      first: PAGE_SIZE,
      after: pageInfo.endCursor,
      last: null,
      before: null,
    });
    setCurrentPage((prev) => prev + 1);
  };

  const handlePreviousPage = () => {
    if (!pageInfo?.hasPreviousPage || !pageInfo.startCursor) {
      return;
    }
    setPagination({
      first: null,
      after: null,
      last: PAGE_SIZE,
      before: pageInfo.startCursor,
    });
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleFilterChange = (value: string) => {
    setSelectedProductTypeId(value);
    setPagination({
      first: PAGE_SIZE,
      after: null,
      last: null,
      before: null,
    });
    setCurrentPage(1);
  };

  return (
    <div className="mt-6">
      {!hideTypeFilter && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="form-control w-full max-w-xs">
            <div className="label">
              <span className="label-text font-medium">Filter by type</span>
            </div>
            <select
              className="select select-bordered w-full"
              value={selectedProductTypeId}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              {productTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm text-base-content/70">
            Total: {totalCount}
          </div>
        </div>
      )}

      {hideTypeFilter && (
        <div className="text-sm text-base-content/70 mb-2">
          Total: {totalCount}
        </div>
      )}

      {products.length === 0 ? (
        <div className="alert alert-info mt-4">
          <span>No products found for this tenant.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="card bg-base-200/70 border border-base-300/60 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="card-body flex-row items-center gap-6 p-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-base-300/60 flex items-center justify-center overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-sm text-base-content/60 text-center px-2">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">
                    {product.name}
                  </div>
                  <div className="text-sm text-base-content/60 truncate">
                    {product.productType?.name ?? "Uncategorized"}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingProduct(product)}
                  >
                    Edit
                  </button>
                  <DeleteProductButton
                    productId={product.id}
                    productName={product.name}
                    onDeleted={handleDeleted}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          type="button"
          className="btn btn-ghost btn-sm border border-base-300"
          onClick={handlePreviousPage}
          disabled={!pageInfo?.hasPreviousPage}
        >
          Previous
        </button>
        <span className="text-sm text-base-content/80">
          Page {currentPage} of {Math.max(totalPages, currentPage)}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm border border-base-300"
          onClick={handleNextPage}
          disabled={!pageInfo?.hasNextPage}
        >
          Next
        </button>
      </div>

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          tenantId={tenantId}
          onClose={() => setEditingProduct(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
};

export default TenantProductsGrid;
