import FormInputText from "@/shared/FormInputText";
import FormDatePicker from "@/shared/FormDatePicker";
import FormInputTime from "@/shared/FormInputTime";
import FormTextarea from "@/shared/FormTextarea";
import FormLocationPicker from "../FormLocationPicker";
import FormSelect from "@/shared/FormSelect";
import type { Control } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";

interface Step1BasicProps {
  control: Control<SparkFormData, any, SparkFormData>;
  timeZones?: {
    id: string;
    name: string;
  }[];
}

export function Step1Basic({ control, timeZones = [] }: Step1BasicProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormInputText
        name="name"
        label="Full Name"
        control={control}
        placeholder="John Doe"
      />

      <FormDatePicker
        name="date"
        label="Visit Date"
        placeholder="MM/DD/YYYY"
        control={control}
        minToday={true}
      />

      <FormInputTime
        name="start_time"
        label="Start Time"
        control={control}
        placeholder="HH:MM AM/PM"
      />

      <FormInputTime
        name="end_time"
        label="End Time"
        control={control}
        placeholder="HH:MM AM/PM"
      />

      {/* TIME ZONE SELECTOR */}
      <div className="col-span-2">
        <FormSelect
          name="timeZoneId"
          label="Time Zone"
          control={control}
          options={timeZones.map((tz) => ({
            value: tz.id,
            label: tz.name,
          }))}
          placeholder="Select your time zone"
        />
      </div>

      <div className="col-span-2">
        <FormLocationPicker
          control={control}
          nameLat="latitude"
          nameLng="longitude"
          label="Select visit location"
        />
      </div>

      <div className="col-span-2">
        <FormTextarea
          name="address"
          label="Address"
          control={control}
          placeholder="Street, city, and store reference"
        />
      </div>
    </div>
  );
}
