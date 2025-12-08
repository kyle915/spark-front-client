import FormInputText from "@/shared/FormInputText";
import type { Control } from "react-hook-form";
import type { SparkFormData } from "../../schema/schema";
import FormSelect from "@/shared/FormSelect";

interface Step4DetailsProps {
  control: Control<SparkFormData>;
  values: SparkFormData;
}

export function Step4Details({ control, values }: Step4DetailsProps) {
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
        />
      )}
    </div>
  );
}
