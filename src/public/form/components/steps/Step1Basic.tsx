import FormInputText from "@/shared/FormInputText";
import FormDatePicker from "@/shared/FormDatePicker";
import FormInputTime from "@/shared/FormInputTime";
import FormAddressSearch from "@/shared/FormAddressSearch";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormLocationPicker from "../FormLocationPicker";
import FormSelect from "@/shared/FormSelect";
import { useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";
import { useAutoTimezoneFromCoordinates } from "@/requests/hooks/useAutoTimezoneFromCoordinates";

interface Step1BasicProps {
  control: Control<SparkFormData>;
  setValue: UseFormSetValue<SparkFormData>;
  requestUrlName: string;
  billingEntities?: {
    id: string;
    name: string;
  }[];
  onBillingEntitySearch: (value: string) => void;
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
  requestUrlName,
  billingEntities = [],
  onBillingEntitySearch,
}: Step1BasicProps) {
  const isCarblissTenant = requestUrlName
    .trim()
    .toLowerCase()
    .includes("carbliss");
  const latitude = useWatch({ control, name: "latitude" });
  const longitude = useWatch({ control, name: "longitude" });
  const timezoneId = useWatch({ control, name: "timeZoneId" });
  const date = useWatch({ control, name: "date" });

  const selectedCoordinates =
    typeof latitude === "number" && typeof longitude === "number"
      ? [latitude, longitude]
      : null;

  useAutoTimezoneFromCoordinates<SparkFormData, "timeZoneId">({
    coordinates: selectedCoordinates,
    timezoneId: timezoneId,
    timezones: timeZones,
    setValue,
    timezoneFieldName: "timeZoneId",
    initialFromBackend: false,
    date,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormInputText
        name="name"
        label="Full Name"
        control={control}
        placeholder="e.g. Jane Doe"
      />

      <FormInputText
        name="requestorEmail"
        label="Requestor Email"
        control={control}
        placeholder="e.g. jane@example.com"
        type="email"
      />

      <FormDatePicker
        name="date"
        label="Visit Date"
        placeholder="MM/DD/YYYY"
        control={control}
        minDaysFromToday={2}
      />

      <FormSelect
        name="timeZoneId"
        label="Time Zone"
        control={control}
        disabled
        options={timeZones.map((tz) => ({
          value: tz.id,
          label: tz.name,
        }))}
        placeholder="Select your time zone"
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

      <div className={`${isCarblissTenant ? "" : "md:col-span-2"} relative z-20`}>
        <FormAddressSearch<SparkFormData>
          name="address"
          label="Address"
          control={control}
          placeholder="e.g. 123 Main St, New York"
          onSelect={(result) => {
            setValue("latitude", result.lat, {
              shouldDirty: true,
              shouldTouch: true,
            });
            setValue("longitude", result.lng, {
              shouldDirty: true,
              shouldTouch: true,
            });
          }}
        />
      </div>

      {isCarblissTenant && (
        <FormAutocomplete<SparkFormData>
          name="billingEntityId"
          label="Billing Entity"
          control={control}
          options={billingEntities.map((billingEntity) => ({
            value: billingEntity.id,
            label: billingEntity.name,
          }))}
          placeholder="Search Billing Entity..."
          onSearch={onBillingEntitySearch}
        />
      )}

      <div className="md:col-span-2 relative z-0">
        <FormLocationPicker
          control={control}
          nameLat="latitude"
          nameLng="longitude"
          label="Select visit location"
          setValue={setValue}
        />
      </div>
    </div>
  );
}
