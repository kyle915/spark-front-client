import { useEffect } from "react";
import type { Control, UseFormSetValue } from "react-hook-form";
import { useWatch } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";
import FormSelect from "@/shared/FormSelect";
import FormTextarea from "@/shared/FormTextarea";
import FormInputText from "@/shared/FormInputText";

interface Step4DetailsProps {
  control: Control<SparkFormData>;
  setValue: UseFormSetValue<SparkFormData>;
  requestUrlName: string;
  values: SparkFormData;
}

export function Step4Details({
  control,
  setValue,
  requestUrlName,
  values,
}: Step4DetailsProps) {
  const isJeeterTenant = requestUrlName.trim().toLowerCase().includes("jeeter");

  const notesValue =
    useWatch({
      control,
      name: "notes",
    }) || "";

  useEffect(() => {
    if (!isJeeterTenant) return;

    setValue("details.0.isTableNeeded", "false", { shouldValidate: true });
    setValue("details.0.tableSize", null, { shouldValidate: true });
  }, [isJeeterTenant, setValue]);

  return (
    <div className="space-y-6">
      {!isJeeterTenant && (
        <FormSelect
          name="details.0.isTableNeeded"
          label="Table Needed?"
          control={control}
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
        />
      )}

      {!isJeeterTenant && values.details?.[0]?.isTableNeeded === "true" && (
        <FormInputText
          name="details.0.tableSize"
          label="Table Size"
          type="number"
          control={control}
          placeholder="Enter table size"
        />
      )}

      <div className="flex items-center justify-between">
        <p className="font-semibold text-lg">Notes</p>
        <span
          className={`text-xs ${
            notesValue.length > 280 ? "text-error" : "text-base-content/60"
          }`}
        >
          {notesValue.length}/300
        </span>
      </div>

      {/* NOTES FIELD */}
      <FormTextarea
        name="notes"
        control={control}
        label="Additional Notes"
        placeholder="Enter any additional details or instructions..."
        rules={{
          maxLength: {
            value: 300,
            message: "Notes cannot exceed 300 characters",
          },
        }}
      />
    </div>
  );
}
