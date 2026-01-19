import { useEffect, useMemo, useRef } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm, type Control } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
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
import { PencilIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeftIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/solid";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormInputText from "@/shared/FormInputText";

type RetailerFormValues = {
  name: string;
  address: string;
  storeContact: string;
  locationId: string;
  tenantId: string;
};

type TenantLocationSelectProps = {
  tenantId: string;
  control: Control<RetailerFormValues>;
  name?: string;
};

const TenantLocationSelect = ({
  tenantId,
  control,
}: TenantLocationSelectProps) => {
  const data = useLazyLoadQuery<LocationsQueryType>(
    LocationsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const locationOptions = useMemo(
    () =>
      data.locations.edges.map((edge) => ({
        label: edge.node.name,
        value: edge.node.id,
      })),
    [data]
  );

  return (
    <FormAutocomplete
      control={control}
      name="locationId"
      label="Location"
      placeholder="Select a location"
      options={locationOptions}
      rules={{
        required: "Location is required",
      }}
    />
  );
};

export default TenantLocationSelect;

type RetailerFormProps = {
  defaultValues: RetailerFormValues;
  onSubmit: (values: RetailerFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
};

const RetailerForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  mode = "create",
}: RetailerFormProps) => {
  const { handleSubmit, watch, reset, setValue, control } =
    useForm<RetailerFormValues>({
      defaultValues,
    });

  const isEdit = mode === "edit";

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
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          {/* HEADER (igual al ejemplo) */}
          <div className="flex flex-col gap-5 border-b border-base-100/20 pb-6">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/catalogs/retailers/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <BuildingStorefrontIcon className="w-6 h-6" />
                  <h1>{isEdit ? "Edit Retailer" : "Create Retailer"}</h1>
                </div>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {isEdit
                  ? "Update the information of this retailer."
                  : "Fill out the form below to add a new retailer to your system."}
              </p>
            </div>
          </div>

          {/* SECTION: BASIC INFO (igual al patrón) */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Basic Information</p>
              <span className="text-xs text-base-content/60">
                Required fields
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInputText
                control={control}
                name="name"
                label="Name"
                placeholder="e.g., Retailer Central"
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
                name="storeContact"
                label="Store contact"
                placeholder="e.g., +1 555-1234"
                rules={{
                  required: "Store contact is required",
                  minLength: {
                    value: 2,
                    message: "Store contact must be at least 2 characters",
                  },
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInputText
                control={control}
                name="address"
                label="Address"
                placeholder="e.g., 123 Main St, City, Country"
                rules={{
                  required: "Address is required",
                  minLength: {
                    value: 4,
                    message: "Address must be at least 4 characters",
                  },
                }}
              />

              <TenantLocationSelect
                tenantId={tenantId}
                control={control}
                name="locationId"
              />
            </div>
          </section>

          {/* FOOTER ACTIONS (estilo Create Recap) */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <Link
              type="button"
              className="btn btn-sm btn-outline"
              to="/stores/list"
            >
              <XCircleIcon className="w-4 h-4" />
              Cancel
            </Link>

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
                      className="btn btn-primary btn-sm"
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
            <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <BuildingStorefrontIcon className="w-8 h-8" />
              </div>
              <h1>Retailers</h1>
            </div>
            <p className="text-base-content/70">
              Manage and organize your retailers.
            </p>
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
      <RetailerForm
        defaultValues={{
          name: retailer.name,
          address: retailer.address ?? "",
          storeContact: retailer.storeContact ?? "",
          tenantId: retailer.tenantId,
          locationId: retailer.location?.id ?? "",
        }}
        onSubmit={handleSubmit}
        submitLabel="Update"
        isSubmitting={isUpdating}
        mode="edit"
      />
    </Layout>
  );
};
