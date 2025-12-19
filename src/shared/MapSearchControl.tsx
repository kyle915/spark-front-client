import type { FC, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

export type PhotonResult = {
    lat: number;
    lng: number;
    label: string;
    description: string;
};

interface MapSearchControlProps {
    map: LeafletMap | null;
    onSelect?: (result: PhotonResult) => void;
    placeholder?: string;
    minLength?: number;
    debounceMs?: number;
}

const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";

const buildDescription = (props: Record<string, unknown>): string => {
    const parts = [
        props.name,
        props.street,
        props.housenumber,
        props.district,
        props.city,
        props.state,
        props.country,
    ]
        .map((value) => (typeof value === "string" ? value : null))
        .filter(Boolean);

    return parts.join(", ");
};

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

    const canSearch = useMemo(() => query.trim().length >= minLength, [query, minLength]);

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

                const response = await fetch(`${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}&limit=5&lang=en`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }

                const data = await response.json();
                const features: unknown[] = Array.isArray(data?.features) ? data.features : [];
                const parsed: PhotonResult[] = features
                    .map((feature: any) => {
                        const coords = feature?.geometry?.coordinates;
                        const props = feature?.properties ?? {};
                        const lng = Number.parseFloat(coords?.[0]);
                        const lat = Number.parseFloat(coords?.[1]);

                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                            return null;
                        }

                        const label = typeof props.name === "string" && props.name.length > 0
                            ? props.name
                            : buildDescription(props) || "Unknown location";

                        return {
                            lat,
                            lng,
                            label,
                            description: buildDescription(props),
                        };
                    })
                    .filter((value: PhotonResult | null): value is PhotonResult => Boolean(value));

                setResults(parsed);
            } catch (err) {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err.message : "Unable to search location");
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
                        {error && (
                            <div className="p-3 text-sm text-error">
                                {error}
                            </div>
                        )}
                        {results.map((result, idx) => (
                            <button
                                key={`${result.lat}-${result.lng}-${result.label}-${idx}`}
                                type="button"
                                className="w-full text-left p-3 hover:bg-base-200 focus:bg-base-200 focus:outline-none transition-colors"
                                onClick={() => handleSelect(result)}
                            >
                                <p className="font-semibold text-sm">{result.label}</p>
                                {result.description && (
                                    <p className="text-xs text-base-content/70 line-clamp-2">{result.description}</p>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {!loading && canSearch && results.length === 0 && !error && showResults && (
                    <p className="text-xs text-base-content/70 px-1">No results found</p>
                )}
            </div>
        </div>
    );
};

export default MapSearchControl;
