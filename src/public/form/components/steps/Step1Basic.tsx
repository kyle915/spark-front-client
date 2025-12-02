import FormInputText from "@/shared/FormInputText";
import FormDatePicker from "@/shared/FormDatePicker";
import FormInputTime from "@/shared/FormInputTime";
import FormTextarea from "@/shared/FormTextarea";
import FormLocationPicker from "../FormLocationPicker";

export function Step1Basic({ control }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormInputText name="name" label="Full Name" control={control} />
      <FormDatePicker name="date" label="Visit Date" control={control} />

      <FormInputTime name="start_time" label="Start Time" control={control} />
      <FormInputTime name="end_time" label="End Time" control={control} />

      <div className="col-span-2">
        <FormLocationPicker
          control={control}
          nameLat="latitude"
          nameLng="longitude"
          label="Select visit location"
        />
      </div>

      <div className="col-span-2">
        <FormTextarea name="address" label="Address" control={control} />
      </div>
    </div>
  );
}
