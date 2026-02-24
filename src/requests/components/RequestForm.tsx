import { Controller, useForm, useWatch } from "react-hook-form";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import FormInputText from "@/shared/FormInputText";
import FormInputTime from "@/shared/FormInputTime";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormAddressSearch from "@/shared/FormAddressSearch";
import FormDatePicker from "@/shared/FormDatePicker";
import EditableLocationMap from "@/shared/EditableLocationMap";
import FormCheckbox from "@/shared/FormCheckbox";
import { ArrowLeftIcon, PencilIcon } from "@heroicons/react/24/solid";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { SaveIcon } from "lucide-react";
import type { Path, PathValue } from "react-hook-form";
import { useAutoTimezoneFromCoordinates } from "../hooks/useAutoTimezoneFromCoordinates";

import { useMutation } from "react-relay/hooks";
import { useAlertStore } from "@store/alertStore";

import { CreateRequestStoreManagerMutation } from "@api/mutations/CreateRequestStoreManagerMutation";
import type { CreateRequestStoreManagerMutation as CreateRequestStoreManagerMutationType } from "@api/mutations/__generated__/CreateRequestStoreManagerMutation.graphql";

import { CreateDistributorMutation } from "@api/mutations/CreateDistributorMutation";
import type { CreateDistributorMutation as CreateDistributorMutationType } from "@api/mutations/__generated__/CreateDistributorMutation.graphql";

import { CreateRetailerMutation } from "@api/mutations/CreateRetailerMutation";
import type { CreateRetailerMutation as CreateRetailerMutationType } from "@api/mutations/__generated__/CreateRetailerMutation.graphql";

import { DistributorsQuery } from "@api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
import { RetailersQuery } from "@api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@api/queries/__generated__/RetailersQuery.graphql";

import { useEntitiesByLocation } from "../hooks/useEntitiesByLocation";

export interface RequestFormValues {
  name: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  address: string;
  coordinates?: number[] | null;
  timezoneId?: string | null;
  retailerId?: string | null;
  distributorId?: string | null;
  requestTypeId?: string | null;
  clientName?: string;
  clientEmail?: string;
  entitiesLocationId?: string | null;
  distributorName?: string;
  distributorEmail?: string;
  retailerName?: string;
  retailerAddress?: string;
  retailerStoreContact?: string;
  storeManagerName?: string;
  storeManagerPhone?: string;
  storeManagerId?: string | null;
  distributorLocationId?: string | null;
  retailerLocationId?: string | null;
  isTableNeeded?: boolean;
  tableSize?: string;
  products?: string[];
  stateId?: string | null;
}

interface CatalogItem {
  id: string;
  name: string;
  email?: string | null;
  address?: string | null;
  storeContact?: string | null;
  code?: string | null;
}

interface ProductItem {
  id: string;
  name: string;
  image?: string | null;
  productType?: { id: string; name: string } | null;
}

interface TimezoneItem {
  id: string;
  name: string;
  code: string;
  offset: number;
}

interface StoreManagerItem {
  id: string;
  name: string;
  phone: string;
}

interface RequestFormProps {
  mode: "create" | "edit";
  onSubmit: (data: RequestFormValues) => void;
  defaultValues?: Partial<RequestFormValues>;
  clients?: CatalogItem[];
  retailers?: CatalogItem[];
  distributors?: CatalogItem[];
  requestTypes: CatalogItem[];
  timezones?: TimezoneItem[];
  productTypes?: CatalogItem[];
  products?: ProductItem[];
  tenantId: string;
  requestId?: string | null;
  requestStoreManagers?: StoreManagerItem[];
  locations?: CatalogItem[];
  states?: CatalogItem[];
  onStateChange?: (stateId: string | null) => void;

  onRefetch?: (
    key: "distributors" | "retailers" | "requestStoreManagers",
  ) => void;

  enableContactSection?: boolean;
  contactMode?: "request" | "manual";
  requestContactInfo?: Partial<
    Pick<
      RequestFormValues,
      | "distributorName"
      | "distributorEmail"
      | "retailerName"
      | "retailerAddress"
      | "retailerStoreContact"
      | "storeManagerName"
      | "storeManagerPhone"
    >
  >;
}

// Pagination Products (Temporary)
const PAGE_SIZE = 12;

export default function RequestForm({
  mode,
  onSubmit,
  defaultValues = {},
  retailers = [],
  distributors = [],
  requestTypes,
  timezones = [],
  productTypes = [],
  products = [],
  tenantId,
  requestId = null,
  requestStoreManagers = [],
  onRefetch,
  enableContactSection = false,
  contactMode,
  requestContactInfo,
  locations = [],
  states = [],
  onStateChange,
}: RequestFormProps) {
  const safeDefaultValues: RequestFormValues = {
    name: "",
    date: "",
    startTime: "",
    endTime: "",
    address: "",
    coordinates: null,
    timezoneId: null,
    retailerId: null,
    distributorId: null,
    requestTypeId: null,
    clientName: "",
    clientEmail: "",
    distributorName: "",
    distributorEmail: "",
    retailerName: "",
    retailerAddress: "",
    retailerStoreContact: "",
    storeManagerName: "",
    storeManagerPhone: "",
    isTableNeeded: false,
    tableSize: "",
    products: [],
    stateId: null,
    ...defaultValues,
  };

  const { showAlert } = useAlertStore();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ========================
  // INITIALIZE FORM AND FORM STATE
  // ========================
  const { handleSubmit, control, watch, setValue, reset, formState, trigger } =
    useForm<RequestFormValues>({ defaultValues: safeDefaultValues });

  const isDirty = formState.isDirty;

  // ========================
  // WATCHERS FOR COORDINATES & TIMEZONE AND HOOK
  // ========================
  const selectedCoordinates = watch("coordinates");
  const selectedTimezoneId = watch("timezoneId");

  /* ================= WATCH FOR SECTION ENTITIES ================= */
  const distributorId = watch("distributorId");
  const retailerId = watch("retailerId");
  const storeManagerId = watch("storeManagerId");
  const distributorLocationId = watch("distributorLocationId");
  const retailerLocationId = watch("retailerLocationId");
  const selectedStateId = watch("stateId");
  const selectedEntitiesLocationId = useWatch({
    control,
    name: "entitiesLocationId",
  });

  /* ================= DISTRIBUTORS AND RETAILERS ================= */
  const extractDistributors = useCallback(
    (data: DistributorsQueryType["response"]) =>
      data.distributors?.edges?.flatMap((e) => (e?.node ? [e.node] : [])) ?? [],
    [],
  );

  const distributorsHook = useEntitiesByLocation<
    CatalogItem,
    DistributorsQueryType
  >({
    tenantId,
    entitiesLocationId: selectedEntitiesLocationId ?? null,
    initialItems: distributors,
    queryDocument: DistributorsQuery,
    extractNodes: extractDistributors,
  });

  const extractRetailers = useCallback(
    (data: RetailersQueryType["response"]) =>
      data.retailers?.edges?.flatMap((e) => (e?.node ? [e.node] : [])) ?? [],
    [],
  );

  const retailersHook = useEntitiesByLocation<CatalogItem, RetailersQueryType>({
    tenantId,
    entitiesLocationId: selectedEntitiesLocationId ?? null,
    initialItems: retailers,
    queryDocument: RetailersQuery,
    extractNodes: extractRetailers,
  });

  /* ================= UI STATE ================= */
  const [showDistributorLocation, setShowDistributorLocation] = useState(false);
  const [showRetailerLocation, setShowRetailerLocation] = useState(false);
  const [showStoreManagerCreate, setShowStoreManagerCreate] = useState(false);

  const storeManagerOptions = useMemo(
    () =>
      (requestStoreManagers ?? []).map((m) => ({
        value: m.id,
        label: m.phone ? `${m.name} (${m.phone})` : m.name,
      })),
    [requestStoreManagers],
  );

  const [commitCreateDistributor, isCreatingDistributor] =
    useMutation<CreateDistributorMutationType>(CreateDistributorMutation);

  const [commitCreateRetailer, isCreatingRetailer] =
    useMutation<CreateRetailerMutationType>(CreateRetailerMutation);

  const [commitCreateStoreManager, isCreatingStoreManager] =
    useMutation<CreateRequestStoreManagerMutationType>(
      CreateRequestStoreManagerMutation,
    );

  const manualFields = useWatch({ control });

  const effectiveContactMode = useMemo(
    () => contactMode ?? (requestContactInfo ? "request" : "manual"),
    [contactMode, requestContactInfo],
  );

  const showContactSection = useMemo(() => {
    if (enableContactSection !== undefined) return enableContactSection;
    return Boolean(requestContactInfo);
  }, [enableContactSection, requestContactInfo]);

  const contactInfo = useMemo(() => {
    if (effectiveContactMode === "request") return requestContactInfo ?? {};
    return {
      distributorName: manualFields.distributorName ?? null,
      distributorEmail: manualFields.distributorEmail ?? null,
      retailerName: manualFields.retailerName ?? null,
      retailerAddress: manualFields.retailerAddress ?? null,
      retailerStoreContact: manualFields.retailerStoreContact ?? null,
      storeManagerName: manualFields.storeManagerName ?? null,
      storeManagerPhone: manualFields.storeManagerPhone ?? null,
    };
  }, [effectiveContactMode, manualFields, requestContactInfo]);

  const handleCreateDistributor = () => {
    const { distributorName, distributorEmail } = contactInfo;

    if (!tenantId) {
      showAlert("Missing tenantId", "error");
      return;
    }

    if (!distributorName || !distributorEmail || !distributorLocationId) {
      showAlert("Missing distributor data.", "error");
      return;
    }

    commitCreateDistributor({
      variables: {
        input: {
          tenantId,
          name: distributorName,
          email: distributorEmail,
          locationId: distributorLocationId,
        },
      },
      onCompleted: (res) => {
        const distributor = res.createDistributor?.distributor;
        if (res.createDistributor?.success && distributor) {
          setValue("distributorId", distributor.id, {
            shouldDirty: true,
            shouldTouch: true,
          });
          setShowDistributorLocation(false);
          onRefetch?.("distributors");
          showAlert(res.createDistributor.message, "success");
        } else {
          showAlert(res.createDistributor?.message ?? "Error", "error");
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const handleCreateRetailer = () => {
    const { retailerName, retailerAddress, retailerStoreContact } = contactInfo;

    if (!tenantId) {
      showAlert("Missing tenantId", "error");
      return;
    }

    if (!retailerName || !retailerAddress || !retailerLocationId) {
      showAlert("Missing retailer data.", "error");
      return;
    }

    commitCreateRetailer({
      variables: {
        input: {
          tenantId,
          name: retailerName,
          address: retailerAddress,
          storeContact: retailerStoreContact ?? "",
          locationId: retailerLocationId,
        },
      },
      onCompleted: (res) => {
        const retailer = res.createRetailer?.retailer;
        if (res.createRetailer?.success && retailer) {
          setValue("retailerId", retailer.id, {
            shouldDirty: true,
            shouldTouch: true,
          });
          setShowRetailerLocation(false);
          onRefetch?.("retailers");
          showAlert(res.createRetailer.message, "success");
        } else {
          showAlert(res.createRetailer?.message ?? "Error", "error");
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const handleCreateStoreManager = async () => {
    if (!tenantId) {
      showAlert("Missing tenantId", "error");
      return;
    }

    const isValid = await trigger(["storeManagerName", "storeManagerPhone"]);
    if (!isValid) {
      showAlert("Please complete store manager information.", "error");
      return;
    }

    const { storeManagerName, storeManagerPhone } = contactInfo;
    if (!storeManagerName || !storeManagerPhone) return;

    commitCreateStoreManager({
      variables: {
        input: {
          tenantId,
          requestId: requestId ?? null,
          name: storeManagerName,
          phone: storeManagerPhone,
        },
      },
      onCompleted: (res) => {
        const manager = res.createRequestStoreManager?.requestStoreManager;
        if (res.createRequestStoreManager?.success && manager) {
          setValue("storeManagerId", manager.id, {
            shouldDirty: true,
            shouldTouch: true,
          });
          onRefetch?.("requestStoreManagers");
          showAlert(res.createRequestStoreManager.message, "success");
        } else {
          showAlert(
            res.createRequestStoreManager?.message ??
              "Error creating store manager",
            "error",
          );
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  // ========================
  // EFFECT TO RESET FORM IN EDIT MODE WHEN DEFAULT VALUES CHANGE
  // ========================
  useEffect(() => {
    if (mode === "edit" && Object.keys(defaultValues).length > 0) {
      reset({
        name: defaultValues.name ?? "",
        date: defaultValues.date ?? "",
        startTime: defaultValues.startTime ?? "",
        endTime: defaultValues.endTime ?? "",
        address: defaultValues.address ?? "",
        coordinates: defaultValues.coordinates ?? null,
        timezoneId: defaultValues.timezoneId ?? null,
        retailerId: defaultValues.retailerId ?? null,
        distributorId: defaultValues.distributorId ?? null,
        requestTypeId: defaultValues.requestTypeId ?? null,
        products: defaultValues.products ?? [],
      });
    }
  }, [mode, defaultValues, reset]);

  useAutoTimezoneFromCoordinates<RequestFormValues, "timezoneId">({
    coordinates: selectedCoordinates,
    timezoneId: selectedTimezoneId,
    timezones,
    setValue,
    timezoneFieldName: "timezoneId",
    initialFromBackend: Boolean(defaultValues.timezoneId),
  });

  const [selectedProductType, setSelectedProductType] = useState<string>("");

  const isTableNeeded = watch("isTableNeeded");
  const selectedProducts = watch("products") || [];

  const filteredProducts = useMemo(() => {
    if (!selectedProductType) return products;
    return products.filter((p) => p.productType?.id === selectedProductType);
  }, [products, selectedProductType]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedProductType]);

  const toggleProduct = (productId: string) => {
    const current = selectedProducts;
    if (current.includes(productId)) {
      noteSet(
        "products",
        current.filter((id) => id !== productId),
      );
    } else {
      noteSet("products", [...current, productId]);
    }
  };

  const noteSet = <TFieldName extends Path<RequestFormValues>>(
    name: TFieldName,
    value: PathValue<RequestFormValues, TFieldName>,
  ) => {
    setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const stateOptions = useMemo(
    () =>
      states.map((state) => ({
        value: state.id,
        label: state.code ? `${state.name} (${state.code})` : state.name,
        searchText: state.code ? `${state.name} ${state.code}` : state.name,
      })),
    [states],
  );

  useEffect(() => {
    onStateChange?.(selectedStateId ?? null);
  }, [onStateChange, selectedStateId]);

  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: location.name,
      })),
    [locations],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          {/* HEADER (match View Request) */}
          <div className="flex flex-col gap-5 border-b border-base-100/20">
            {/* top row */}
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/requests/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  type="button"
                  className="btn btn-sm btn-outline"
                  to="/requests/list"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={!isDirty}
                >
                  <SaveIcon className="w-4 h-4" />
                  Save changes
                </button>
              </div>
            </div>

            {/* title row */}
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <PencilIcon className="w-6 h-6" />
                  <h1>
                    {mode === "edit"
                      ? (defaultValues?.name ?? "Edit Request")
                      : "Create Request"}
                  </h1>
                </span>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {mode === "edit"
                  ? "Update the request information. Changes will apply immediately after saving."
                  : "Fill out the form below to create a new request."}
              </p>
            </div>
          </div>

          {/* BASIC INFORMATION */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Basic Information</p>
              <span className="text-xs text-base-content/60">
                Required fields
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInputText<RequestFormValues>
                name="name"
                control={control}
                placeholder="Enter name"
                label="Name"
                rules={{ required: "Name is required" }}
              />

              <FormAutocomplete<RequestFormValues>
                name="requestTypeId"
                control={control}
                label="Request Type"
                placeholder="Search request type..."
                options={requestTypes.map((rt) => ({
                  value: rt.id,
                  label: rt.name,
                }))}
                rules={{ required: "Request Type is required" }}
              />

              <FormDatePicker<RequestFormValues>
                name="date"
                control={control}
                label="Date"
                placeholder="MM/DD/YYYY"
                minDaysFromToday={2}
                rules={{ required: "Date is required" }}
              />

              <FormAutocomplete<RequestFormValues>
                name="timezoneId"
                control={control}
                label="Timezone"
                placeholder="Search timezone..."
                options={timezones.map((tz) => {
                  const sign = tz.offset >= 0 ? "+" : "-";
                  const abs = Math.abs(tz.offset);
                  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
                  const minutes = String(abs % 60).padStart(2, "0");
                  return {
                    value: tz.id,
                    label: `${tz.name}-${tz.code} (UTC${sign}${hours}:${minutes})`,
                  };
                })}
                rules={{ required: "Timezone is required" }}
              />

              <FormInputTime<RequestFormValues>
                name="startTime"
                control={control}
                label="Start Time"
                rules={{ required: "Start Time is required" }}
              />

              <FormInputTime<RequestFormValues>
                name="endTime"
                control={control}
                label="End Time"
                rules={{ required: "End Time is required" }}
              />

              <div className="md:col-span-2">
                <FormAddressSearch<RequestFormValues>
                  name="address"
                  placeholder="Enter address"
                  control={control}
                  label="Address"
                  rules={{ required: "Address is required" }}
                  onSelect={(result) => {
                    noteSet("coordinates", [result.lat, result.lng]);
                  }}
                />
              </div>
            </div>
          </section>

          {/* ================= ENTITIES ================= */}
          {(mode === "create" || showContactSection) && (
            <section className="space-y-6 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">Event entities</p>
                  <p className="text-sm text-base-content/60">
                    Select existing records or create new ones if needed.
                  </p>
                </div>
                <span className="text-xs text-base-content/60">
                  Retailer & Distributor
                </span>
              </div>

              <div className="flex items-center gap-4 mt-4 w-full">
                <FormAutocomplete<RequestFormValues>
                  name="stateId"
                  control={control}
                  label="State"
                  placeholder="Select state..."
                  options={stateOptions}
                  disabled={!tenantId}
                />

                <FormAutocomplete<RequestFormValues>
                  name="entitiesLocationId"
                  control={control}
                  label="City"
                  placeholder="Select city..."
                  options={locationOptions}
                  disabled={!tenantId}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-4 rounded-xl bg-base-200/60 p-4">
                  <p className="font-medium">Distributor</p>

                  <FormAutocomplete
                    name="distributorId"
                    control={control}
                    label="Select distributor"
                    placeholder="Search distributor..."
                    options={distributorsHook.items.map((d) => ({
                      value: d.id,
                      label: d.name,
                    }))}
                    onSearch={distributorsHook.setSearchTerm}
                  />

                  {!distributorId && (
                    <div className="space-y-3">
                      <p className="text-base-content/60">or</p>
                      {!showDistributorLocation ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setShowDistributorLocation(true)}
                        >
                          Create new distributor
                        </button>
                      ) : (
                        <div className="space-y-3 border-t-2 border-base-300 p-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInputText
                              name="distributorName"
                              control={control}
                              label="Distributor name"
                              placeholder="Enter distributor name"
                            />
                            <FormInputText
                              name="distributorEmail"
                              control={control}
                              label="Distributor email"
                              placeholder="Enter distributor email"
                            />
                          </div>

                          <FormAutocomplete
                            name="distributorLocationId"
                            control={control}
                            label="Distributor location"
                            placeholder="Select location"
                            options={locations.map((l) => ({
                              value: l.id,
                              label: l.name,
                            }))}
                          />

                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={handleCreateDistributor}
                              disabled={isCreatingDistributor}
                            >
                              Confirm distributor
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                setShowDistributorLocation(false);
                                setValue("distributorLocationId", null);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-xl bg-base-200/60 p-4">
                  <p className="font-medium">Retailer</p>

                  <FormAutocomplete
                    name="retailerId"
                    control={control}
                    label="Select retailer"
                    placeholder="Search retailer..."
                    options={retailersHook.items.map((r) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                    onSearch={retailersHook.setSearchTerm}
                  />

                  {!retailerId && (
                    <div className="space-y-3">
                      <p className="text-base-content/60">or</p>
                      {!showRetailerLocation ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setShowRetailerLocation(true)}
                        >
                          Create new retailer
                        </button>
                      ) : (
                        <div className="space-y-3 border-t-2 border-base-300 p-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInputText
                              name="retailerName"
                              control={control}
                              label="Retailer name"
                              placeholder="Enter retailer name"
                            />
                            <FormInputText
                              name="retailerAddress"
                              control={control}
                              label="Retailer address"
                              placeholder="Enter retailer address"
                            />
                            <FormInputText
                              name="retailerStoreContact"
                              control={control}
                              label="Store contact"
                              placeholder="Enter store contact"
                            />
                          </div>

                          <FormAutocomplete
                            name="retailerLocationId"
                            control={control}
                            label="Retailer location"
                            placeholder="Select location"
                            options={locations.map((l) => ({
                              value: l.id,
                              label: l.name,
                            }))}
                          />

                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={handleCreateRetailer}
                              disabled={isCreatingRetailer}
                            >
                              Confirm retailer
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                setShowRetailerLocation(false);
                                setValue("retailerLocationId", null);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-2 space-y-4 rounded-xl bg-base-200/60 p-4">
                  <p className="font-medium">Store manager</p>

                  <FormAutocomplete
                    name="storeManagerId"
                    control={control}
                    label="Select store manager"
                    placeholder="Search store manager..."
                    options={storeManagerOptions}
                  />

                  {!storeManagerId && (
                    <div className="space-y-3">
                      <p className="text-base-content/60">or</p>
                      {!showStoreManagerCreate ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setShowStoreManagerCreate(true)}
                        >
                          Create new store manager
                        </button>
                      ) : (
                        <div className="space-y-3 border-t-2 border-base-300 p-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInputText
                              name="storeManagerName"
                              control={control}
                              label="Store manager name"
                              placeholder="Enter name"
                              rules={{
                                required: "Store manager name is required",
                              }}
                            />
                            <FormInputText
                              name="storeManagerPhone"
                              control={control}
                              label="Store manager phone"
                              placeholder="Enter phone"
                              rules={{
                                required: "Store manager phone is required",
                              }}
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={handleCreateStoreManager}
                              disabled={isCreatingStoreManager}
                            >
                              Confirm store manager
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                setShowStoreManagerCreate(false);
                                setValue("storeManagerName", "");
                                setValue("storeManagerPhone", "");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* DETAILS (CREATE ONLY) */}
          {mode === "create" && (
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <p className="font-semibold text-lg">Details</p>
              <div className="grid grid-cols-1 gap-4">
                <FormCheckbox<RequestFormValues>
                  name="isTableNeeded"
                  control={control}
                  label="Table Needed?"
                />
                {isTableNeeded && (
                  <FormInputText<RequestFormValues>
                    name="tableSize"
                    control={control}
                    label="Table Size"
                    placeholder="Enter table size"
                    type="number"
                    rules={{ required: "Table Size is required" }}
                  />
                )}
              </div>
            </section>
          )}

          {/* PRODUCTS */}
          {products.length > 0 && (
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold text-lg">Products</p>

                <div className="w-56">
                  <select
                    className="select select-bordered select-sm w-full"
                    value={selectedProductType}
                    onChange={(e) => setSelectedProductType(e.target.value)}
                  >
                    <option value="">All Types</option>
                    {productTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedProductType && visibleProducts.length > 0 && (
                <p className="text-xs text-base-content/60">
                  Showing products of selected type
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {visibleProducts.length === 0 && (
                  <p className="text-base-content/60 col-span-full">
                    No products found.
                  </p>
                )}

                {visibleProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`card bg-base-100 shadow-sm border cursor-pointer transition-all ${
                      selectedProducts.includes(product.id)
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-base-300 hover:border-primary/50"
                    }`}
                    onClick={() => toggleProduct(product.id)}
                  >
                    <div className="card-body p-4 items-center text-center">
                      <div className="w-16 h-16 mb-2 rounded-lg bg-base-200 flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-base-content/50">
                            No img
                          </span>
                        )}
                      </div>
                      <h4
                        className="text-sm font-medium truncate w-full"
                        title={product.name}
                      >
                        {product.name}
                      </h4>

                      {product.productType?.name && (
                        <span className="text-xs text-base-content/60 mt-1">
                          {product.productType.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-base-content/60 text-center">
                Showing {visibleProducts.length} of {filteredProducts.length}{" "}
                products
              </p>

              {visibleCount < filteredProducts.length && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      setVisibleCount((prev) =>
                        Math.min(prev + PAGE_SIZE, filteredProducts.length),
                      )
                    }
                  >
                    Load more products
                  </button>
                </div>
              )}
            </section>
          )}

          {/* LOCATION MAP */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Location</p>
            </div>

            <Controller
              name="coordinates"
              control={control}
              render={({ field }) => (
                <EditableLocationMap
                  coordinates={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </section>

          {/* FOOTER ACTIONS (optional but matches nice UX) */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <Link
              type="button"
              className="btn btn-sm btn-outline"
              to="/requests/list"
            >
              <XCircleIcon className="w-4 h-4" />
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!isDirty}
            >
              {mode === "edit" ? "Save changes" : "Create request"}
              <SaveIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
