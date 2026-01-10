import { Controller } from "react-hook-form";
import type { Control, FieldValues, Path, RegisterOptions } from "react-hook-form";

interface FormTextareaProps<T extends FieldValues> {
    name: Path<T>;
    control: Control<T>;
    label: string;
    rows?: number;
    rules?: RegisterOptions<T, Path<T>>;
    disabled?: boolean;
    placeholder?: string;
}

const FormTextarea = <T extends FieldValues>({
    name,
    control,
    label,
    rows = 3,
    rules,
    disabled = false,
    placeholder,
}: FormTextareaProps<T>) => (
    <Controller
        name={name}
        control={control}
        rules={rules}
        render={({ field, fieldState: { error } }) => (
            <div className="form-control w-full">
                <label className="label">
                    <span className="label-text">{label}</span>
                </label>
                <textarea
                    {...field}
                    rows={rows}
                    placeholder={placeholder ?? label}
                    disabled={disabled}
                    className={`textarea textarea-bordered w-full rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? "textarea-error" : ""
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

export default FormTextarea;
