import { Suspense, useEffect, useRef } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import LoadingButton from "@shared/LoadingButton";
import { ProductTypesQuery } from "@api/queries/ProductTypesQuery";
import type { ProductTypesQuery as ProductTypesQueryType } from "@api/queries/__generated__/ProductTypesQuery.graphql";
import { ProductTypeByIdQuery } from "@api/queries/ProductTypeByIdQuery";
import type { ProductTypeByIdQuery as ProductTypeByIdQueryType } from "@api/queries/__generated__/ProductTypeByIdQuery.graphql";
import { CreateProductTypeMutation } from "@api/mutations/CreateProductTypeMutation";
import type { CreateProductTypeMutation as CreateProductTypeMutationType } from "@api/mutations/__generated__/CreateProductTypeMutation.graphql";
import { UpdateProductTypeMutation } from "@api/mutations/UpdateProductTypeMutation";
import type { UpdateProductTypeMutation as UpdateProductTypeMutationType } from "@api/mutations/__generated__/UpdateProductTypeMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import { useAuthStore } from "@/store/authStore";
import { PlusCircle, TagIcon } from "lucide-react";
import { PencilIcon } from "@heroicons/react/24/outline";
import FormInputText from "@/shared/FormInputText";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useRelayPagination } from "@/hooks/useRelayPagination";
import Loading from "@/shared/Loading";
import { ProductTypesTableContent } from "./components/ProductTypesTableContent";

type ProductTypeFormValues = {
  name: string;
  tenantId: string;
};

type ProductTypeFormProps = {
  defaultValues: ProductTypeFormValues;
  onSubmit: (values: ProductTypeFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
};

const ProductTypeForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  mode = "create",
}: ProductTypeFormProps) => {
  const { control, handleSubmit, reset } = useForm<ProductTypeFormValues>({
    defaultValues,
  });

  const isEdit = mode === "edit";

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          {/* HEADER */}
          <div className="flex flex-col gap-4 border-b border-base-100/20">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/catalogs/product-types/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <PencilIcon className="w-6 h-6" />
                  <h1>
                    {isEdit ? "Edit Product Type" : "Create Product Type"}
                  </h1>
                </span>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {isEdit
                  ? "Update the information and behavior of this product type."
                  : "Define and configure the product type behavior."}
              </p>
            </div>
          </div>

          {/* SECTION: BASIC INFORMATION */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Basic Information</p>
              <span className="text-xs text-base-content/60">
                Required fields
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInputText
                control={control}
                name="name"
                label="Product Type Name"
                placeholder="e.g., Electronics"
                rules={{
                  required: "Name is required",
                  minLength: {
                    value: 2,
                    message: "Name must be at least 2 characters",
                  },
                }}
              />
            </div>
          </section>

          {/* FOOTER ACTIONS */}
          <div className="pt-2 flex items-center justify-end">
            <LoadingButton
              type="submit"
              loading={isSubmitting}
              text={submitLabel}
            />
          </div>
        </div>
      </div>
    </form>
  );
};

const PAGE_SIZE = 10;

export function ProductTypesTable({
  tenantId,
  q,
  onRefreshReady,
}: {
  tenantId: string;
  q: string;
  onRefreshReady?: (fn: () => void) => void;
}) {
  const {
    queryRef,
    displayPage,
    isNavigating,
    handlePageLoaded,
    goNext,
    goPrevious,
    goToPage,
    refresh,
  } = useRelayPagination<ProductTypesQueryType>({
    query: ProductTypesQuery,
    pageSize: PAGE_SIZE,
    initialVariables: {
      filters: { tenantId },
      q: q || undefined,
    },
  });

  useEffect(() => {
    onRefreshReady?.(refresh);
  }, [onRefreshReady, refresh]);

  return (
    <Suspense fallback={<Loading />}>
      {queryRef && (
        <ProductTypesTableContent
          queryRef={queryRef}
          currentPage={displayPage}
          pageSize={PAGE_SIZE}
          onNext={goNext}
          onPrevious={goPrevious}
          onGoToPage={goToPage}
          onPageLoaded={handlePageLoaded}
          isNavigating={isNavigating}
        />
      )}
    </Suspense>
  );
}

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export function ProductTypesPage() {
  const { tenantId } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawQ = searchParams.get("q") ?? "";
  const q = useDebouncedValue(rawQ, 400);

  const refreshRef = useRef<null | (() => void)>(null);

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-2">
        <input
          className="input input-bordered input-sm w-64"
          placeholder="Search product types..."
          value={rawQ}
          onChange={(e) => {
            const value = e.target.value;
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              if (value) next.set("q", value);
              else next.delete("q");
              return next;
            });
          }}
        />

        <button
          type="button"
          className="btn btn-sm btn-outline gap-2"
          onClick={() => refreshRef.current?.()}
        >
          <ArrowPathIcon className="w-4 h-4" />
          Reload
        </button>
      </div>

      <ProductTypesTable
        key={q}
        tenantId={tenantId ?? ""}
        q={q}
        onRefreshReady={(fn) => {
          refreshRef.current = fn;
        }}
      />
    </>
  );
}

export const ProductTypesList = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center w-full justify-between">
          <div>
            <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <TagIcon className="w-8 h-8" />
              </div>
              <h1>Product Types</h1>
            </div>
            <p className="text-base-content/70">
              Manage and organize your product types.
            </p>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/catalogs/product-types/create")}
            >
              <PlusCircle className="w-4 h-4" />
              New Product Type
            </button>
          </div>
        </div>
      </div>

      {!tenantId ? (
        <div className="alert alert-warning">
          <span>Select a tenant to see the list.</span>
        </div>
      ) : (
        <ProductTypesPage />
      )}
    </Layout>
  );
};

export const CreateProductType = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  const [commitCreate, isCreating] = useMutation<CreateProductTypeMutationType>(
    CreateProductTypeMutation,
  );

  const initialTenantId = tenantId || "";

  const handleSubmit = (values: ProductTypeFormValues) => {
    commitCreate({
      variables: { input: values },
      onCompleted: (response) => {
        const payload = response.createProductType;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/product-types/list");
        } else {
          showAlert(payload?.message ?? "Error creating product type", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  };

  return (
    <Layout>
      <ProductTypeForm
        defaultValues={{ name: "", tenantId: initialTenantId }}
        onSubmit={handleSubmit}
        submitLabel="Create"
        isSubmitting={isCreating}
      />
    </Layout>
  );
};

export const EditProductType = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<ProductTypeByIdQueryType>(
    ProductTypeByIdQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" },
  );

  const productType = data.productType;

  const [commitUpdate, isUpdating] = useMutation<UpdateProductTypeMutationType>(
    UpdateProductTypeMutation,
  );

  const handleSubmit = (values: ProductTypeFormValues) => {
    if (!productType?.id) return;

    commitUpdate({
      variables: {
        input: {
          id: productType.id,
          name: values.name,
          tenantId: values.tenantId,
        },
      },
      onCompleted: (response) => {
        const payload = response.updateProductType;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/product-types/list");
        } else {
          showAlert(payload?.message ?? "Error updating product type", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  };

  if (!productType) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Product type not found.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ProductTypeForm
        defaultValues={{
          name: productType.name,
          tenantId: productType.tenantId,
        }}
        onSubmit={handleSubmit}
        submitLabel="Update"
        isSubmitting={isUpdating}
        mode="edit"
      />
    </Layout>
  );
};
