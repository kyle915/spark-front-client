import { Controller, useForm, useWatch } from "react-hook-form";
// import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import type {
  EventFormValues,
  EventFormProps,
} from "../../types/events/formTypes";

import { fetchQuery, useMutation } from "react-relay";
import environment from "@api/relay/environment";

import FormInputText from "@shared/FormInputText";
import FormInputTime from "@shared/FormInputTime";
import FormAutocomplete from "@shared/FormAutocomplete";
import FormDatePicker from "@shared/FormDatePicker";
import EditableLocationMap from "@shared/EditableLocationMap";
import FormCheckbox from "@shared/FormCheckbox";
import FormTextarea from "@shared/FormTextarea";

import { ArrowLeftIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { PencilIcon } from "@heroicons/react/24/solid";
import { SaveIcon } from "lucide-react";

import { LocationsQuery } from "@api/queries/LocationsQuery";
import type { LocationsQuery as LocationsQueryType } from "@api/queries/__generated__/LocationsQuery.graphql";

import { DistributorsQuery } from "@api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
import { RetailersQuery } from "@api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@api/queries/__generated__/RetailersQuery.graphql";

import { CreateRequestStoreManagerMutation } from "@api/mutations/CreateRequestStoreManagerMutation";
import type { CreateRequestStoreManagerMutation as CreateRequestStoreManagerMutationType } from "@api/mutations/__generated__/CreateRequestStoreManagerMutation.graphql";

import { CreateDistributorMutation } from "@api/mutations/CreateDistributorMutation";
import type { CreateDistributorMutation as CreateDistributorMutationType } from "@api/mutations/__generated__/CreateDistributorMutation.graphql";

import { CreateRetailerMutation } from "@api/mutations/CreateRetailerMutation";
import type { CreateRetailerMutation as CreateRetailerMutationType } from "@api/mutations/__generated__/CreateRetailerMutation.graphql";
import { useAutoTimezoneFromCoordinates } from "@/requests/hooks/useAutoTimezoneFromCoordinates";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEntitiesByLocation } from "@/requests/hooks/useEntitiesByLocation";
import { useAlertStore } from "@/store/alertStore";

interface CatalogItem {
  id: string;
  name: string;
  email?: string | null;
  address?: string | null;
  storeContact?: string | null;
  code?: string | null;
}

export default function EventForm({
  mode,
  eventTypes,
  tenantId,
  requestId,
  distributors = [],
  timezones = [],
  retailers = [],
  states = [],
  requestStoreManagers = [],
  requestContactInfo,
  contactMode,
  onSubmit,
  defaultValues = {},
  onRefetch,
}: //,
EventFormProps) {
  const safeDefaultValues: EventFormValues = {
    name: "",
    address: "",
    tenant: tenantId || "",
    eventTypeId: null,
    date: "",
    startTime: "",
    endTime: "",
    notes: "",
    isNational: false,
    coordinates: null,
    timezoneId: null,
    distributorId: null,
    retailerId: null,
    storeManagerId: null,
    distributorName: "",
    distributorEmail: "",
    retailerName: "",
    retailerAddress: "",
    retailerStoreContact: "",
    storeManagerPhone: "",
    storeManagerName: "",
    distributorLocationId: null,
    retailerLocationId: null,
    stateId: null,
    entitiesLocationId: null,
    ...defaultValues,
  };

  const navigate = useNavigate();
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const { showAlert } = useAlertStore();

  // ========================
  // INITIALIZE FORM AND FORM STATE
  // ========================
  const { handleSubmit, control, setValue, formState, watch, trigger } =
    useForm<EventFormValues>({
      defaultValues: safeDefaultValues,
    });

  const isDirty = formState.isDirty;

  // ========================
  // WATCHERS FOR COORDINATES & TIMEZONE AND HOOK
  // ========================
  const selectedTimezoneId = watch("timezoneId");
  const selectedCoordinates = watch("coordinates");

  useAutoTimezoneFromCoordinates<EventFormValues, "timezoneId">({
    coordinates: selectedCoordinates,
    timezoneId: selectedTimezoneId,
    timezones,
    setValue,
    timezoneFieldName: "timezoneId",
    initialFromBackend: Boolean(defaultValues?.timezoneId),
  });

  // ========================
  // WATCH FOR SECTION ENTITIES
  // ========================
  const distributorId = watch("distributorId");
  const storeManagerId = watch("storeManagerId");
  const retailerId = watch("retailerId");
  const selectedStateId = watch("stateId");
  const selectedEntitiesLocationId = watch("entitiesLocationId");
  const distributorLocationId = watch("distributorLocationId");
  const retailerLocationId = watch("retailerLocationId");

  // ========================
  // DISTRIBUTORS AND RETAILERS
  // ========================
  useEffect(() => {
    if (!tenantId) {
      setLocations([]);
      return;
    }

    let isCancelled = false;

    const loadLocations = async () => {
      setLoadingLocations(true);

      try {
        const data = await fetchQuery<LocationsQueryType>(
          environment,
          LocationsQuery,
          {
            filters: {
              tenantId,
              ...(selectedStateId ? { stateId: selectedStateId } : {}),
            },
          },
          { fetchPolicy: "network-only" },
        ).toPromise();

        const parsed =
          data?.locations?.edges?.flatMap((edge) =>
            edge?.node ? [edge.node] : [],
          ) ?? [];

        if (!isCancelled) {
          setLocations(parsed);
        }
      } catch {
        if (!isCancelled) {
          setLocations([]);
        }
      } finally {
        if (!isCancelled) {
          setLoadingLocations(false);
        }
      }
    };

    loadLocations();

    return () => {
      isCancelled = true;
    };
  }, [tenantId, selectedStateId]);

  const stateOptions = useMemo(
    () =>
      states.map((state) => ({
        value: state.id,
        label: state.code ? `${state.name} (${state.code})` : state.name,
        searchText: state.code ? `${state.name} ${state.code}` : state.name,
      })),
    [states],
  );

  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: location.name,
      })),
    [locations],
  );

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

  /* ================= RENDER ================= */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          {/* ================= HEADER ================= */}
          <div className="flex flex-col gap-5  border-b border-base-100/20">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center cursor-pointer gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate(-1)}
                >
                  <XCircleIcon className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={!isDirty}
                >
                  <SaveIcon className="w-4 h-4" />
                  {mode === "edit" ? "Save changes" : "Create event"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <PencilIcon className="w-6 h-6" />
                  <h1>
                    {mode === "edit"
                      ? (defaultValues?.name ?? "Edit Event")
                      : "Create Event"}
                  </h1>
                </span>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {mode === "edit"
                  ? "Update the event information. Changes will apply immediately after saving."
                  : "Fill out the form below to create a new event."}
              </p>
            </div>
          </div>

          {/* ================= BASIC INFORMATION ================= */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Basic Information</p>
              <span className="text-xs text-base-content/60">
                Required fields
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInputText
                name="name"
                control={control}
                label="Name"
                placeholder="Event name"
                rules={{ required: "Name is required" }}
              />

              <FormAutocomplete
                name="eventTypeId"
                control={control}
                label="Event Type"
                placeholder="Search event type..."
                options={eventTypes.map((e) => ({
                  value: e.id,
                  label: e.name,
                }))}
                rules={{ required: "Event Type is required" }}
              />

              <FormDatePicker
                name="date"
                placeholder="Select date"
                control={control}
                label="Date"
                rules={{
                  required: "Date is required",
                }}
              />

              <FormAutocomplete
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
                    label: `${tz.name} - ${tz.code} (UTC${sign}${hours}:${minutes})`,
                  };
                })}
                rules={{ required: "Timezone is required" }}
              />

              <FormInputTime
                name="startTime"
                control={control}
                label="Start Time"
                rules={{ required: "Start Time is required" }}
              />

              <FormInputTime
                name="endTime"
                control={control}
                label="End Time"
                rules={{ required: "End Time is required" }}
              />

              <div className="md:col-span-2">
                <FormInputText
                  name="address"
                  control={control}
                  label="Address"
                  placeholder="Event address"
                  rules={{ required: "Address is required" }}
                />
              </div>
            </div>
          </section>

          {/* ================= ENTITIES ================= */}
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
              <FormAutocomplete<EventFormValues>
                name="stateId"
                control={control}
                label="State"
                placeholder="Select state..."
                options={stateOptions}
                disabled={!tenantId}
              />

              <FormAutocomplete<EventFormValues>
                name="entitiesLocationId"
                control={control}
                label="City"
                placeholder="Select city..."
                loading={loadingLocations}
                options={locationOptions}
                disabled={!tenantId || loadingLocations}
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

          {/* ================= EVENT DETAILS ================= */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <p className="font-semibold text-lg">Event Details</p>

            <div className="grid grid-cols-1 gap-4">
              <FormTextarea name="notes" control={control} label="Notes" />
              <FormCheckbox
                name="isNational"
                control={control}
                label="Is National?"
              />
            </div>
          </section>

          {/* ================= LOCATION ================= */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <p className="font-semibold text-lg">Location</p>

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

          {/* ================= FOOTER ================= */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <Link
              type="button"
              className="btn btn-sm btn-outline"
              to="/events/list"
            >
              <XCircleIcon className="w-4 h-4" />
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!isDirty}
            >
              <SaveIcon className="w-4 h-4" />
              {mode === "edit" ? "Save changes" : "Create event"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
