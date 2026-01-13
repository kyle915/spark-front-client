import FormInputText from "@/shared/FormInputText";
import FormDatePicker from "@/shared/FormDatePicker";
import FormInputTime from "@/shared/FormInputTime";
import FormTextarea from "@/shared/FormTextarea";
import FormLocationPicker from "../FormLocationPicker";
import FormSelect from "@/shared/FormSelect";
import { useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";
import { useAutoTimezoneFromCoordinates } from "@/requests/hooks/useAutoTimezoneFromCoordinates";

interface Step1BasicProps {
  control: Control<SparkFormData>;
  setValue: UseFormSetValue<SparkFormData>;
  timeZones?: {
    id: string;
    name: string;
    code: string;
    offset: number;
  }[];
}

export function Step1Basic({
  control,
  timeZones = [],
  setValue,
}: Step1BasicProps) {
  const latitude = useWatch({ control, name: "latitude" });
  const longitude = useWatch({ control, name: "longitude" });
  const timezoneId = useWatch({ control, name: "timeZoneId" });

  const selectedCoordinates =
    typeof latitude === "number" && typeof longitude === "number"
      ? [latitude, longitude]
      : null;

  console.log(selectedCoordinates);

  useAutoTimezoneFromCoordinates<SparkFormData, "timeZoneId">({
    coordinates: selectedCoordinates,
    timezoneId: timezoneId,
    timezones: timeZones,
    setValue,
    timezoneFieldName: "timeZoneId",
    initialFromBackend: false,
  });

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
          setValue={setValue}
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
