import { Controller, useForm, useWatch } from "react-hook-form";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import type {
  EventFormValues,
  EventFormProps,
} from "../../types/events/formTypes";

import FormInputText from "@shared/FormInputText";
import FormInputTime from "@shared/FormInputTime";
import FormAutocomplete from "@shared/FormAutocomplete";
import FormDatePicker from "@shared/FormDatePicker";
import EditableLocationMap from "@shared/EditableLocationMap";
import FormCheckbox from "@shared/FormCheckbox";
import FormTextarea from "@shared/FormTextarea";

import {
  ArrowLeftIcon,
  PencilIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { SaveIcon } from "lucide-react";

import { useMutation } from "react-relay/hooks";
import { useAlertStore } from "@store/alertStore";

import { CreateRequestStoreManagerMutation } from "@api/mutations/CreateRequestStoreManagerMutation";
import type { CreateRequestStoreManagerMutation as CreateRequestStoreManagerMutationType } from "@api/mutations/__generated__/CreateRequestStoreManagerMutation.graphql";

import { CreateDistributorMutation } from "@api/mutations/CreateDistributorMutation";
import type { CreateDistributorMutation as CreateDistributorMutationType } from "@api/mutations/__generated__/CreateDistributorMutation.graphql";

import { CreateRetailerMutation } from "@api/mutations/CreateRetailerMutation";
import type { CreateRetailerMutation as CreateRetailerMutationType } from "@api/mutations/__generated__/CreateRetailerMutation.graphql";

export default function EventForm({
  eventTypes,
  tenantId,
  requestId,
  distributors = [],
  retailers = [],
  requestStoreManagers = [],
  locations = [],
  requestContactInfo,
  enableContactSection,
  contactMode,
  onSubmit,
  defaultValues = {},
  onRefetch,
}: EventFormProps) {
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();

  /* ================= FORM ================= */
  const { handleSubmit, control, setValue } = useForm<EventFormValues>({
    defaultValues,
  });

  /* ================= WATCH ================= */
  const distributorId = useWatch({ control, name: "distributorId" });
  const retailerId = useWatch({ control, name: "retailerId" });
  const storeManagerId = useWatch({ control, name: "storeManagerId" });

  const distributorLocationId = useWatch({
    control,
    name: "distributorLocationId",
  });
  const retailerLocationId = useWatch({
    control,
    name: "retailerLocationId",
  });

  const manualFields = useWatch({ control });

  /* ================= UI STATE ================= */
  const [showDistributorLocation, setShowDistributorLocation] = useState(false);
  const [showRetailerLocation, setShowRetailerLocation] = useState(false);

  /* ================= CONTACT MODE ================= */
  const effectiveContactMode = useMemo(
    () => contactMode ?? (requestContactInfo ? "request" : "manual"),
    [contactMode, requestContactInfo]
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

  /* ================= OPTIONS ================= */
  const distributorsOptions = useMemo(
    () =>
      distributors.map((d) => ({
        value: d.id,
        label: d.email ? `${d.name} (${d.email})` : d.name,
      })),
    [distributors]
  );

  const retailersOptions = useMemo(
    () =>
      retailers.map((r) => ({
        value: r.id,
        label: r.address ? `${r.name} - ${r.address}` : r.name,
      })),
    [retailers]
  );

  const storeManagerOptions = useMemo(
    () =>
      requestStoreManagers.map((m) => ({
        value: m.id,
        label: m.phone ? `${m.name} (${m.phone})` : m.name,
      })),
    [requestStoreManagers]
  );

  /* ================= MUTATIONS ================= */
  const [commitCreateDistributor, isCreatingDistributor] =
    useMutation<CreateDistributorMutationType>(CreateDistributorMutation);

  const [commitCreateRetailer, isCreatingRetailer] =
    useMutation<CreateRetailerMutationType>(CreateRetailerMutation);

  const [commitCreateStoreManager, isCreatingStoreManager] =
    useMutation<CreateRequestStoreManagerMutationType>(
      CreateRequestStoreManagerMutation
    );

  /* ================= HANDLERS ================= */
  const handleCreateDistributor = () => {
    const { distributorName, distributorEmail } = contactInfo;

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
          setValue("distributorId", distributor.id);
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
          setValue("retailerId", retailer.id);
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

  const handleCreateStoreManager = () => {
    const { storeManagerName, storeManagerPhone } = contactInfo;

    if (!storeManagerName || !storeManagerPhone) {
      showAlert("Store manager name and phone required.", "error");
      return;
    }

    commitCreateStoreManager({
      variables: {
        input: {
          tenantId,
          requestId: requestId ?? "",
          name: storeManagerName,
          phone: storeManagerPhone,
        },
      },
      onCompleted: (res) => {
        const manager = res.createRequestStoreManager?.requestStoreManager;
        if (res.createRequestStoreManager?.success && manager) {
          setValue("storeManagerId", manager.id);
          onRefetch?.("requestStoreManagers");
          showAlert(res.createRequestStoreManager.message, "success");
        } else {
          showAlert(res.createRequestStoreManager?.message ?? "Error", "error");
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
          <div className="flex flex-col gap-5 pb-6 border-b border-base-100/20">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/events/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate(-1)}
                >
                  <XCircleIcon className="w-4 h-4" />
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-primary">
                  <SaveIcon className="w-4 h-4" />
                  Save changes
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <PencilIcon className="w-4 h-4 text-base-content/50" />
                <p className="text-xs uppercase tracking-[0.5em] text-base-content/40">
                  Edit Event
                </p>
              </div>
              <h1 className="text-3xl font-semibold mt-1">
                {defaultValues?.name ?? "Edit Event"}
              </h1>
              <p className="text-base-content/70 text-sm mt-2">
                Update the event information. Changes will apply immediately
                after saving.
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
                placeholder="Event name"
                control={control}
                label="Name"
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
                rules={{ required: "Date is required" }}
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
                  placeholder="Event address"
                  control={control}
                  label="Address"
                  rules={{ required: "Address is required" }}
                />
              </div>
            </div>
          </section>

          {/* ================= ENTITIES ================= */}
          {showContactSection && (
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Entities</p>
                <span className="text-xs text-base-content/60">
                  Retailer & Distributor
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormAutocomplete
                  name="retailerId"
                  control={control}
                  label="Retailer"
                  options={retailersOptions}
                />

                <FormAutocomplete
                  name="distributorId"
                  control={control}
                  label="Distributor"
                  options={distributorsOptions}
                />

                <FormAutocomplete
                  name="storeManagerId"
                  control={control}
                  label="Store Manager"
                  options={storeManagerOptions}
                />
              </div>

              {/* CREATE ACTIONS */}
              {!distributorId && (
                <>
                  {showDistributorLocation && (
                    <FormAutocomplete
                      name="distributorLocationId"
                      control={control}
                      label="Distributor Location"
                      options={locations.map((l) => ({
                        value: l.id,
                        label: l.name,
                      }))}
                    />
                  )}

                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={
                      showDistributorLocation
                        ? handleCreateDistributor
                        : () => setShowDistributorLocation(true)
                    }
                    disabled={isCreatingDistributor}
                  >
                    {showDistributorLocation
                      ? "Confirm create distributor"
                      : "Create distributor"}
                  </button>
                </>
              )}

              {!retailerId && (
                <>
                  {showRetailerLocation && (
                    <FormAutocomplete
                      name="retailerLocationId"
                      control={control}
                      label="Retailer Location"
                      options={locations.map((l) => ({
                        value: l.id,
                        label: l.name,
                      }))}
                    />
                  )}

                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={
                      showRetailerLocation
                        ? handleCreateRetailer
                        : () => setShowRetailerLocation(true)
                    }
                    disabled={isCreatingRetailer}
                  >
                    {showRetailerLocation
                      ? "Confirm create retailer"
                      : "Create retailer"}
                  </button>
                </>
              )}

              {!storeManagerId && (
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={handleCreateStoreManager}
                  disabled={isCreatingStoreManager}
                >
                  Create store manager
                </button>
              )}
            </section>
          )}

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
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save changes
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
