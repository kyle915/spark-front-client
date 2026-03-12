import { Controller } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { extractDatePart } from "@/utils";

interface FormDatePickerProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
  minToday?: boolean;
  minDaysFromToday?: number;
}

export default function FormDatePicker<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  rules,
  disabled = false,
  minToday = false,
  minDaysFromToday,
}: FormDatePickerProps<T>) {
  // const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverId = `${name}-popover`;
  const anchorVar = `--${name}`;

  // Rules TypeScript compliance
  const combinedRules: RegisterOptions<T, Path<T>> = {
    ...rules,
  };

  const minimumDaysFromToday =
    typeof minDaysFromToday === "number"
      ? minDaysFromToday
      : minToday
        ? 0
        : null;

  const getMinimumDate = () => {
    if (minimumDaysFromToday === null) return null;
    const minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    minDate.setDate(minDate.getDate() + minimumDaysFromToday);
    return minDate;
  };

  // Optional minToday validation
  const toDatePart = (value: string | Date) => {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return extractDatePart(value) ?? value;
  };

  if (minimumDaysFromToday !== null) {
    combinedRules.validate = (value: string) => {
      if (!value) return "Please select a valid date";
      const datePart = toDatePart(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart))
        return "Please select a valid date";

      const [year, month, day] = datePart.split("-").map(Number);
      const selected = new Date(year, month - 1, day).setHours(0, 0, 0, 0);
      const minimumDate = getMinimumDate();

      if (!minimumDate) return true;
      return (
        selected >= minimumDate.getTime() ||
        "Date cannot be earlier than allowed"
      );
    };
  }

  const formatDate = (value: string | Date) => {
    const datePart = toDatePart(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    const [year, month, day] = datePart.split("-");
    return `${month}/${day}/${year}`;
  };

  const closePopover = () => {
    const popoverElement = document.getElementById(popoverId);
    if (!popoverElement || !("hidePopover" in popoverElement)) return;
    (
      popoverElement as HTMLElement & {
        hidePopover: () => void;
      }
    ).hidePopover();
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
            type="button"
            disabled={disabled}
            popoverTarget={popoverId}
            className={`input input-bordered w-full rounded-full text-left ${
              error ? "input-error" : ""
            }`}
            style={{ anchorName: anchorVar } as React.CSSProperties}
          >
            <span
              className={field.value ? "text-base-content" : "text-gray-500"}
            >
              {field.value ? formatDate(field.value) : placeholder}
            </span>
          </button>

          {/* Popover */}
          <div
            id={popoverId}
            popover="auto"
            className="dropdown bg-base-100 rounded-box shadow-xl p-3 mt-2 w-[calc(100vw-2.5rem)] sm:w-[320px] max-w-full overflow-hidden"
            style={{ positionAnchor: anchorVar } as React.CSSProperties}
          >
            <DayPicker
              mode="single"
              selected={
                field.value &&
                /^\d{4}-\d{2}-\d{2}$/.test(toDatePart(field.value))
                  ? new Date(`${toDatePart(field.value)}T00:00:00`)
                  : undefined
              }
              onSelect={(date) => {
                if (!date) return;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");
                field.onChange(`${year}-${month}-${day}`);
                closePopover();
              }}
              disabled={
                minimumDaysFromToday !== null
                  ? [{ before: getMinimumDate() ?? new Date() }]
                  : undefined
              }
              className="react-day-picker"
            />

            {/* Footer actions */}
            <div className="mt-2 flex justify-between border-t border-base-200 pt-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const minimumDate = getMinimumDate();
                  const targetDate = minimumDate ?? new Date();
                  const year = targetDate.getFullYear();
                  const month = String(targetDate.getMonth() + 1).padStart(
                    2,
                    "0",
                  );
                  const day = String(targetDate.getDate()).padStart(2, "0");
                  field.onChange(`${year}-${month}-${day}`);
                  closePopover();
                }}
              >
                {minimumDaysFromToday && minimumDaysFromToday > 0
                  ? "Earliest"
                  : "Today"}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                onClick={() => {
                  field.onChange("");
                }}
              >
                Clear
              </button>
            </div>
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
