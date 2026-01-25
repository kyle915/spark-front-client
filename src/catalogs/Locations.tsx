import { useEffect, useMemo } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
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
import { ArrowLeftIcon, MapPinIcon } from "@heroicons/react/24/solid";
import FormInputText from "@/shared/FormInputText";
import { PlusCircle } from "lucide-react";

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
  mode?: "create" | "edit";
};

const LocationForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  mode = "create",
}: LocationFormProps) => {
  const { control, handleSubmit, reset } = useForm<LocationFormValues>({
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
                to="/catalogs/locations/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <MapPinIcon className="w-6 h-6" />
                  <h1>{isEdit ? "Edit Location" : "Create Location"}</h1>
                </span>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {isEdit
                  ? "Update the location data for this tenant."
                  : "Assign the location to a tenant."}
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
                label="Location Name"
                placeholder="e.g., Managua Central"
                rules={{
                  required: "Name is required",
                  minLength: {
                    value: 2,
                    message: "Name must be at least 2 characters",
                  },
                }}
              />

              <FormInputText
                control={control}
                name="code"
                label="Location Code"
                placeholder="e.g., MNG-01"
                rules={{
                  required: "Code is required",
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInputText
                control={control}
                name="zip"
                label="ZIP Code"
                placeholder="e.g., 14001"
                rules={{
                  required: "ZIP is required",
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

const LocationsTable = ({ tenantId }: { tenantId: string }) => {
  const navigate = useNavigate();
  const data = useLazyLoadQuery<LocationsQueryType>(
    LocationsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" },
  );

  const locations = useMemo(
    () => data.locations.edges.map((edge) => edge.node),
    [data],
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
                      className="btn btn-primary btn-sm"
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
            <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <MapPinIcon className="w-8 h-8" />
              </div>

              <h1>Locations</h1>
            </div>
            <p className="text-base-content/70">
              Manage and organize your locations.
            </p>
          </div>

          <div>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/catalogs/locations/create")}
            >
              <PlusCircle className="w-4 h-4" />
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
    CreateLocationMutation,
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
    { fetchPolicy: "store-and-network" },
  );

  const location = data.location;
  const [commitUpdate, isUpdating] = useMutation<UpdateLocationMutationType>(
    UpdateLocationMutation,
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
        mode="edit"
      />
    </Layout>
  );
};
