import FormInputText from "@/shared/FormInputText";
import FormSelect from "@/shared/FormSelect";

export function Step3Details({ control, values }: any) {
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
