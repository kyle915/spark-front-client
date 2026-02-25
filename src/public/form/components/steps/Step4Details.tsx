import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";
import FormSelect from "@/shared/FormSelect";
import FormTextarea from "@/shared/FormTextarea";
import FormInputText from "@/shared/FormInputText";

interface Step4DetailsProps {
  control: Control<SparkFormData>;
  values: SparkFormData;
}

export function Step4Details({ control, values }: Step4DetailsProps) {
  const notesValue =
    useWatch({
      control,
      name: "notes",
    }) || "";

  return (
    <div className="space-y-6">
      <FormSelect
        name="details.0.isTableNeeded"
        label="Table Needed?"
        control={control}
        options={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />

      {values.details?.[0]?.isTableNeeded === "true" && (
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
