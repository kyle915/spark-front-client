import { useRef } from "react";
import { Controller } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface FormDatePickerProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
  minToday?: boolean;
}

export default function FormDatePicker<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  rules,
  disabled = false,
  minToday = false,
}: FormDatePickerProps<T>) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverId = `${name}-popover`;
  const anchorVar = `--${name}`;

  // Rules TypeScript compliance
  const combinedRules: RegisterOptions<T, Path<T>> = {
    ...rules,
  };

  // Optional minToday validation
  if (minToday) {
    combinedRules.validate = (value: string) => {
      if (!value) return "Please select a valid date";

      const selected = new Date(value).setHours(0, 0, 0, 0);
      const today = new Date().setHours(0, 0, 0, 0);

      return selected >= today || "Date cannot be earlier than today";
    };
  }

  const formatDate = (value: string | Date) => {
    const d = typeof value === "string" ? new Date(value) : value;
    return d.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  return (
    <Controller
      name={name}
      control={control}
      rules={combinedRules}
      render={({ field, fieldState: { error } }) => (
        <div className="form-control w-full">
          {/* Label */}
          <label className="label">
            <span className="label-text">{label}</span>
          </label>

          {/* Popover Button */}
          <button
            ref={buttonRef}
            type="button"
            disabled={disabled}
            popoverTarget={popoverId}
            className={`input input-bordered w-full rounded-full text-left ${
              error ? "input-error" : ""
            }`}
            style={{ anchorName: anchorVar } as React.CSSProperties}
          >
            <span className="text-gray-500">
              {field.value ? formatDate(field.value) : `${placeholder}`}
            </span>
          </button>

          {/* Popover */}
          <div
            id={popoverId}
            popover="auto"
            className="dropdown bg-base-100 rounded-box shadow-xl p-3 mt-2"
            style={{ positionAnchor: anchorVar } as React.CSSProperties}
          >
            <DayPicker
              mode="single"
              selected={field.value ? new Date(field.value) : undefined}
              onSelect={(date) => {
                if (!date) return;
                field.onChange(date.toISOString());
                if (buttonRef.current)
                  buttonRef.current.innerText = date.toLocaleDateString();
              }}
              disabled={minToday ? [{ before: new Date() }] : undefined}
              className="react-day-picker"
            />
          </div>

          {/* Error text */}
          {error && (
            <label className="label">
              <span className="label-text-alt text-error">{error.message}</span>
            </label>
          )}
        </div>
      )}
    />
  );
}
