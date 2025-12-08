import FormInputText from "@/shared/FormInputText";
import FormSelect from "@/shared/FormSelect";
import type { SparkFormData } from "../../schema/schema";
import type { Control } from "react-hook-form";

interface Step3NewProps {
  control: Control<SparkFormData>;
  requestTypes: {
    id: string;
    name: string;
  }[];
}

export function Step3Clients({ control, requestTypes }: Step3NewProps) {
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

      {/* CLIENT TEXT INPUTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInputText name="client" label="Client" control={control} />

        <FormInputText
          name="clientEmail"
          label="Client Email"
          control={control}
        />
      </div>

      {/* DISTRIBUTOR TEXT INPUTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInputText
          name="distributor"
          label="Distributor"
          control={control}
        />

        <FormInputText
          name="distributorEmail"
          label="Distributor Email"
          control={control}
        />
      </div>

      {/* RETAILER SELECT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInputText name="retailer" label="Retailer" control={control} />
      </div>

      {/* RETAILER EXTRA FIELDS */}
      <div className="space-y-6 pt-4 border-t border-base-300">
        <h3 className="font-semibold text-lg">Retailer Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInputText
            name="retailerAddress"
            label="Retailer Address"
            control={control}
          />

          <FormInputText
            name="retailerStoreContact"
            label="Store Contact"
            control={control}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInputText
            name="storeManagerName"
            label="Store Manager Name"
            control={control}
          />

          <FormInputText
            name="storeManagerContact"
            label="Store Manager Contact"
            control={control}
          />
        </div>
      </div>
    </div>
  );
}
