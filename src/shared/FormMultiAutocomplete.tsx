import { useController } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";

import { useState, useRef, useEffect } from "react";
import { XMarkIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { CheckIcon } from "lucide-react";

type SelectOption = {
  value: string;
  label: string;
};

interface Props<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
  onSearch?: (value: string) => void;
  maxVisible?: number;
}

const FormMultiAutocomplete = <T extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder = "Search...",
  rules,
  disabled = false,
  onSearch,
  maxVisible = 1,
}: Props<T>) => {
  const {
    field,
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
  });

  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedValues: string[] = field.value ?? [];

  const selectedOptions = options.filter((o) =>
    selectedValues.includes(String(o.value)),
  );

  const visibleSelections = selectedOptions.slice(0, maxVisible);
  const hiddenCount = selectedOptions.length - visibleSelections.length;

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleOption = (option: SelectOption) => {
    let next: string[];

    if (selectedValues.includes(option.value)) {
      next = selectedValues.filter((v) => v !== option.value);
    } else {
      next = [...selectedValues, option.value];
    }

    field.onChange(next);
  };

  const removeOption = (value: string) => {
    field.onChange(selectedValues.filter((v) => v !== value));
  };

  const clearAll = () => {
    field.onChange([]);
    setSearch("");
    onSearch?.("");
  };

  return (
    <div className="form-control w-full" ref={dropdownRef}>
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}

      <div className="relative">
        {/* INPUT CONTAINER */}
        <div
          className={`input input-bordered rounded-full w-full flex items-center gap-1 pr-12 ${
            error ? "input-error" : ""
          }`}
          onClick={() => setIsOpen(true)}
        >
          {/* CHIPS */}
          {visibleSelections.map((opt) => (
            <span
              key={opt.value}
              className="badge badge-primary badge-sm gap-1 max-w-[140px] rounded-full"
            >
              <span className="truncate">{opt.label}</span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeOption(opt.value);
                }}
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* CONTADOR */}
          {hiddenCount > 0 && (
            <span className="badge badge-outline badge-sm">+{hiddenCount}</span>
          )}

          {/* INPUT */}
          <input
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              onSearch?.(val);
              setIsOpen(true);
            }}
            placeholder={selectedOptions.length === 0 ? placeholder : ""}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>

        {/* ICONS (igual que Autocomplete) */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
              className="p-1 hover:bg-base-200 rounded-full text-base-content/50 hover:text-base-content transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}

          <div className="pointer-events-none pr-1">
            <ChevronDownIcon
              className={`w-5 h-5 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {/* DROPDOWN */}
        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-box shadow max-h-60 overflow-auto">
            {filteredOptions.map((option) => {
              const selected = selectedValues.includes(option.value);

              return (
                <div
                  key={option.value}
                  onClick={() => toggleOption(option)}
                  className={`px-4 py-2 cursor-pointer flex justify-between ${
                    selected
                      ? "bg-primary text-primary-content"
                      : "hover:bg-base-200"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  <span className="flex items-center">
                    {selected && <CheckIcon className="w-4 h-4" />}
                  </span>
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-4 py-2 text-sm text-base-content/60">
                No results
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <label className="label">
          <span className="label-text-alt text-error">{error.message}</span>
        </label>
      )}
    </div>
  );
};

export default FormMultiAutocomplete;
