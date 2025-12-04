import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import * as L from "leaflet";
import markerIconUrl from "leaflet/dist/images/marker-icon.png?url";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png?url";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png?url";
import { themes } from "@utils/index";

type CoordinateValue = number | string | null | undefined;

const markerIcon = new L.Icon({
    iconUrl: markerIconUrl,
    iconRetinaUrl: markerIcon2xUrl,
    shadowUrl: markerShadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const TILE_LAYERS = {
    light: {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    dark: {
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
} as const;

const toNumber = (value: CoordinateValue): number => {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    return Number.NaN;
};

interface Props {
    coordinates?: readonly CoordinateValue[] | null;
    onChange?: (coordinates: number[] | null) => void;
    zoom?: number;
}

const getThemeVariant = (themeName: string | null): keyof typeof TILE_LAYERS =>
    themeName === themes.dark ? "dark" : "light";

const DEFAULT_CENTER: LatLngExpression = [19.4326, -99.1332]; // Mexico City

interface MapClickHandlerProps {
    onMapClick: (lat: number, lng: number) => void;
}

const MapClickHandler: FC<MapClickHandlerProps> = ({ onMapClick }) => {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

const EditableLocationMap: FC<Props> = ({ coordinates, onChange, zoom = 13 }) => {
    const [themeVariant, setThemeVariant] = useState<keyof typeof TILE_LAYERS>(() =>
        getThemeVariant(typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null)
    );

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        const root = document.documentElement;
        const updateTheme = () => {
            setThemeVariant(getThemeVariant(root.getAttribute("data-theme")));
        };

        updateTheme();
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
                    updateTheme();
                }
            }
        });
        observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

        return () => observer.disconnect();
    }, []);

    const lat = toNumber(coordinates?.[0]);
    const lng = toNumber(coordinates?.[1]);

    const hasValidCoordinates = coordinates && !Number.isNaN(lat) && !Number.isNaN(lng);
    const position: LatLngExpression = hasValidCoordinates ? [lat, lng] : DEFAULT_CENTER;

    const handleMapClick = useCallback(
        (clickedLat: number, clickedLng: number) => {
            if (onChange) {
                onChange([clickedLat, clickedLng]);
            }
        },
        [onChange]
    );

    const handleClear = useCallback(() => {
        if (onChange) {
            onChange(null);
        }
    }, [onChange]);

    const tileLayer = TILE_LAYERS[themeVariant];

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="label">
                    <span className="label-text">Coordinates</span>
                </label>
                {hasValidCoordinates && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="btn btn-ghost btn-sm"
                    >
                        Clear
                    </button>
                )}
            </div>
            <div className={`rounded-2xl overflow-hidden border border-base-100/20 ${themeVariant === "dark" ? "leaflet-theme-dark" : ""}`}>
                <MapContainer
                    center={position}
                    zoom={zoom}
                    scrollWheelZoom
                    className="h-64 w-full"
                >
                    <TileLayer
                        key={tileLayer.url}
                        attribution={tileLayer.attribution}
                        url={tileLayer.url}
                    />
                    <MapClickHandler onMapClick={handleMapClick} />
                    {hasValidCoordinates && (
                        <Marker position={[lat, lng]} icon={markerIcon} />
                    )}
                </MapContainer>
            </div>
            {hasValidCoordinates && (
                <p className="text-sm text-base-content/70">
                    Latitude: {lat.toFixed(6)}, Longitude: {lng.toFixed(6)}
                </p>
            )}
            {!hasValidCoordinates && (
                <p className="text-sm text-base-content/70">
                    Click on the map to set coordinates
                </p>
            )}
        </div>
    );
};

export default EditableLocationMap;
