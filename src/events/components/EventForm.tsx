import { useForm } from "react-hook-form";
import type {
  EventFormValues,
  EventFormProps,
} from "../../types/events/formTypes";
import FormInputText from "@shared/FormInputText";
import FormAutocomplete from "@shared/FormAutocomplete";
import FormInputTime from "@shared/FormInputTime";
import FormCheckbox from "@shared/FormCheckbox";
import FormTextarea from "@shared/FormTextarea";
import { useMemo, useState, useEffect } from "react";
import { useMutation } from "react-relay/hooks";
import { CreateRequestStoreManagerMutation } from "@/api/mutations/CreateRequestStoreManagerMutation";
import type { CreateRequestStoreManagerMutation as CreateRequestStoreManagerMutationType } from "@api/mutations/__generated__/CreateRequestStoreManagerMutation.graphql";
import { CreateDistributorMutation } from "@/api/mutations/CreateDistributorMutation";
import type { CreateDistributorMutation as CreateDistributorMutationType } from "@api/mutations/__generated__/CreateDistributorMutation.graphql";
import { CreateRetailerMutation } from "@/api/mutations/CreateRetailerMutation";
import type { CreateRetailerMutation as CreateRetailerMutationType } from "@api/mutations/__generated__/CreateRetailerMutation.graphql";
import { useAlertStore } from "@store/alertStore";

export default function EventForm({
  eventTypes,
  tenantId,
  requestId,
  distributors = [],
  retailers = [],
  requestStoreManagers = [],
  locations = [],
  requestContactInfo,
  onSubmit,
  defaultValues = {},
  onRefetch,
}: EventFormProps) {
  const { handleSubmit, control, setValue, watch } = useForm<EventFormValues>({
    defaultValues,
  });
  const { showAlert } = useAlertStore();
  const [commitCreateRSM, isCreatingRSM] =
    useMutation<CreateRequestStoreManagerMutationType>(
      CreateRequestStoreManagerMutation
    );
  const [commitCreateDistributor, isCreatingDistributor] =
    useMutation<CreateDistributorMutationType>(CreateDistributorMutation);
  const [commitCreateRetailer, isCreatingRetailer] =
    useMutation<CreateRetailerMutationType>(CreateRetailerMutation);

  const [distributorOptionsState, setDistributorOptionsState] =
    useState(distributors);
  const [retailerOptionsState, setRetailerOptionsState] = useState(retailers);
  const [storeManagerOptionsState, setStoreManagerOptionsState] =
    useState(requestStoreManagers);
  const selectedStoreManagerId = watch("storeManagerId");
  const selectedDistributorLocationId = watch("distributorLocationId");
  const selectedRetailerLocationId = watch("retailerLocationId");
  const selectedDistributorId = watch("distributorId");
  const selectedRetailerId = watch("retailerId");

  const [showDistributorLocation, setShowDistributorLocation] = useState(false);
  const [showRetailerLocation, setShowRetailerLocation] = useState(false);

  useEffect(() => {
    setDistributorOptionsState(distributors);
  }, [distributors]);

  useEffect(() => {
    setRetailerOptionsState(retailers);
  }, [retailers]);

  useEffect(() => {
    if (!requestStoreManagers) return;
    setStoreManagerOptionsState((prev) => {
      const selectedItem = selectedStoreManagerId
        ? prev.find((m) => m.id === selectedStoreManagerId)
        : null;
      if (
        selectedItem &&
        !requestStoreManagers.some((m) => m.id === selectedItem.id)
      ) {
        return [...requestStoreManagers, selectedItem];
      }
      return requestStoreManagers;
    });
  }, [requestStoreManagers, selectedStoreManagerId]);

  useEffect(() => {
    if (!selectedStoreManagerId) return;
    const manager = storeManagerOptionsState.find(
      (m) => m.id === selectedStoreManagerId
    );
    if (manager) {
      setValue("storeManagerName", manager.name);
      setValue("storeManagerPhone", manager.phone);
    }
  }, [selectedStoreManagerId, storeManagerOptionsState, setValue]);

  const extractDomain = (email?: string | null) =>
    email?.split("@")[1]?.toLowerCase() ?? null;

  const findMatchByEmailDomain = (email?: string | null) => {
    const domain = extractDomain(email);
    if (!domain) return null;
    return (item: { email?: string | null }) =>
      extractDomain(item.email) === domain;
  };

  const distributorsOptions = useMemo(
    () =>
      distributorOptionsState.map((distributor) => ({
        value: distributor.id,
        label: distributor.email
          ? `${distributor.name} (${distributor.email})`
          : distributor.name,
      })),
    [distributorOptionsState]
  );

  const retailersOptions = useMemo(
    () =>
      retailerOptionsState.map((retailer) => ({
        value: retailer.id,
        label: retailer.address
          ? `${retailer.name} - ${retailer.address}`
          : retailer.name,
      })),
    [retailerOptionsState]
  );

  const storeManagerOptions = useMemo(
    () =>
      storeManagerOptionsState.map((manager) => ({
        value: manager.id,
        label: manager.phone
          ? `${manager.name} (${manager.phone})`
          : manager.name,
      })),
    [storeManagerOptionsState]
  );

  const distributorMatch = useMemo(() => {
    const predicate = findMatchByEmailDomain(
      requestContactInfo?.distributorEmail
    );
    if (!predicate) return null;
    return distributors.find(predicate) ?? null;
  }, [distributors, requestContactInfo?.distributorEmail]);

  const handleCreateDistributor = () => {
    const name = requestContactInfo?.distributorName;
    const email = requestContactInfo?.distributorEmail;
    if (!name || !email || !selectedDistributorLocationId) {
      showAlert("Missing distributor name, email or location.", "error");
      return;
    }
    commitCreateDistributor({
      variables: {
        input: {
          tenantId,
          name,
          email,
          locationId: selectedDistributorLocationId,
        },
      },
      onCompleted: (response) => {
        const distributor = response.createDistributor?.distributor;
        if (response.createDistributor?.success && distributor) {
          setDistributorOptionsState((prev) => [...prev, distributor]);
          setValue("distributorId", distributor.id);
          setShowDistributorLocation(false);
          onRefetch?.("distributors");
          showAlert(response.createDistributor.message, "success");
        } else {
          showAlert(
            response.createDistributor?.message ?? "Error creating distributor",
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating distributor: ${error.message}`, "error");
      },
    });
  };

  const handleCreateRetailer = () => {
    const name = requestContactInfo?.retailerName;
    const address = requestContactInfo?.retailerAddress;
    const storeContact = requestContactInfo?.retailerStoreContact ?? "";

    if (!name || !address || !selectedRetailerLocationId) {
      showAlert("Missing retailer name, address or location.", "error");
      return;
    }

    commitCreateRetailer({
      variables: {
        input: {
          tenantId,
          name,
          address,
          storeContact,
          locationId: selectedRetailerLocationId,
        },
      },
      onCompleted: (response) => {
        const retailer = response.createRetailer?.retailer;
        if (response.createRetailer?.success && retailer) {
          setRetailerOptionsState((prev) => [...prev, retailer]);
          setValue("retailerId", retailer.id);
          setShowRetailerLocation(false);
          onRefetch?.("retailers");
          showAlert(response.createRetailer.message, "success");
        } else {
          showAlert(
            response.createRetailer?.message ?? "Error creating retailer",
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating retailer: ${error.message}`, "error");
      },
    });
  };

  const handleCreateStoreManager = () => {
    if (!requestId) {
      showAlert("Missing requestId to create store manager.", "error");
      return;
    }
    const name =
      requestContactInfo?.storeManagerName ??
      requestContactInfo?.retailerStoreContact;
    const phone = requestContactInfo?.storeManagerPhone ?? "";
    if (!name || !phone) {
      showAlert("Request is missing store manager name or phone.", "error");
      return;
    }
    commitCreateRSM({
      variables: {
        input: {
          tenantId,
          requestId,
          name,
          phone,
        },
      },
      onCompleted: (response) => {
        if (response.createRequestStoreManager?.success) {
          const created =
            response.createRequestStoreManager.requestStoreManager;
          if (created) {
            setStoreManagerOptionsState((prev) => [...prev, created]);
            setValue("storeManagerId", created.id);
          }
          setValue("storeManagerName", name);
          setValue("storeManagerPhone", phone);
          onRefetch?.("requestStoreManagers");
          showAlert(response.createRequestStoreManager.message, "success");
        } else {
          showAlert(
            response.createRequestStoreManager?.message ??
              "Error creating store manager",
            "error"
          );
        }
      },
      onError: (error) => {
        showAlert(`Error creating store manager: ${error.message}`, "error");
      },
    });
  };

  return (
    <form className="p-4" onSubmit={handleSubmit(onSubmit)}>
      {requestContactInfo && (
        <div className="mb-6 rounded-lg border border-base-200 bg-base-100 p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-1">
            <h3 className="text-lg font-semibold">Request entities</h3>
            <p className="text-sm text-base-content/70">
              Link request contacts with existing records before creating the
              event.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg bg-base-200/60 p-3">
              <div className="text-sm">
                <p className="font-semibold">Distributor from request</p>
                <p className="text-base-content/70">
                  {requestContactInfo.distributorName ?? "No name"}
                  {requestContactInfo.distributorEmail
                    ? ` • ${requestContactInfo.distributorEmail}`
                    : ""}
                </p>
              </div>
              <FormAutocomplete<EventFormValues>
                name="distributorId"
                control={control}
                label="Link to distributor"
                placeholder="Search distributor..."
                options={distributorsOptions}
              />
              {!selectedDistributorId && (
                <>
                  {showDistributorLocation && (
                    <>
                      <div className="alert alert-info py-2 text-xs">
                        <span>
                          Please select a location for the new distributor.
                        </span>
                      </div>
                      <FormAutocomplete<EventFormValues>
                        name="distributorLocationId"
                        control={control}
                        label="Distributor Location"
                        placeholder="Select location"
                        options={locations.map((l) => ({
                          value: l.id,
                          label: l.name,
                        }))}
                      />
                    </>
                  )}
                  {!showDistributorLocation ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => setShowDistributorLocation(true)}
                    >
                      Create distributor from request
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={handleCreateDistributor}
                        disabled={
                          isCreatingDistributor ||
                          !selectedDistributorLocationId
                        }
                      >
                        Confirm create distributor
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
                  )}
                </>
              )}
              {!distributorMatch && requestContactInfo.distributorEmail && (
                <p className="text-xs text-warning">
                  We could not find {requestContactInfo.distributorEmail}.
                  Select a distributor or create a new one if needed.
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-lg bg-base-200/60 p-3">
              <div className="text-sm">
                <p className="font-semibold">Retailer from request</p>
                <p className="text-base-content/70">
                  {requestContactInfo.retailerName ?? "No name"}
                  {requestContactInfo.retailerAddress
                    ? ` • ${requestContactInfo.retailerAddress}`
                    : ""}
                </p>
              </div>
              <FormAutocomplete<EventFormValues>
                name="retailerId"
                control={control}
                label="Link to retailer"
                placeholder="Search retailer..."
                options={retailersOptions}
              />
              {!selectedRetailerId && (
                <>
                  {showRetailerLocation && (
                    <>
                      <div className="alert alert-info py-2 text-xs">
                        <span>
                          Please select a location for the new retailer.
                        </span>
                      </div>
                      <FormAutocomplete<EventFormValues>
                        name="retailerLocationId"
                        control={control}
                        label="Retailer Location"
                        placeholder="Select location"
                        options={locations.map((l) => ({
                          value: l.id,
                          label: l.name,
                        }))}
                      />
                    </>
                  )}
                  {!showRetailerLocation ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => setShowRetailerLocation(true)}
                    >
                      Create retailer from request
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={handleCreateRetailer}
                        disabled={
                          isCreatingRetailer || !selectedRetailerLocationId
                        }
                      >
                        Confirm create retailer
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
                  )}
                </>
              )}
              {requestContactInfo.retailerStoreContact && (
                <p className="text-xs text-base-content/60">
                  Store contact: {requestContactInfo.retailerStoreContact}
                </p>
              )}
            </div>
            <div className="space-y-2 rounded-lg bg-base-200/60 p-3">
              <div className="text-sm">
                <p className="font-semibold">Store manager from request</p>
                <p className="text-base-content/70">
                  {requestContactInfo.storeManagerName ??
                    requestContactInfo.retailerStoreContact ??
                    "No name"}
                  {requestContactInfo.storeManagerPhone
                    ? ` • ${requestContactInfo.storeManagerPhone}`
                    : ""}
                </p>
              </div>
              <FormAutocomplete<EventFormValues>
                name="storeManagerId"
                control={control}
                label="Link store manager"
                placeholder="Search store manager..."
                options={storeManagerOptions}
              />
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleCreateStoreManager}
                disabled={isCreatingRSM}
              >
                Create store manager from request
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Name */}
        <FormInputText<EventFormValues>
          name="name"
          control={control}
          placeholder="John Doe Event"
          label="Name"
          rules={{ required: "Name is required" }}
        />

        {/* Event Type */}
        <FormAutocomplete<EventFormValues>
          name="eventTypeId"
          control={control}
          label="Event Type"
          placeholder="Search event type..."
          rules={{ required: "Event Type is required" }}
          options={eventTypes.map((eventType) => ({
            value: eventType.id,
            label: eventType.name,
          }))}
        />

        {/* Start Time */}
        <FormInputTime<EventFormValues>
          name="startTime"
          control={control}
          label="Start Time"
          rules={{ required: "Start Time is required" }}
        />

        {/* End Time */}
        <FormInputTime<EventFormValues>
          name="endTime"
          control={control}
          label="End Time"
          rules={{ required: "End Time is required" }}
        />

        {/* Address */}
        <FormInputText<EventFormValues>
          name="address"
          control={control}
          placeholder="Street, City, State, ZIP"
          label="Address"
          rules={{ required: "Address is required" }}
        />
      </div>
      <div className="mt-4 flex justify-end">
        {/* Notes */}
        <FormTextarea<EventFormValues>
          name="notes"
          control={control}
          label="Notes"
          placeholder="Enter notes"
        />
      </div>
      <div className="mt-4 flex justify-start">
        {/* is_national */}
        <FormCheckbox<EventFormValues>
          name="isNational"
          control={control}
          label="Is National?"
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn btn-primary" type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
