import { useEffect, useMemo, useRef } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm, type UseFormRegister } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import LoadingButton from "@/shared/LoadingButton";
import { RetailersQuery } from "@/api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@/api/queries/__generated__/RetailersQuery.graphql";
import { RetailerByIdQuery } from "@/api/queries/RetailerByIdQuery";
import type { RetailerByIdQuery as RetailerByIdQueryType } from "@/api/queries/__generated__/RetailerByIdQuery.graphql";
import { LocationsQuery } from "@/api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@/api/queries/__generated__/LocationsQuery.graphql";
import { CreateRetailerMutation } from "@/api/mutations/CreateRetailerMutation";
import type { CreateRetailerMutation as CreateRetailerMutationType } from "@/api/mutations/__generated__/CreateRetailerMutation.graphql";
import { UpdateRetailerMutation } from "@/api/mutations/UpdateRetailerMutation";
import type { UpdateRetailerMutation as UpdateRetailerMutationType } from "@/api/mutations/__generated__/UpdateRetailerMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { PencilIcon } from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import { BuildingStorefrontIcon } from "@heroicons/react/24/solid";

type RetailerFormValues = {
  name: string;
  address: string;
  storeContact: string;
  locationId: string;
  tenantId: string;
};

type LocationSelectProps = {
  tenantId: string;
  register: UseFormRegister<RetailerFormValues>;
  error?: string;
};

const TenantLocationSelect = ({
  tenantId,
  register,
  error,
}: LocationSelectProps) => {
  const data = useLazyLoadQuery<LocationsQueryType>(
    LocationsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const locationOptions = useMemo(
    () => data.locations.edges.map((edge) => edge.node),
    [data]
  );

  return (
    <div className="form-control gap-3">
      <label className="label pb-0">
        <span className="label-text">Location</span>
      </label>
      <select
        className="select select-bordered"
        {...register("locationId", { required: "Location is required" })}
      >
        <option value="">Select a location</option>
        {locationOptions.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
      {error ? <span className="text-error text-sm mt-1">{error}</span> : null}
    </div>
  );
};

type RetailerFormProps = {
  defaultValues: RetailerFormValues;
  onSubmit: (values: RetailerFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
};

const RetailerForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
}: RetailerFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<RetailerFormValues>({
    defaultValues,
  });

  const tenantId = watch("tenantId");
  const lastTenantIdRef = useRef(defaultValues.tenantId);

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (tenantId && tenantId !== lastTenantIdRef.current) {
      setValue("locationId", "");
      lastTenantIdRef.current = tenantId;
    }
  }, [tenantId, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="form-control gap-3">
          <label className="label pb-0">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            {...register("name", { required: "Name is required" })}
          />
          {errors.name && (
            <span className="text-error text-sm mt-1">
              {errors.name.message}
            </span>
          )}
        </div>

        <div className="form-control gap-3">
          <label className="label pb-0">
            <span className="label-text">Store contact</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            {...register("storeContact", {
              required: "Store contact is required",
            })}
          />
          {errors.storeContact && (
            <span className="text-error text-sm mt-1">
              {errors.storeContact.message}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="form-control gap-3">
          <label className="label pb-0">
            <span className="label-text">Address</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            {...register("address", { required: "Address is required" })}
          />
          {errors.address && (
            <span className="text-error text-sm mt-1">
              {errors.address.message}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tenantId ? (
          <TenantLocationSelect
            tenantId={tenantId}
            register={register}
            error={errors.locationId?.message}
          />
        ) : (
          <div className="form-control gap-3">
            <label className="label pb-0">
              <span className="label-text">Location</span>
            </label>
            <input
              className="input input-bordered"
              disabled
              value="Select a tenant first"
              readOnly
            />
          </div>
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

const RetailersTable = ({ tenantId }: { tenantId: string }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<RetailersQueryType>(
    RetailersQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const retailers = useMemo(
    () => data.retailers.edges.map((edge) => edge.node),
    [data]
  );

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex items-center justify-start">
          <h2 className="card-title">Retailers</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Store Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {retailers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center text-sm text-base-content/70"
                  >
                    No retailers for this tenant.
                  </td>
                </tr>
              )}
              {retailers.map((retailer) => (
                <tr key={retailer.id}>
                  <td>{retailer.name}</td>
                  <td>{retailer.address}</td>
                  <td>{retailer.storeContact}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        navigate(`/catalogs/retailers/edit/${retailer.uuid}`)
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

export const RetailersList = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center w-full justify-between">
          <div>
            <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <BuildingStorefrontIcon className="w-8 h-8" />
              <h1>Retailers</h1>
            </span>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/catalogs/retailers/create")}
            >
              New Retailer
            </button>
          </div>
        </div>
      </div>

      {!tenantId ? (
        <div className="alert alert-warning">
          <span>Select a tenant to see the list.</span>
        </div>
      ) : (
        <RetailersTable tenantId={tenantId} />
      )}
    </Layout>
  );
};

export const CreateRetailer = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreate, isCreating] = useMutation<CreateRetailerMutationType>(
    CreateRetailerMutation
  );

  const initialTenantId = tenantId || "";

  const handleSubmit = (values: RetailerFormValues) => {
    commitCreate({
      variables: { input: values },
      onCompleted: (response) => {
        const payload = response.createRetailer;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/retailers/list");
        } else {
          showAlert(payload?.message ?? "Error creating retailer", "error");
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
        <h1 className="text-2xl font-bold">Create Retailer</h1>
        <p className="text-sm text-base-content/70">
          Assign the retailer to a tenant and location.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <RetailerForm
            defaultValues={{
              name: "",
              address: "",
              storeContact: "",
              tenantId: initialTenantId,
              locationId: "",
            }}
            onSubmit={handleSubmit}
            submitLabel="Create"
            isSubmitting={isCreating}
          />
        </div>
      </div>
    </Layout>
  );
};

export const EditRetailer = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<RetailerByIdQueryType>(
    RetailerByIdQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );

  const retailer = data.retailer;
  const [commitUpdate, isUpdating] = useMutation<UpdateRetailerMutationType>(
    UpdateRetailerMutation
  );

  const handleSubmit = (values: RetailerFormValues) => {
    if (!retailer?.id) return;

    commitUpdate({
      variables: {
        input: {
          id: retailer.id,
          name: values.name,
          address: values.address,
          storeContact: values.storeContact,
          tenantId: values.tenantId,
          locationId: values.locationId,
        },
      },
      onCompleted: (response) => {
        const payload = response.updateRetailer;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/retailers/list");
        } else {
          showAlert(payload?.message ?? "Error updating retailer", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  };

  if (!retailer) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Retailer not found.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Retailer</h1>
        <p className="text-sm text-base-content/70">
          Update retailer details for the selected tenant.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <RetailerForm
            defaultValues={{
              name: retailer.name,
              address: retailer.address,
              storeContact: retailer.storeContact,
              tenantId: retailer.tenantId,
              locationId: retailer.location?.id ?? "",
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
