import { useController } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";

type SelectOption = {
  value: string | number;
  label: string;
};

interface FormAutocompleteProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
  onSearch?: (value: string) => void;
  loading?: boolean;
  containerClassName?: string;
  inputClassName?: string;
  showClear?: boolean;
}

const FormAutocomplete = <T extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder = "Search or select an option",
  rules,
  disabled = false,
  onSearch,
  loading = false,
  containerClassName = "",
  inputClassName = "",
  showClear = true,
}: FormAutocompleteProps<T>) => {
  const {
    field,
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedLabel, setSelectedLabel] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the label for the selected value
  const selectedOption = options.find(
    (opt) => String(opt.value) === String(field.value),
  );
  const displayValue = selectedOption?.label || selectedLabel || "";

  // Reset search term when value changes programmatically
  useEffect(() => {
    setSearchTerm("");
    onSearch?.("");
  }, [field.value, onSearch]);

  // Keep a stable label even if the selected option is no longer in the options list.
  useEffect(() => {
    if (!field.value) {
      setSelectedLabel("");
      return;
    }

    if (selectedOption) {
      setSelectedLabel(selectedOption.label);
    }
  }, [field.value, selectedOption]);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: SelectOption) => {
    field.onChange(String(option.value));
    setSelectedLabel(option.label);
    setSearchTerm("");
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div
      className={`form-control w-full ${containerClassName}`}
      ref={dropdownRef}
    >
      {label ? (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            const nextValue = e.target.value;
            setSearchTerm(nextValue);
            onSearch?.(nextValue);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full h-12 input input-bordered rounded-full pr-12 transition-colors ${
            error ? "input-error" : ""
          } ${loading ? "cursor-wait" : ""} ${
            disabled
              ? "disabled:bg-base-200/50 disabled:border-base-300 disabled:text-base-content/40 disabled:cursor-not-allowed"
              : ""
          } ${inputClassName}`}
          autoComplete="off"
        />

        {/* Icons: Clear (if value exists) and Chevron */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {loading && (
            <span className="loading loading-spinner loading-sm text-primary" />
          )}

          {showClear && field.value && !disabled && !loading && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                field.onChange(null);
                setSelectedLabel("");
                setSearchTerm("");
                onSearch?.("");
                setIsOpen(false);
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
              } ${disabled ? "opacity-50" : "opacity-70"}`}
            />
          </div>
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-box shadow-lg max-h-60 overflow-auto">
            {loading && (
              <div className="px-4 py-2 text-sm text-base-content/60 flex items-center gap-2">
                <span className="loading loading-spinner loading-xs" />
                Searching...
              </div>
            )}

            {!loading &&
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-2 cursor-pointer transition-colors ${
                    index === highlightedIndex
                      ? "bg-primary text-primary-content"
                      : String(option.value) === String(field.value)
                        ? "bg-base-200"
                        : "hover:bg-base-200"
                  }`}
                >
                  {option.label}
                </div>
              ))}

            {!loading && filteredOptions.length === 0 && searchTerm && (
              <div className="px-4 py-2 text-base-content/60 text-sm">
                No options found
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

export default FormAutocomplete;
