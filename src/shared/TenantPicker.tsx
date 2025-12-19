import type { ChangeEvent } from "react";

type TenantOption = {
    value: string;
    label: string;
};

type TenantPickerProps = {
    options: TenantOption[];
    value: string;
    onChange: (value: string) => void;
    label?: string;
    helperText?: string;
    disabled?: boolean;
    className?: string;
};

const TenantPicker = ({
    options,
    value,
    onChange,
    label = "Tenant",
    helperText,
    disabled,
    className,
}: TenantPickerProps) => {
    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value);
    };

    return (
        <div className={`form-control w-full sm:w-72 ${className ?? ""}`}>
            <label className="label pb-1">
                <span className="label-text">{label}</span>
            </label>
            <select
                className="select select-bordered w-full rounded-full"
                value={value}
                onChange={handleChange}
                disabled={disabled || options.length === 0}
            >
                {options.length === 0 && <option value="">No tenants found</option>}
                {options.map((tenant) => (
                    <option key={tenant.value} value={tenant.value}>
                        {tenant.label}
                    </option>
                ))}
            </select>
            {helperText ? <span className="text-xs text-base-content/70 mt-1">{helperText}</span> : null}
        </div>
    );
};

export type { TenantOption };
export default TenantPicker;
