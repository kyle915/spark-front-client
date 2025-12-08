import { Controller } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";

interface FormInputTimeProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
}

const FormInputTime = <T extends FieldValues>({
  name,
  control,
  label,
  rules,
  disabled = false,
}: FormInputTimeProps<T>) => (
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
          type="time"
          disabled={disabled}
          className={`input input-bordered w-full rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
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

export default FormInputTime;
