import SparkOverlay from "@/shared/SparkOverlay";
import { useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
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
import ConfirmationModal from "../shared/ConfirmationModal";
import ImageUpload from "../shared/ImageUpload";
import LoadingButton from "../shared/LoadingButton";
import environment from "@api/relay/environment";
import { Edit, ImageOff, Trash2Icon } from "lucide-react";

type ProductNode = {
  id: string;
  name: string;
  description?: string | null;
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
          <>
            <Trash2Icon className="w-4 h-4" />
            Delete
          </>
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
  description: string;
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
      description: product.description ?? "",
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
              description: values.description.trim() || null,
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
    <SparkOverlay onClose={onClose} size="md" label="Edit product">
      <div>
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

          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              rows={3}
              className="textarea textarea-bordered w-full"
              placeholder="Short description shown with this product…"
              {...register("description")}
            />
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
    </SparkOverlay>
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

  const gridVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05,
      },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1], // ✅ easeOut válido
      },
    },
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
        <div className="flex text-sm text-base-content/70 mb-2 justify-end">
          Total: {totalCount}
        </div>
      )}

      {products.length === 0 ? (
        <div className="alert alert-info mt-4">
          <span>No products found for this tenant.</span>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4"
          variants={gridVariants}
          initial="hidden"
          animate="visible"
        >
          {products.map((product) => (
            <motion.div
              key={product.id}
              variants={cardVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group card bg-base-100 border border-base-300/70 shadow-sm transition-all duration-200 hover:shadow-xl hover:border-primary/50"
            >
              <div className="card-body p-4 flex flex-col">
                {/* Imagen */}
                <div className="relative rounded-2xl overflow-hidden border border-base-300/70 bg-base-200">
                  {/* Badge categoría */}
                  <span
                    className="
                      absolute top-2 right-2 z-10
                      badge badge-dash badge-primary
                      max-w-[180px] truncate whitespace-nowrap
                    "
                    title={product.productType?.name ?? "Uncategorized"}
                  >
                    {product.productType?.name ?? "Uncategorized"}
                  </span>

                  <div className="aspect-square w-full flex items-center justify-center">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div>
                        <ImageOff className="w-12 h-12 text-base-content/20" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="card-body p-4 flex flex-col">
                  <div className="mt-3 font-semibold text-base leading-snug line-clamp-2">
                    {product.name}
                  </div>
                  {product.productType?.name ? (
                    <div className="mt-1 text-[11px] uppercase tracking-wide text-base-content/50">
                      {product.productType.name}
                    </div>
                  ) : null}
                  {product.description ? (
                    <p className="mt-1 text-sm text-base-content/70 line-clamp-3">
                      {product.description}
                    </p>
                  ) : null}

                  <div className="mt-auto pt-4 border-t border-base-300/50 flex justify-between">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline bg-primary text-white"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Edit className="w-4 h-4" />
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
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="flex items-center justify-center gap-4 mt-6 mb-6">
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
