import { Controller } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import "cally";
import { extractDatePart } from "@/utils";

import React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "calendar-date": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        class?: string;
        value?: string;
        min?: string;
        max?: string;
        locale?: string;
      };
      "calendar-month": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

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
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              popoverTarget={popoverId}
              className={`spark-input w-full min-h-11 rounded-lg px-3 pr-12 flex items-center text-left focus:outline-none ${
                disabled ? "cursor-not-allowed opacity-50" : ""
              }`}
              style={
                {
                  anchorName: anchorVar,
                  ...(error
                    ? { borderColor: "var(--color-error, #ff5470)" }
                    : {}),
                } as React.CSSProperties
              }
            >
              <span className={field.value ? "" : "opacity-50"}>
                {field.value ? formatDate(field.value) : placeholder}
              </span>
            </button>

            {/* Icons */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1 z-10">
              {field.value && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    field.onChange("");
                  }}
                  className="rounded-md p-1 transition-colors spark-row-hover"
                  style={{ color: "var(--spark-text-meta, rgba(255,255,255,0.5))" }}
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
              <div className="pointer-events-none pr-1">
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    disabled ? "opacity-50" : "opacity-70"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Popover */}
          <div
            id={popoverId}
            popover="auto"
            className="dropdown mt-2 w-[calc(100vw-2.5rem)] max-w-full overflow-hidden rounded-xl border p-3 shadow-xl sm:w-[320px]"
            style={
              {
                positionAnchor: anchorVar,
                background: "var(--spark-bg, #0a0d09)",
                borderColor: "var(--spark-border, #1f2418)",
                color: "var(--spark-text, #f2f3ee)",
              } as React.CSSProperties
            }
          >
            <calendar-date
              locale="en"
              className="cally mx-auto"
              style={
                {
                  color: "var(--spark-text, #f2f3ee)",
                  "--color-accent": "#f2f3ee",
                  "--color-text-on-accent": "#0a0b0d",
                } as React.CSSProperties
              }
              value={
                field.value && /^\d{4}-\d{2}-\d{2}$/.test(toDatePart(field.value))
                  ? toDatePart(field.value)
                  : undefined
              }
              min={
                minimumDaysFromToday !== null
                  ? toDatePart(getMinimumDate() ?? new Date())
                  : undefined
              }
              ref={(el: any) => {
                if (el) {
                  el.onchange = (e: Event) => {
                    const target = e.target as any;
                    if (target.value) {
                      field.onChange(target.value);
                      closePopover();
                    }
                  };
                }
              }}
            >
              {/* @ts-expect-error - React SVGProps is missing standard 'slot' attribute */}
              <svg aria-label="Previous" className="fill-current w-4 h-4" slot="previous" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.75 19.5 8.25 12l7.5-7.5"></path></svg>
              {/* @ts-expect-error - React SVGProps is missing standard 'slot' attribute */}
              <svg aria-label="Next" className="fill-current w-4 h-4" slot="next" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m8.25 4.5 7.5 7.5-7.5 7.5"></path></svg>
              <calendar-month></calendar-month>
            </calendar-date>

            {/* Footer actions */}
            <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm spark-row-hover"
                style={{ color: "var(--spark-text-secondary, rgba(255,255,255,0.7))" }}
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
                Today
              </button>

              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-[#ff5470] hover:bg-white/5"
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
