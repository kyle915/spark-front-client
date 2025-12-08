import { Controller, useForm } from "react-hook-form";
import FormInputText from "@shared/FormInputText";
import FormInputTime from "@shared/FormInputTime";
import FormSelect from "@shared/FormSelect";
import EditableLocationMap from "@/shared/EditableLocationMap";

export interface RequestFormValues {
  name: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  address: string;
  coordinates?: number[] | null;
  clientId?: string | null;
  retailerId?: string | null;
  distributorId?: string | null;
  requestTypeId?: string | null;
}

interface CatalogItem {
  id: string;
  name: string;
}

interface RequestFormProps {
  onSubmit: (data: RequestFormValues) => void;
  defaultValues?: Partial<RequestFormValues>;
  clients: CatalogItem[];
  retailers: CatalogItem[];
  distributors: CatalogItem[];
  requestTypes: CatalogItem[];
}

export default function RequestForm({
  onSubmit,
  defaultValues = {},
  clients,
  retailers,
  distributors,
  requestTypes,
}: RequestFormProps) {
  const { handleSubmit, control } = useForm<RequestFormValues>({
    defaultValues,
  });

  return (
    <form className="p-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Name */}
        <FormInputText<RequestFormValues>
          name="name"
          control={control}
          label="Name"
          placeholder="Enter name"
          rules={{ required: "Name is required" }}
        />

        {/* Client */}
        <FormSelect<RequestFormValues>
          name="clientId"
          control={control}
          label="Client"
          placeholder="Select Client"
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />

        {/* Retailer */}
        <FormSelect<RequestFormValues>
          name="retailerId"
          control={control}
          label="Retailer"
          placeholder="Select Retailer"
          options={retailers.map((r) => ({ value: r.id, label: r.name }))}
        />

        {/* Distributor */}
        <FormSelect<RequestFormValues>
          name="distributorId"
          control={control}
          label="Distributor"
          placeholder="Select Distributor"
          options={distributors.map((d) => ({ value: d.id, label: d.name }))}
        />

        {/* Request Type */}
        <FormSelect<RequestFormValues>
          name="requestTypeId"
          control={control}
          label="Request Type"
          placeholder="Select Request Type"
          options={requestTypes.map((rt) => ({ value: rt.id, label: rt.name }))}
        />

        {/* Date */}
        <FormInputText<RequestFormValues>
          name="date"
          control={control}
          label="Date"
          type="date"
          placeholder="Select date"
          rules={{ required: "Date is required" }}
        />

        {/* Start Time */}
        <FormInputTime<RequestFormValues>
          name="startTime"
          control={control}
          label="Start Time"
        />

        {/* End Time */}
        <FormInputTime<RequestFormValues>
          name="endTime"
          control={control}
          label="End Time"
        />

        {/* Address */}
        <FormInputText<RequestFormValues>
          name="address"
          control={control}
          label="Address"
          placeholder="Enter address"
          rules={{ required: "Address is required" }}
        />
      </div>

      {/* Coordinates Map */}
      <div className="mt-4">
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
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn btn-primary" type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
