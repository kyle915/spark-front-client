import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";
import { useForm, type Control } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
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
import { useAuthStore } from "@/store/authStore";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { ArrowLeftIcon, UserGroupIcon } from "@heroicons/react/24/solid";
import FormInputText from "@/shared/FormInputText";
import FormAutocomplete from "@/shared/FormAutocomplete";
import { PlusCircle } from "lucide-react";
import { useRelayPagination } from "@/hooks/useRelayPagination";
import Loading from "@/shared/Loading";
import DistributorsTableContent from "./components/DistributorsTableContent";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type DistributorFormValues = {
  name: string;
  email: string;
  locationId: string;
  tenantId: string;
};

type TenantLocationSelectProps = {
  control: Control<DistributorFormValues>;
  name?: string;
  // The distributor's current location (on edit), so its label renders
  // before any search and survives result swaps.
  defaultLocation?: { id: string; name: string } | null;
};

const TenantLocationSelect = ({
  control,
  defaultLocation,
}: TenantLocationSelectProps) => {
  // Search locations SERVER-SIDE as the user types. The old version loaded
  // only the first page of ALL locations and filtered it client-side, so
  // any city past that page was unfindable. The distributor form has no
  // State field, so we search across every state and show the state code
  // in the label to disambiguate same-named cities (e.g. Jacksonville
  // exists in 14 states).
  const [items, setItems] = useState<
    { id: string; name: string; code: string | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const reqIdRef = useRef(0);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    const reqId = ++reqIdRef.current;
    const timeout = setTimeout(() => {
      setIsLoading(true);
      fetchQuery<LocationsQueryType>(
        environment,
        LocationsQuery,
        { q: trimmed || null, first: 25 },
        { fetchPolicy: "network-only" },
      )
        .toPromise()
        .then((data) => {
          if (reqId !== reqIdRef.current) return;
          setItems(
            data?.locations?.edges?.flatMap((edge) =>
              edge?.node
                ? [
                    {
                      id: edge.node.id,
                      name: edge.node.name,
                      code: edge.node.code ?? null,
                    },
                  ]
                : [],
            ) ?? [],
          );
        })
        .catch(() => {
          if (reqId === reqIdRef.current) setItems([]);
        })
        .finally(() => {
          if (reqId === reqIdRef.current) setIsLoading(false);
        });
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const options = useMemo(() => {
    const opts = items.map((l) => ({
      label: l.code ? `${l.name} (${l.code})` : l.name,
      value: l.id,
    }));
    if (
      defaultLocation &&
      !opts.some((o) => String(o.value) === String(defaultLocation.id))
    ) {
      opts.unshift({ label: defaultLocation.name, value: defaultLocation.id });
    }
    return opts;
  }, [items, defaultLocation]);

  return (
    <FormAutocomplete
      control={control}
      name="locationId"
      label="Location"
      placeholder="Search a location"
      options={options}
      onSearch={setSearchTerm}
      loading={isLoading}
      rules={{ required: "Location is required" }}
    />
  );
};

type DistributorFormProps = {
  defaultValues: DistributorFormValues;
  onSubmit: (values: DistributorFormValues) => void;
  submitLabel: string;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
  defaultLocation?: { id: string; name: string } | null;
};

const DistributorForm = ({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  mode = "create",
  defaultLocation,
}: DistributorFormProps) => {
  const { control, handleSubmit, reset, watch, setValue } =
    useForm<DistributorFormValues>({
      defaultValues,
    });

  const isEdit = mode === "edit";
  const tenantId = watch("tenantId");
  const lastTenantIdRef = useRef(defaultValues.tenantId);

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // Reset location when tenant changes
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
          {/* HEADER */}
          <div className="flex flex-col gap-4 border-b border-base-100/20 pb-6">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/catalogs/distributors/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <UserGroupIcon className="w-6 h-6" />
                  <h1>{isEdit ? "Edit Distributor" : "Create Distributor"}</h1>
                </span>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {isEdit
                  ? "Update distributor details and location assignment."
                  : "Assign the distributor to a tenant and location."}
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
                label="Distributor Name"
                placeholder="e.g., ACME Supplies"
                rules={{ required: "Name is required" }}
              />

              <FormInputText
                control={control}
                name="email"
                label="Email"
                placeholder="e.g., contact@acme.com"
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /\S+@\S+\.\S+/,
                    message: "Enter a valid email",
                  },
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TenantLocationSelect
                control={control}
                name="locationId"
                defaultLocation={defaultLocation}
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

export function DistributorsTable({
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
  } = useRelayPagination<DistributorsQueryType>({
    query: DistributorsQuery,
    pageSize: PAGE_SIZE,
    initialVariables: {
      filters: { tenantId },
      q: q || undefined,
    },
  });

  // 🔑 Exponer refresh una sola vez
  useEffect(() => {
    onRefreshReady?.(refresh);
  }, [onRefreshReady, refresh]);

  return (
    <Suspense fallback={<Loading />}>
      {queryRef && (
        <DistributorsTableContent
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

const DistributorsPage = () => {
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
          placeholder="Search distributors..."
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

      <DistributorsTable
        key={q}
        tenantId={tenantId ?? ""}
        q={q}
        onRefreshReady={(fn) => {
          refreshRef.current = fn;
        }}
      />
    </>
  );
};

export function DistributorsList() {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-3xl font-bold text-primary">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <UserGroupIcon className="w-8 h-8" />
            </div>
            <h1>Distributors</h1>
          </div>
          <p className="text-base-content/70">
            Manage and organize your distributors.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate("/catalogs/distributors/create")}
        >
          <PlusCircle className="w-4 h-4" />
          New Distributor
        </button>
      </div>

      {!tenantId ? (
        <div className="alert alert-warning">
          <span>Select a tenant to see the list.</span>
        </div>
      ) : (
        <DistributorsPage />
      )}
    </Layout>
  );
}

export const CreateDistributor = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const navigate = useNavigate();
  const [commitCreate, isCreating] = useMutation<CreateDistributorMutationType>(
    CreateDistributorMutation,
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
    { fetchPolicy: "store-and-network" },
  );

  const distributor = data.distributor;
  const [commitUpdate, isUpdating] = useMutation<UpdateDistributorMutationType>(
    UpdateDistributorMutation,
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
      <DistributorForm
        defaultValues={{
          name: distributor.name,
          email: distributor.email ?? "",
          tenantId: distributor.tenantId,
          locationId: distributor.location?.id ?? "",
        }}
        onSubmit={handleSubmit}
        submitLabel="Update"
        mode="edit"
        isSubmitting={isUpdating}
        defaultLocation={
          distributor.location
            ? { id: distributor.location.id, name: distributor.location.name }
            : null
        }
      />
    </Layout>
  );
};
