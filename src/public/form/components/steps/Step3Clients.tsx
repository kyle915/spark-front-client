import FormAutocomplete from "@/shared/FormAutocomplete";
import FormCheckbox from "@/shared/FormCheckbox";
import FormInputText from "@/shared/FormInputText";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";

interface Step3NewProps {
  control: Control<SparkFormData>;
  setValue: UseFormSetValue<SparkFormData>;
  distributors: {
    id: string;
    name: string;
    location?: { id: string; name: string; state?: { id: string; name: string } | null } | null;
  }[];
  retailers: {
    id: string;
    name: string;
    location?: { id: string; name: string; state?: { id: string; name: string } | null } | null;
  }[];
  onStateSearch: (value: string) => void;
  onStateChange: (value: string) => void;
  onRetailerSearch: (value: string) => void;
  onNationalRetailerChange: (value: boolean) => void;
  requestTypes: {
    id: string;
    name: string;
  }[];
  states: {
    id: string;
    name: string;
    code?: string;
  }[];
  requestUrlName: string;
}

export function Step3Clients({
  control,
  setValue,
  requestTypes,
  states,
  onStateSearch,
  onStateChange,
  onRetailerSearch,
  onNationalRetailerChange,
  distributors,
  retailers,
  requestUrlName,
}: Step3NewProps) {
  const [distributorQuery, setDistributorQuery] = useState("");
  const [requestTypeQuery, setRequestTypeQuery] = useState("");
  const [selectedState, setSelectedState] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState<{
    id: string;
    name: string;
    location?: { id: string; name: string; state?: { id: string; name: string } | null } | null;
  } | null>(null);

  const selectedDistributorId = useWatch({
    control,
    name: "distributorId",
  });

  const selectedRetailerId = useWatch({
    control,
    name: "retailerId",
  });

  const selectedStateId = useWatch({
    control,
    name: "stateId",
  });
  const isNationalRetailer = useWatch({
    control,
    name: "isNationalRetailer",
  });
  const prevIsNationalRetailerRef = useRef<boolean | undefined>(undefined);
  const isLocationSelected = Boolean(selectedStateId);
  const isJeeterTenant = requestUrlName
    .trim()
    .toLowerCase()
    .includes("jeeter");

  useEffect(() => {
    if (selectedDistributorId) {
      const selected = distributors.find((d) => d.id === selectedDistributorId);
      if (selected) {
        setValue("distributor", selected.name, { shouldValidate: true });
      }
      return;
    }
    setValue("distributor", "", { shouldValidate: true });
    setValue("distributorEmail", "", { shouldValidate: true });
  }, [distributors, selectedDistributorId, setValue]);

  useEffect(() => {
    if (selectedRetailerId) {
      const selected = retailers.find((r) => r.id === selectedRetailerId);
      if (selected) {
        setValue("retailer", selected.name, { shouldValidate: true });
        setSelectedRetailer(selected);
      }
      return;
    }
    setSelectedRetailer(null);
    setValue("retailer", "", { shouldValidate: true });
    setValue("retailerAddress", "", { shouldValidate: true });
  }, [retailers, selectedRetailerId, setValue]);

  useEffect(() => {
    if (!selectedStateId) return;

    if (selectedDistributorId) {
      const selected = distributors.find((d) => d.id === selectedDistributorId);
      if (selected && selected.location?.state?.id !== selectedStateId) {
        setValue("distributorId", "", { shouldValidate: true });
      }
    }

  }, [
    distributors,
    selectedDistributorId,
    selectedStateId,
    setValue,
  ]);

  useEffect(() => {
    if (!isJeeterTenant) return;

    setValue("distributorId", "", { shouldValidate: true });
    setValue("distributor", "", { shouldValidate: true });
    setValue("distributorEmail", "", { shouldValidate: true });
  }, [isJeeterTenant, setValue]);

  useEffect(() => {
    if (isNationalRetailer || !selectedStateId || !selectedRetailerId) return;
    const selected = retailers.find((r) => r.id === selectedRetailerId);
    if (selected && selected.location?.state?.id !== selectedStateId) {
      setValue("retailerId", "", { shouldValidate: true });
    }
  }, [
    isNationalRetailer,
    selectedStateId,
    selectedRetailerId,
    retailers,
    setValue,
  ]);

  useEffect(() => {
    if (!selectedStateId) {
      setSelectedState(null);
      return;
    }

    const match = states.find((state) => state.id === selectedStateId);
    if (match) {
      setSelectedState(match);
    }
  }, [states, selectedStateId]);

  useEffect(() => {
    onStateChange(selectedStateId ?? "");
  }, [onStateChange, selectedStateId]);

  const californiaState = useMemo(
    () =>
      states.find(
        (state) =>
          state.name.toLowerCase() === "california" ||
          state.code?.toLowerCase() === "ca",
      ) ?? null,
    [states],
  );

  useEffect(() => {
    if (!isJeeterTenant || !californiaState) return;
    if (selectedStateId === californiaState.id) return;

    setValue("stateId", californiaState.id, { shouldValidate: true });
  }, [isJeeterTenant, californiaState, selectedStateId, setValue]);

  useEffect(() => {
    const currentValue = Boolean(isNationalRetailer);
    onNationalRetailerChange(currentValue);

    if (prevIsNationalRetailerRef.current === undefined) {
      prevIsNationalRetailerRef.current = currentValue;
      return;
    }

    if (prevIsNationalRetailerRef.current !== currentValue) {
      prevIsNationalRetailerRef.current = currentValue;
      setValue("retailerId", "", { shouldValidate: true });
    }
  }, [isNationalRetailer, onNationalRetailerChange, setValue]);

  const filteredRequestTypes = useMemo(() => {
    const q = requestTypeQuery.trim().toLowerCase();
    if (!q) return requestTypes;
    return requestTypes.filter((rt) => rt.name.toLowerCase().includes(q));
  }, [requestTypes, requestTypeQuery]);

  const filteredDistributors = useMemo(() => {
    const q = distributorQuery.trim().toLowerCase();
    const byState = selectedStateId
      ? distributors.filter((d) => d.location?.state?.id === selectedStateId)
      : distributors;
    if (!q) return byState;
    return byState.filter((d) => d.name.toLowerCase().includes(q));
  }, [distributors, distributorQuery, selectedStateId]);

  const stateOptions = useMemo(() => {
    const availableStates =
      isJeeterTenant && californiaState ? [californiaState] : states;

    if (!selectedState) return availableStates;
    return [
      selectedState,
      ...availableStates.filter((state) => state.id !== selectedState.id),
    ];
  }, [states, selectedState, isJeeterTenant, californiaState]);

  const filteredRetailers = useMemo(() => {
    const baseRetailers =
      isNationalRetailer || !selectedStateId
        ? retailers
        : retailers.filter((r) => r.location?.state?.id === selectedStateId);
    if (!selectedRetailer) return baseRetailers;
    return [
      selectedRetailer,
      ...baseRetailers.filter((r) => r.id !== selectedRetailer.id),
    ];
  }, [isNationalRetailer, retailers, selectedStateId, selectedRetailer]);

  return (
    <div className="space-y-10">
      {/* REQUEST TYPE SELECT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormAutocomplete
          name="request_type"
          label="Request Type"
          control={control}
          options={filteredRequestTypes.map((rt) => ({
            value: rt.id,
            label: rt.name,
          }))}
          placeholder="Search request type"
          onSearch={setRequestTypeQuery}
        />
        <FormAutocomplete
          name="stateId"
          label="State"
          control={control}
          options={stateOptions.map((state) => ({
            value: state.id,
            label: state.name,
          }))}
          placeholder="Search state"
          onSearch={onStateSearch}
          disabled={isJeeterTenant}
        />
      </div>
      <div className="space-y-6 pt-4 border-t border-base-300">
        {!isLocationSelected && (
          <p className="text-sm text-warning">
            Select a state first to enable retailer.
          </p>
        )}
        {!isJeeterTenant && (
          <>
            <h3 className="font-semibold text-lg">Distributor Details</h3>
            {/* DISTRIBUTOR TEXT INPUTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormAutocomplete
                name="distributorId"
                label="Distributor"
                control={control}
                options={filteredDistributors.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
                placeholder="Search a distributor"
                onSearch={setDistributorQuery}
                disabled={!isLocationSelected}
              />
              <FormInputText
                name="distributor"
                label="Other Distributor"
                control={control}
                placeholder="Other Distributor"
                disabled={!!selectedDistributorId || !isLocationSelected}
              />

              <FormInputText
                name="distributorEmail"
                label="Distributor Email"
                control={control}
                placeholder="distributor@example.com"
                disabled={!!selectedDistributorId || !isLocationSelected}
              />
            </div>
          </>
        )}
      </div>
      {/* RETAILER EXTRA FIELDS */}
      <div className="space-y-6 pt-4 border-t border-base-300">
        <h3 className="font-semibold text-lg">Retailer Details</h3>
        <FormCheckbox
          name="isNationalRetailer"
          label="Is National Retailer"
          control={control}
        />
        {/* RETAILER INPUT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormAutocomplete
            name="retailerId"
            label="Retailer"
            control={control}
            options={filteredRetailers.map((r) => ({
              value: r.id,
              label: r.name,
            }))}
            placeholder="Search a retailer"
            onSearch={onRetailerSearch}
            disabled={!isLocationSelected}
          />
          <FormInputText
            name="retailer"
            label="Other Retailer"
            control={control}
            placeholder="Retail store name"
            disabled={!!selectedRetailerId || !isLocationSelected}
          />
          <FormInputText
            name="retailerAddress"
            label="Retailer Address"
            control={control}
            placeholder="Street, city, and store reference"
            disabled={!!selectedRetailerId || !isLocationSelected}
          />
        </div>
        <div className="space-y-6 pt-4 border-t border-base-300">
          <h3 className="font-semibold text-lg">Store Details</h3>
          <FormInputText
            name="retailerStoreContact"
            label="Store Contact"
            control={control}
            placeholder="Main contact number"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInputText
            name="storeManagerName"
            label="Store Manager Name"
            control={control}
            placeholder="Manager's full name"
          />

          <FormInputText
            name="storeManagerContact"
            label="Store Manager Contact Phone"
            control={control}
            placeholder="Manager's phone number"
          />
        </div>
      </div>
    </div>
  );
}
