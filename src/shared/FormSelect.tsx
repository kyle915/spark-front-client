import { Controller } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";

type SelectOption = {
  value: string | number;
  label: string;
};

interface FormSelectProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
}

const FormSelect = <T extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder = "Select an option",
  rules,
  disabled = false,
}: FormSelectProps<T>) => (
  <Controller
    name={name}
    control={control}
    rules={rules}
    render={({ field, fieldState: { error } }) => (
      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
        <select
          {...field}
          value={field.value ?? ""}
          disabled={disabled}
          className={`select select-bordered w-full rounded-full ${
            error ? "select-error" : ""
          }`}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <label className="label">
            <span className="label-text-alt text-error">{error.message}</span>
          </label>
        )}
      </div>
    )}
  />
);

export default FormSelect;
