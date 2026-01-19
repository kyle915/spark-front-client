import FormAutocomplete from "@/shared/FormAutocomplete";
import FormInputText from "@/shared/FormInputText";
import { useEffect, useMemo, useState } from "react";
import { useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";

interface Step3NewProps {
  control: Control<SparkFormData, any, SparkFormData>;
  setValue: UseFormSetValue<SparkFormData>;
  distributors: {
    id: string;
    name: string;
    location?: { id: string; name: string } | null;
  }[];
  retailers: {
    id: string;
    name: string;
    location?: { id: string; name: string } | null;
  }[];
  onLocationSearch: (value: string) => void;
  onLocationChange: (value: string) => void;
  onRetailerSearch: (value: string) => void;
  requestTypes: {
    id: string;
    name: string;
  }[];
  locations: {
    id: string;
    name: string;
  }[];
}

export function Step3Clients({
  control,
  setValue,
  requestTypes,
  locations,
  onLocationSearch,
  onLocationChange,
  onRetailerSearch,
  distributors,
  retailers,
}: Step3NewProps) {
  const [distributorQuery, setDistributorQuery] = useState("");
  const [requestTypeQuery, setRequestTypeQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState<{
    id: string;
    name: string;
    location?: { id: string; name: string } | null;
  } | null>(null);

  const selectedDistributorId = useWatch({
    control,
    name: "distributorId",
  });

  const selectedRetailerId = useWatch({
    control,
    name: "retailerId",
  });

  const selectedLocationId = useWatch({
    control,
    name: "locationId",
  });

  useEffect(() => {
    if (selectedDistributorId) {
      const selected = distributors.find((d) => d.id === selectedDistributorId);
      if (selected) {
        setValue("distributor", selected.name, { shouldValidate: true });
      }
    }
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
  }, [retailers, selectedRetailerId, setValue]);

  useEffect(() => {
    if (!selectedLocationId) return;

    if (selectedDistributorId) {
      const selected = distributors.find((d) => d.id === selectedDistributorId);
      if (selected && selected.location?.id !== selectedLocationId) {
        setValue("distributorId", "", { shouldValidate: true });
      }
    }

    if (selectedRetailerId) {
      const selected = retailers.find((r) => r.id === selectedRetailerId);
      if (selected && selected.location?.id !== selectedLocationId) {
        setValue("retailerId", "", { shouldValidate: true });
      }
    }
  }, [
    distributors,
    retailers,
    selectedDistributorId,
    selectedLocationId,
    selectedRetailerId,
    setValue,
  ]);

  useEffect(() => {
    if (!selectedLocationId) {
      setSelectedLocation(null);
      return;
    }

    const match = locations.find((location) => location.id === selectedLocationId);
    if (match) {
      setSelectedLocation(match);
    }
  }, [locations, selectedLocationId]);

  useEffect(() => {
    onLocationChange(selectedLocationId ?? "");
  }, [onLocationChange, selectedLocationId]);

  const filteredRequestTypes = useMemo(() => {
    const q = requestTypeQuery.trim().toLowerCase();
    if (!q) return requestTypes;
    return requestTypes.filter((rt) => rt.name.toLowerCase().includes(q));
  }, [requestTypes, requestTypeQuery]);

  const filteredDistributors = useMemo(() => {
    const q = distributorQuery.trim().toLowerCase();
    const byLocation = selectedLocationId
      ? distributors.filter((d) => d.location?.id === selectedLocationId)
      : distributors;
    if (!q) return byLocation;
    return byLocation.filter((d) => d.name.toLowerCase().includes(q));
  }, [distributors, distributorQuery, selectedLocationId]);

  const locationOptions = useMemo(() => {
    if (!selectedLocation) return locations;
    return [
      selectedLocation,
      ...locations.filter((location) => location.id !== selectedLocation.id),
    ];
  }, [locations, selectedLocation]);

  const filteredRetailers = useMemo(() => {
    const byLocation = selectedLocationId
      ? retailers.filter((r) => r.location?.id === selectedLocationId)
      : retailers;
    if (!selectedRetailer) return byLocation;
    return [
      selectedRetailer,
      ...byLocation.filter((r) => r.id !== selectedRetailer.id),
    ];
  }, [retailers, selectedLocationId, selectedRetailer]);

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
          name="locationId"
          label="Location"
          control={control}
          options={locationOptions.map((location) => ({
            value: location.id,
            label: location.name,
          }))}
          placeholder="Search location"
          onSearch={onLocationSearch}
        />
      </div>
      <div className="space-y-6 pt-4 border-t border-base-300">
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
          />
          <FormInputText
            name="distributor"
            label="Other Distributor"
            control={control}
            placeholder="Other Distributor"
            disabled={!!selectedDistributorId}
          />

          <FormInputText
            name="distributorEmail"
            label="Distributor Email"
            control={control}
            placeholder="distributor@example.com"
            disabled={!!selectedDistributorId}
          />
        </div>
      </div>
      {/* RETAILER EXTRA FIELDS */}
      <div className="space-y-6 pt-4 border-t border-base-300">
        <h3 className="font-semibold text-lg">Retailer Details</h3>
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
        />
          <FormInputText
            name="retailer"
            label="Other Retailer"
            control={control}
            placeholder="Retail store name"
            disabled={!!selectedRetailerId}
          />
          <FormInputText
            name="retailerAddress"
            label="Retailer Address"
            control={control}
            placeholder="Street, city, and store reference"
            disabled={!!selectedRetailerId}
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
