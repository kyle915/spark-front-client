import { useEffect, useMemo } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
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

type ProductTypeFormValues = {
  name: string;
  tenantId: string;
};

type ProductTypeFormProps = {
  defaultValues: ProductTypeFormValues;
  onSubmit: (values: ProductTypeFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
};

const ProductTypeForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
}: ProductTypeFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductTypeFormValues>({
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="form-control gap-2 p-2">
        <div className="flex flex-row items-center gap-x-4">
          <label className="label p-0">
            <span className="label-text">Name</span>
          </label>

          <input
            type="text"
            className="input input-bordered"
            {...register("name", { required: "Name is required" })}
          />
        </div>
        {errors.name && (
          <span className="text-error text-sm">{errors.name.message}</span>
        )}
      </div>

      <div className="flex justify-end">
        <LoadingButton
          type="submit"
          loading={isSubmitting}
          text={submitLabel}
        />
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
            <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <TagIcon className="w-8 h-8" />
              <h1>Product Types</h1>
            </span>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Product Type</h1>
        <p className="text-sm text-base-content/70">
          Assign the product type to a tenant.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <ProductTypeForm
            defaultValues={{ name: "", tenantId: initialTenantId }}
            onSubmit={handleSubmit}
            submitLabel="Create"
            isSubmitting={isCreating}
          />
        </div>
      </div>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Product Type</h1>
        <p className="text-sm text-base-content/70">
          Update the name or tenant for this product type.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <ProductTypeForm
            defaultValues={{
              name: productType.name,
              tenantId: productType.tenantId,
            }}
            onSubmit={handleSubmit}
            submitLabel="Update"
            isSubmitting={isUpdating}
          />
        </div>
      </div>
    </Layout>
  );
};
