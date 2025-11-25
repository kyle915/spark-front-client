import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path, RegisterOptions } from "react-hook-form";

interface FormCheckboxProps<T extends FieldValues> {
    name: Path<T>;
    control: Control<T>;
    label: string;
    rules?: RegisterOptions<T, Path<T>>;
    disabled?: boolean;
}

const FormCheckbox = <T extends FieldValues>({
    name,
    control,
    label,
    rules,
    disabled = false,
}: FormCheckboxProps<T>) => (
    <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState: { error } }) => (
            <div className="form-control">
                <label className="label cursor-pointer justify-between">
                    <span className="label-text">{label}</span>
                    <input
                        type="checkbox"
                        checked={!!field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        disabled={disabled}
                        className={`checkbox ${error ? "checkbox-error" : ""}`}
                        data-testid={String(name)}
                    />
                </label>
                {error && (
                    <label className="label">
                        <span className="label-text-alt text-error">{error.message}</span>
                    </label>
                )}
            </div>
        )}
    />
);

export default FormCheckbox;
