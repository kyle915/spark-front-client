import { useEffect, useMemo, useState } from "react";
import { useController } from "react-hook-form";
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import type { PhotonResult } from "./mapSearch";
import { searchPhotonLocations } from "./mapSearch";

interface FormAddressSearchProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  rules?: RegisterOptions<T, Path<T>>;
  disabled?: boolean;
  minLength?: number;
  debounceMs?: number;
  onSelect?: (result: PhotonResult) => void;
}

const FormAddressSearch = <T extends FieldValues>({
  name,
  control,
  label,
  placeholder = "Search address",
  rules,
  disabled = false,
  minLength = 3,
  debounceMs = 450,
  onSelect,
}: FormAddressSearchProps<T>) => {
  const {
    field,
    fieldState: { error },
  } = useController({ name, control, rules });

  const [results, setResults] = useState<PhotonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const query = typeof field.value === "string" ? field.value : "";
  const canSearch = useMemo(
    () => query.trim().length >= minLength,
    [query, minLength],
  );

  useEffect(() => {
    if (!canSearch || disabled) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        setSearchError(null);
        const matches = await searchPhotonLocations(
          query,
          controller.signal,
          5,
        );
        setResults(matches);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSearchError(
          err instanceof Error ? err.message : "Unable to search address",
        );
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [canSearch, debounceMs, disabled, query]);

  const handleSelect = (result: PhotonResult) => {
    const value = result.description || result.label;
    field.onChange(value);
    setShowResults(false);
    onSelect?.(result);
  };

  return (
    <div className="form-control w-full">
      <label className="label">
        <span className="label-text">{label}</span>
      </label>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            field.onChange(e.target.value);
            setShowResults(true);
          }}
          onBlur={() => {
            setTimeout(() => setShowResults(false), 120);
            field.onBlur();
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`text-gray-400 input input-bordered w-full rounded-full px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            error ? "input-error" : ""
          }`}
          autoComplete="off"
          data-testid={String(name)}
        />
        {loading && (
          <span className="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2" />
        )}

        {showResults && !disabled && (results.length > 0 || searchError) && (
          <div className="absolute z-[1200] mt-1 w-full rounded-box border border-base-300 bg-base-100 shadow-lg max-h-60 overflow-auto">
            {searchError && (
              <div className="px-4 py-2 text-sm text-error">{searchError}</div>
            )}
            {results.map((result, idx) => (
              <button
                key={`${result.lat}-${result.lng}-${idx}`}
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-base-200"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(result)}
              >
                <p className="text-sm font-semibold">{result.label}</p>
                {result.description && (
                  <p className="text-xs text-base-content/70">
                    {result.description}
                  </p>
                )}
              </button>
            ))}
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

export default FormAddressSearch;
