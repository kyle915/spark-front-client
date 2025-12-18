import { useEffect, useMemo } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import LoadingButton from "@shared/LoadingButton";
import { LocationsQuery } from "@api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@api/queries/__generated__/LocationsQuery.graphql";
import { LocationByIdQuery } from "@api/queries/LocationByIdQuery";
import type { LocationByIdQuery as LocationByIdQueryType } from "@api/queries/__generated__/LocationByIdQuery.graphql";
import { CreateLocationMutation } from "@api/mutations/CreateLocationMutation";
import type { CreateLocationMutation as CreateLocationMutationType } from "@api/mutations/__generated__/CreateLocationMutation.graphql";
import { UpdateLocationMutation } from "@api/mutations/UpdateLocationMutation";
import type { UpdateLocationMutation as UpdateLocationMutationType } from "@api/mutations/__generated__/UpdateLocationMutation.graphql";
import { useAlertStore } from "@store/alertStore";
import { PencilIcon } from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import { MapPinIcon } from "@heroicons/react/24/solid";

type LocationFormValues = {
  name: string;
  code: string;
  zip: string;
  tenantId: string;
};

type LocationFormProps = {
  defaultValues: LocationFormValues;
  onSubmit: (values: LocationFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
};

const LocationForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
}: LocationFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LocationFormValues>({
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="form-control gap-2 p-2">
          <div className="flex items-center gap-4">
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

        <div className="form-control gap-2 p-2">
          <div className="flex items-center gap-4">
            <label className="label p-0">
              <span className="label-text">Code</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              {...register("code", { required: "Code is required" })}
            />
          </div>
          {errors.code && (
            <span className="text-error text-sm">{errors.code.message}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="form-control gap-2 p-2">
          <div className="flex items-center gap-4">
            <label className="label p-0">
              <span className="label-text">ZIP</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              {...register("zip", { required: "ZIP is required" })}
            />
          </div>
          {errors.zip && (
            <span className="text-error text-sm">{errors.zip.message}</span>
          )}
        </div>
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

const LocationsTable = ({ tenantId }: { tenantId: string }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<LocationsQueryType>(
    LocationsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const locations = useMemo(
    () => data.locations.edges.map((edge) => edge.node),
    [data]
  );

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex items-center justify-start">
          <h2 className="card-title">Locations</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>ZIP</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center text-sm text-base-content/70"
                  >
                    No locations for this tenant.
                  </td>
                </tr>
              )}
              {locations.map((location) => (
                <tr key={location.id}>
                  <td>{location.name}</td>
                  <td>{location.code}</td>
                  <td>{location.zip}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        navigate(`/catalogs/locations/edit/${location.uuid}`)
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

export const LocationsList = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center w-full justify-between">
          <div>
            <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <MapPinIcon className="w-8 h-8" />
              <h1>Locations</h1>
            </span>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/catalogs/locations/create")}
            >
              New Location
            </button>
          </div>
        </div>
      </div>

      {!tenantId ? (
        <div className="alert alert-warning">
          <span>Select a tenant to see the list.</span>
        </div>
      ) : (
        <LocationsTable tenantId={tenantId} />
      )}
    </Layout>
  );
};

export const CreateLocation = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreate, isCreating] = useMutation<CreateLocationMutationType>(
    CreateLocationMutation
  );

  const initialTenantId = tenantId || "";

  const handleSubmit = (values: LocationFormValues) => {
    commitCreate({
      variables: { input: values },
      onCompleted: (response) => {
        const payload = response.createLocation;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/locations/list");
        } else {
          showAlert(payload?.message ?? "Error creating location", "error");
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
        <h1 className="text-2xl font-bold">Create Location</h1>
        <p className="text-sm text-base-content/70">
          Assign the location to a tenant.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <LocationForm
            defaultValues={{
              name: "",
              code: "",
              zip: "",
              tenantId: initialTenantId,
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

export const EditLocation = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<LocationByIdQueryType>(
    LocationByIdQuery,
    { uuid: uuid ?? "" },
    { fetchPolicy: "store-and-network" }
  );

  const location = data.location;
  const [commitUpdate, isUpdating] = useMutation<UpdateLocationMutationType>(
    UpdateLocationMutation
  );

  const handleSubmit = (values: LocationFormValues) => {
    if (!location?.id) return;

    commitUpdate({
      variables: {
        input: {
          id: location.id,
          name: values.name,
          code: values.code,
          zip: values.zip,
          tenantId: values.tenantId,
        },
      },
      onCompleted: (response) => {
        const payload = response.updateLocation;
        if (payload?.success) {
          showAlert(payload.message, "success");
          navigate("/catalogs/locations/list");
        } else {
          showAlert(payload?.message ?? "Error updating location", "error");
        }
      },
      onError: (error) => {
        showAlert(error.message, "error");
      },
    });
  };

  if (!location) {
    return (
      <Layout>
        <div className="alert alert-error">
          <span>Location not found.</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Location</h1>
        <p className="text-sm text-base-content/70">
          Update the location data for this tenant.
        </p>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <LocationForm
            defaultValues={{
              name: location.name,
              code: location.code,
              zip: location.zip,
              tenantId: location.tenantId,
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
