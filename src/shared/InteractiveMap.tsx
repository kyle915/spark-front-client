import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { themes } from "@utils/index";

const TILE_LAYERS = {
  light: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const;

const getThemeVariant = (themeName: string | null): keyof typeof TILE_LAYERS =>
  themeName === themes.dark ? "dark" : "light";

interface MapClickHandlerProps {
  onMapClick?: (lat: number, lng: number) => void;
}

const MapClickHandler: FC<MapClickHandlerProps> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const CenterUpdater: FC<{ center: LatLngExpression }> = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    // Pan to the new center without altering the current zoom level
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
};

interface InteractiveMapProps {
  center: LatLngExpression;
  zoom?: number;
  height?: string;
  children?: ReactNode;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

const InteractiveMap: FC<InteractiveMapProps> = ({
  center,
  zoom = 12,
  height = "h-full",
  children,
  onMapClick,
  className = "",
}) => {
  const [themeVariant, setThemeVariant] =
    useState<keyof typeof TILE_LAYERS>("light");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const updateTheme = () =>
      setThemeVariant(getThemeVariant(root.getAttribute("data-theme")));

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

  const tileLayer = TILE_LAYERS[themeVariant];

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-base-100/20 ${
        themeVariant === "dark" ? "leaflet-theme-dark" : ""
      } ${height} ${className}`}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          key={tileLayer.url}
          attribution={tileLayer.attribution}
          url={tileLayer.url}
        />
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
        <CenterUpdater center={center} />
        {children}
      </MapContainer>
    </div>
  );
};

export default InteractiveMap;
