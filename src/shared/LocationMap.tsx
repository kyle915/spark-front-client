import type { FC } from "react";
import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import * as L from "leaflet";
import markerIconUrl from "leaflet/dist/images/marker-icon.png?url";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png?url";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png?url";
import { themes } from "../utils";

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
    label?: string | null;
    address?: string | null;
    zoom?: number;
}

const getThemeVariant = (themeName: string | null): keyof typeof TILE_LAYERS =>
    themeName === themes.dark ? "dark" : "light";

const LocationMap: FC<Props> = ({ coordinates, label, address, zoom = 13 }) => {
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

    if (!coordinates || Number.isNaN(lat) || Number.isNaN(lng)) {
        return (
            <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-4 text-sm text-base-content/70">
                There are not enough coordinates to display this map.
            </div>
        );
    }

    const position: LatLngExpression = [lat, lng];

    const tileLayer = TILE_LAYERS[themeVariant];

    return (
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
                <Marker position={position} icon={markerIcon}>
                    {(label || address) && (
                        <Popup>
                            <div className="space-y-1">
                                {label && <p className="font-semibold">{label}</p>}
                                {address && <p className="text-sm text-base-content/70">{address}</p>}
                            </div>
                        </Popup>
                    )}
                </Marker>
            </MapContainer>
        </div>
    );
};

export default LocationMap;
