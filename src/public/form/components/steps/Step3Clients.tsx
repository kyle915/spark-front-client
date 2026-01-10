import FormInputText from "@/shared/FormInputText";
import FormSelect from "@/shared/FormSelect";
import { useEffect } from "react";
import { useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";

interface Step3NewProps {
  control: Control<SparkFormData, any, SparkFormData>;
  setValue: UseFormSetValue<SparkFormData>;
  distributors: { id: string; name: string }[];
  retailers: { id: string; name: string }[];
  requestTypes: {
    id: string;
    name: string;
  }[];
}

export function Step3Clients({
  control,
  setValue,
  requestTypes,
  distributors,
  retailers,
}: Step3NewProps) {
  const selectedDistributorId = useWatch({
    control,
    name: "distributorId",
  });

  const selectedRetailerId = useWatch({
    control,
    name: "retailerId",
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
      }
    }
  }, [retailers, selectedRetailerId, setValue]);

  return (
    <div className="space-y-10">
      {/* REQUEST TYPE SELECT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect
          name="request_type"
          label="Request Type"
          control={control}
          options={requestTypes.map((rt) => ({
            value: rt.id,
            label: rt.name,
          }))}
        />
      </div>
      <div className="space-y-6 pt-4 border-t border-base-300">
        <h3 className="font-semibold text-lg">Distributor Details</h3>
        {/* DISTRIBUTOR TEXT INPUTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSelect
            name="distributorId"
            label="Distributor"
            control={control}
            options={distributors.map((d) => ({
              value: d.id,
              label: d.name,
            }))}
            placeholder="Select a distributor"
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
          <FormSelect
            name="retailerId"
            label="Retailer"
            control={control}
            options={retailers.map((r) => ({
              value: r.id,
              label: r.name,
            }))}
            placeholder="Select a retailer"
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
    </div >
  );
}
