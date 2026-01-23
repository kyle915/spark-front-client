import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import * as L from "leaflet";
import markerIconUrl from "leaflet/dist/images/marker-icon.png?url";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png?url";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png?url";
import { themes } from "../utils";
import MapSearchControl from "./MapSearchControl";

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
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

const FlyToMarker: FC<{ position: LatLngExpression }> = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    const nextZoom = Math.max(map.getZoom(), 13);
    map.flyTo(position, nextZoom);
  }, [map, position]);

  return null;
};

const LocationMap: FC<Props> = ({ coordinates, label, address, zoom = 13 }) => {
  const [themeVariant, setThemeVariant] = useState<keyof typeof TILE_LAYERS>(
    () =>
      getThemeVariant(
        typeof document !== "undefined"
          ? document.documentElement.getAttribute("data-theme")
          : null,
      ),
  );
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);

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
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-theme"
        ) {
          updateTheme();
        }
      }
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const lat = toNumber(coordinates?.[0]);
  const lng = toNumber(coordinates?.[1]);
  const position: LatLngExpression = useMemo(() => [lat, lng], [lat, lng]);

  const [markerPosition, setMarkerPosition] =
    useState<LatLngExpression>(position);
  const [activeLabel, setActiveLabel] = useState<string | null>(label ?? null);
  const [activeAddress, setActiveAddress] = useState<string | null>(
    address ?? null,
  );

  useEffect(() => {
    setMarkerPosition(position);
    setActiveLabel(label ?? null);
    setActiveAddress(address ?? null);
  }, [position, label, address]);

  const hasValidCoordinates =
    !!coordinates && !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!hasValidCoordinates) {
    return (
      <div className="rounded-2xl bg-base-300/60 border border-base-100/20 p-4 text-sm text-base-content/70">
        There are not enough coordinates to display this map.
      </div>
    );
  }

  const tileLayer = TILE_LAYERS[themeVariant];

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-base-100/20 ${themeVariant === "dark" ? "leaflet-theme-dark" : ""}`}
    >
      <MapContainer
        center={markerPosition}
        zoom={zoom}
        scrollWheelZoom
        className="h-64 w-full"
        ref={setMapInstance}
      >
        <TileLayer
          key={tileLayer.url}
          attribution={tileLayer.attribution}
          url={tileLayer.url}
        />
        <FlyToMarker position={markerPosition} />
        <Marker position={markerPosition} icon={markerIcon}>
          {(activeLabel || activeAddress) && (
            <Popup>
              <div className="space-y-1">
                {activeLabel && <p className="font-semibold">{activeLabel}</p>}
                {activeAddress && (
                  <p className="text-sm text-base-content/70">
                    {activeAddress}
                  </p>
                )}
              </div>
            </Popup>
          )}
        </Marker>
      </MapContainer>
      <MapSearchControl
        map={mapInstance}
        onSelect={(result) => {
          setMarkerPosition([result.lat, result.lng]);
          setActiveLabel(result.label);
          setActiveAddress(result.description || activeAddress);
          if (mapInstance) {
            const nextZoom = Math.max(mapInstance.getZoom(), 13);
            mapInstance.flyTo([result.lat, result.lng], nextZoom);
          }
        }}
        placeholder="Search on map"
      />
    </div>
  );
};

export default LocationMap;
