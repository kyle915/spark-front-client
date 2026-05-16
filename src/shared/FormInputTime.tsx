import { Controller } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { useState, useRef, useEffect } from "react";

interface FormInputTimeProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
}

const FormInputTime = <T extends FieldValues>({
  name,
  control,
  label,
  placeholder = "Select time",
  rules,
  disabled = false,
}: FormInputTimeProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // 1) Convert HH:mm → 12h components
  const parseTime = (time24?: string | null) => {
    if (!time24) return { hour: 12, minute: 0, period: "AM" as "AM" | "PM" };

    const [hourStr, minuteStr] = time24.split(":");
    const hour24 = parseInt(hourStr ?? "0", 10);
    const minute = parseInt(minuteStr ?? "0", 10);

    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;

    const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
    return { hour: hour12, minute, period };
  };

  // 2) Convert 12h components → HH:mm
  const formatTime = (hour: number, minute: number, period: "AM" | "PM") => {
    let hour24 = hour;

    if (period === "AM") {
      if (hour24 === 12) hour24 = 0;
    } else {
      if (hour24 !== 12) hour24 += 12;
    }

    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0",
    )}`;
  };

  // 3) Visual display
  const formatDisplay = (
    hour: number,
    minute: number,
    period: "AM" | "PM",
    rawValue?: string,
  ) => {
    if (!rawValue) return placeholder;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0",
    )} ${period}`;
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Scroll Pickers
  const ScrollPicker = ({
    items,
    selected,
    onChange,
  }: {
    items: (number | string)[];
    selected: number | string;
    onChange: (value: number | string) => void;
  }) => (
    <div className="h-32 overflow-y-auto scroll-smooth snap-y snap-mandatory">
      <div className="py-2 mb-6">
        {items.map((item) => (
          <div
            key={item}
            onClick={() => onChange(item)}
            className={`h-8 flex items-center justify-center cursor-pointer snap-center transition-all ${
              item === selected
                ? "bg-primary text-primary-content font-bold text-base rounded-lg mx-1"
                : "text-base-content/60 hover:text-base-content text-sm"
            }`}
          >
            {typeof item === "number"
              ? String(item).padStart(2, "0")
              : item.toString()}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => {
        const { hour, minute, period } = parseTime(field.value);

        const handleChange = (
          type: "hour" | "minute" | "period",
          value: number | string,
        ) => {
          const current = parseTime(field.value);
          const next = {
            ...current,
            [type]: type === "period" ? (value as "AM" | "PM") : Number(value),
          };

          field.onChange(formatTime(next.hour, next.minute, next.period));
        };

        const handleNow = () => {
          const now = new Date();
          const h = now.getHours();
          const m = now.getMinutes();
          const h12 = h % 12 || 12;
          const p: "AM" | "PM" = h >= 12 ? "PM" : "AM";

          field.onChange(formatTime(h12, m, p));
        };

        const handleClear = () => field.onChange("");

        return (
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">{label}</span>
            </label>

            <div className="relative" ref={popoverRef}>
              <input
                type="text"
                value={
                  field.value
                    ? formatDisplay(hour, minute, period, field.value)
                    : ""
                }
                placeholder={placeholder}
                readOnly
                onClick={() => !disabled && setIsOpen((prev) => !prev)}
                disabled={disabled}
                className={`input input-bordered h-12 w-full rounded-full cursor-pointer ${
                  error ? "input-error" : ""
                }`}
              />

              {isOpen && !disabled && (
                <div className="absolute mt-2 bg-base-200 rounded-box shadow-xl p-3 w-full max-w-sm z-9999999">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {/* Hours */}
                    <ScrollPicker
                      items={Array.from({ length: 12 }, (_, i) => i + 1)}
                      selected={hour}
                      onChange={(v) => handleChange("hour", v)}
                    />

                    {/* Minutes */}
                    <ScrollPicker
                      items={Array.from({ length: 60 }, (_, i) => i)}
                      selected={minute}
                      onChange={(v) => handleChange("minute", v)}
                    />

                    {/* AM/PM */}
                    <ScrollPicker
                      items={["AM", "PM"]}
                      selected={period}
                      onChange={(v) => handleChange("period", v)}
                    />
                  </div>
                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={handleNow}
                      className="btn btn-primary btn-xs"
                    >
                      Now
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleClear}
                        className="btn btn-ghost btn-xs"
                      >
                        Clear
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="btn btn-ghost btn-xs"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <label className="label">
                <span className="label-text-alt text-error">
                  {error.message}
                </span>
              </label>
            )}
          </div>
        );
      }}
    />
  );
};

export default FormInputTime;
