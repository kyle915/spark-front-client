import type { FC, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { type PhotonResult, searchPhotonLocations } from "./mapSearch";

interface MapSearchControlProps {
  map: LeafletMap | null;
  onSelect?: (result: PhotonResult) => void;
  placeholder?: string;
  minLength?: number;
  debounceMs?: number;
}

const MapSearchControl: FC<MapSearchControlProps> = ({
  map,
  onSelect,
  placeholder = "Search a place...",
  minLength = 3,
  debounceMs = 450,
}) => {
  const stopPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const canSearch = useMemo(
    () => query.trim().length >= minLength,
    [query, minLength]
  );

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        const parsed = await searchPhotonLocations(query, controller.signal);
        setResults(parsed);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Unable to search location"
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
  }, [canSearch, query, debounceMs]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const handleClick = () => setShowResults(false);
    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map]);

  const handleSelect = (result: PhotonResult) => {
    setQuery(result.label);
    setShowResults(false);

    if (map) {
      const nextZoom = Math.max(map.getZoom(), 13);
      map.flyTo([result.lat, result.lng], nextZoom);
    }

    onSelect?.(result);
  };

  return (
    <div
      className="absolute top-3 right-3 z-[1000] w-72"
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
      onDoubleClick={stopPropagation}
      onTouchStart={stopPropagation}
      onWheel={stopPropagation}
    >
      <div className="rounded-xl bg-base-100/90 backdrop-blur shadow-lg border border-base-200 p-3 space-y-2">
        <div className="relative">
          <input
            className="input input-sm input-bordered w-full pr-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowResults(true)}
            placeholder={placeholder}
            autoComplete="off"
          />
          {loading && (
            <span className="loading loading-spinner loading-xs absolute right-2 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {showResults && (results.length > 0 || error) && (
          <div className="max-h-60 overflow-y-auto rounded-lg border border-base-200 bg-base-100 shadow-sm divide-y divide-base-200">
            {error && <div className="p-3 text-sm text-error">{error}</div>}
            {results.map((result, idx) => (
              <button
                key={`${result.lat}-${result.lng}-${result.label}-${idx}`}
                type="button"
                className="w-full text-left p-3 hover:bg-base-200 focus:bg-base-200 focus:outline-none transition-colors"
                onClick={() => handleSelect(result)}
              >
                <p className="font-semibold text-sm">{result.label}</p>
                {result.description && (
                  <p className="text-xs text-base-content/70 line-clamp-2">
                    {result.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {!loading &&
          canSearch &&
          results.length === 0 &&
          !error &&
          showResults && (
            <p className="text-xs text-base-content/70 px-1">
              No results found
            </p>
          )}
      </div>
    </div>
  );
};

export default MapSearchControl;
