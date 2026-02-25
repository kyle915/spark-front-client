import { Suspense, useEffect, useMemo, useRef } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useForm, type Control } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
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
import { XCircleIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeftIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/solid";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormInputText from "@/shared/FormInputText";
import { PlusCircle } from "lucide-react";
import { useRelayPagination } from "@/hooks/useRelayPagination";
import Loading from "@/shared/Loading";
import { RetailersTableContent } from "./components/RetailersTableContent";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type RetailerFormValues = {
  name: string;
  address: string;
  storeContact: string;
  locationId: string;
  tenantId: string;
};

type TenantLocationSelectProps = {
  control: Control<RetailerFormValues>;
  name?: string;
};

const TenantLocationSelect = ({ control }: TenantLocationSelectProps) => {
  const data = useLazyLoadQuery<LocationsQueryType>(
    LocationsQuery,
    {},
    { fetchPolicy: "store-and-network" },
  );

  const locationOptions = useMemo(
    () =>
      data.locations.edges.map((edge) => ({
        label: edge.node.name,
        value: edge.node.id,
      })),
    [data],
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

const PAGE_SIZE = 10;

export function RetailersTable({
  tenantId,
  q,
  onRefreshReady,
}: {
  tenantId: string;
  q: string;
  onRefreshReady?: (refreshFn: () => void) => void;
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
  } = useRelayPagination<RetailersQueryType>({
    query: RetailersQuery,
    pageSize: PAGE_SIZE,
    initialVariables: {
      filters: { tenantId },
      q: q || undefined,
    },
  });

  // 🔑 Exponer refresh al padre
  useEffect(() => {
    onRefreshReady?.(refresh);
  }, [onRefreshReady, refresh]);

  return (
    <Suspense fallback={<Loading />}>
      {queryRef ? (
        <RetailersTableContent
          queryRef={queryRef}
          currentPage={displayPage}
          pageSize={PAGE_SIZE}
          onNext={goNext}
          onPrevious={goPrevious}
          onGoToPage={goToPage}
          onPageLoaded={handlePageLoaded}
          isNavigating={isNavigating}
        />
      ) : (
        <Loading />
      )}
    </Suspense>
  );
}

export function RetailersPage() {
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
          placeholder="Search retailers..."
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

      <RetailersTable
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
              <PlusCircle className="w-4 h-4" />
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
        <RetailersPage />
      )}
    </Layout>
  );
};

export const CreateRetailer = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreate, isCreating] = useMutation<CreateRetailerMutationType>(
    CreateRetailerMutation,
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
    { fetchPolicy: "store-and-network" },
  );

  const retailer = data.retailer;
  const [commitUpdate, isUpdating] = useMutation<UpdateRetailerMutationType>(
    UpdateRetailerMutation,
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
