import { Controller } from "react-hook-form";
import type {
  Control,
  FieldValues,
  RegisterOptions,
  Path,
} from "react-hook-form";

interface FormInputTextProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
  type?: string;
}

const FormInputText = <T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  rules,
  type = "text",
  disabled = false,
}: FormInputTextProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">{label}</span>
          </label>
          <input
            {...field}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            className={`input input-bordered h-12 w-full rounded-full ${
              error ? "input-error" : ""
            }`}
            data-testid={String(name)}
          />

          {error && (
            <label className="label">
              <span className="label-text-alt text-error">{error.message}</span>
            </label>
          )}
        </div>
      )}
    />
  );
};

export default FormInputText;
