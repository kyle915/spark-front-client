import { useEffect, useMemo } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
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
import { TagIcon } from "lucide-react";
import { PencilIcon } from "@heroicons/react/24/outline";
import FormInputText from "@/shared/FormInputText";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";

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

const ProductTypesTable = ({ tenantId }: { tenantId: string }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const productTypes = useMemo(
    () => data.productTypes.edges.map((edge) => edge.node),
    [data]
  );

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {productTypes.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center text-sm text-base-content/70"
                  >
                    No product types for this tenant.
                  </td>
                </tr>
              )}
              {productTypes.map((type) => (
                <tr key={type.id}>
                  <td>{type.name}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        navigate(`/catalogs/product-types/edit/${type.uuid}`)
                      }
                    >
                      <PencilIcon className="w-4 h-4" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

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
        <ProductTypesTable tenantId={tenantId || ""} />
      )}
    </Layout>
  );
};

export const CreateProductType = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();

  const [commitCreate, isCreating] = useMutation<CreateProductTypeMutationType>(
    CreateProductTypeMutation
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
    { fetchPolicy: "store-and-network" }
  );

  const productType = data.productType;

  const [commitUpdate, isUpdating] = useMutation<UpdateProductTypeMutationType>(
    UpdateProductTypeMutation
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
