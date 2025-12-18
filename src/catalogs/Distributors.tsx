import { useEffect, useMemo, useRef } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm, type UseFormRegister } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import LoadingButton from "@shared/LoadingButton";
import { DistributorsQuery } from "@api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
import { DistributorByIdQuery } from "@api/queries/DistributorByIdQuery";
import type { DistributorByIdQuery as DistributorByIdQueryType } from "@api/queries/__generated__/DistributorByIdQuery.graphql";
import { LocationsQuery } from "@api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@api/queries/__generated__/LocationsQuery.graphql";
import { CreateDistributorMutation } from "@api/mutations/CreateDistributorMutation";
import type { CreateDistributorMutation as CreateDistributorMutationType } from "@api/mutations/__generated__/CreateDistributorMutation.graphql";
import { UpdateDistributorMutation } from "@api/mutations/UpdateDistributorMutation";
import type { UpdateDistributorMutation as UpdateDistributorMutationType } from "@api/mutations/__generated__/UpdateDistributorMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import { PencilIcon } from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import { UserGroupIcon } from "@heroicons/react/24/solid";

type DistributorFormValues = {
  name: string;
  email: string;
  locationId: string;
  tenantId: string;
};

type LocationSelectProps = {
  tenantId: string;
  register: UseFormRegister<DistributorFormValues>;
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

type DistributorFormProps = {
  defaultValues: DistributorFormValues;
  onSubmit: (values: DistributorFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
};

const DistributorForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
}: DistributorFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DistributorFormValues>({
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <span className="label-text">Email</span>
          </label>
          <input
            type="email"
            className="input input-bordered"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: "Enter a valid email",
              },
            })}
          />
          {errors.email && (
            <span className="text-error text-sm mt-1">
              {errors.email.message}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

const DistributorsTable = ({ tenantId }: { tenantId: string }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<DistributorsQueryType>(
    DistributorsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const distributors = useMemo(
    () => data.distributors.edges.map((edge) => edge.node),
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
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {distributors.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-sm text-base-content/70"
                  >
                    No distributors for this tenant.
                  </td>
                </tr>
              )}
              {distributors.map((distributor) => (
                <tr key={distributor.id}>
                  <td>{distributor.name}</td>
                  <td>{distributor.email}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        navigate(
                          `/catalogs/distributors/edit/${distributor.uuid}`
                        )
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

export const DistributorsList = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center w-full justify-between">
          <div>
            <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <UserGroupIcon className="w-8 h-8" />
              <h1>Distributors</h1>
            </span>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/catalogs/distributors/create")}
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
        <DistributorsTable tenantId={tenantId} />
      )}
    </Layout>
  );
};

export const CreateDistributor = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreate, isCreating] = useMutation<CreateDistributorMutationType>(
    CreateDistributorMutation
  );

  const initialTenantId = tenantId || "";

  const handleSubmit = (values: DistributorFormValues) => {
    commitCreate({
      variables: { input: values },
      onCompleted: (response) => {
        const payload = response.createDistributor;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/distributors/list");
        } else {
          showAlert(payload?.message ?? "Error creating distributor", "error");
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
        <h1 className="text-2xl font-bold">Create Distributor</h1>
        <p className="text-sm text-base-content/70">
          Assign the distributor to a tenant and location.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <DistributorForm
            defaultValues={{
              name: "",
              email: "",
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

export const EditDistributor = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<DistributorByIdQueryType>(
    DistributorByIdQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );

  const distributor = data.distributor;
  const [commitUpdate, isUpdating] = useMutation<UpdateDistributorMutationType>(
    UpdateDistributorMutation
  );

  const handleSubmit = (values: DistributorFormValues) => {
    if (!distributor?.id) return;

    commitUpdate({
      variables: {
        input: {
          id: distributor.id,
          name: values.name,
          email: values.email,
          tenantId: values.tenantId,
          locationId: values.locationId,
        },
      },
      onCompleted: (response) => {
        const payload = response.updateDistributor;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/distributors/list");
        } else {
          showAlert(payload?.message ?? "Error updating distributor", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  };

  if (!distributor) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Distributor not found.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Distributor</h1>
        <p className="text-sm text-base-content/70">
          Update distributor details and tenant context.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <DistributorForm
            defaultValues={{
              name: distributor.name,
              email: distributor.email,
              tenantId: distributor.tenantId,
              locationId: distributor.location?.id ?? "",
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
