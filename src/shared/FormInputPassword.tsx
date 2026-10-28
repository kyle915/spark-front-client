import { useState } from "react";
import { Controller } from "react-hook-form";
import type { Control, FieldValues, RegisterOptions, Path } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface FormInputPasswordProps<T extends FieldValues> {
    name: Path<T>;
    control: Control<T>;
    label: string;
    rules?: RegisterOptions<T, Path<T>>;
    disabled?: boolean;
    placeholder?: string;
}

const FormInputPassword = <T extends FieldValues>({
    name,
    control,
    label,
    rules,
    disabled = false,
    placeholder,
}: FormInputPasswordProps<T>) => {
    const [showPassword, setShowPassword] = useState(false);

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
                    <div className="relative">
                        <input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder={placeholder ?? label}
                            disabled={disabled}
                            value={field.value ?? ""}
                            className="spark-input input w-full rounded-lg px-4 py-2 pr-12 focus:outline-none"
                            style={
                                error
                                    ? { borderColor: "var(--color-error, #ff5470)" }
                                    : undefined
                            }
                            data-testid={String(name)}
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/55 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f3ee]"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? (
                                <EyeSlashIcon className="w-4 h-4" />
                            ) : (
                                <EyeIcon className="w-4 h-4" />
                            )}
                        </button>
                    </div>

                    {error && (
                        <label className="label">
                            <span className="label-text-alt text-error">
                                {error.message}
                            </span>
                        </label>
                    )}
                </div>
            )}
        />
    );
};

export default FormInputPassword;
