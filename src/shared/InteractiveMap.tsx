import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import { themes } from "@utils/index";
import MapSearchControl from "./MapSearchControl";
import { CARTO_DARK_TILE, OSM_LIGHT_TILE } from "./map/sparkMap";

const TILE_LAYERS = {
  light: OSM_LIGHT_TILE,
  dark: CARTO_DARK_TILE,
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

const FlyToCenter: FC<{ center: LatLngExpression }> = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    const nextZoom = Math.max(map.getZoom(), 12);
    map.flyTo(center, nextZoom);
  }, [map, center]);

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
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);

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
      className={`relative rounded-2xl overflow-hidden border border-base-100/20 ${
        themeVariant === "dark" ? "leaflet-theme-dark" : ""
      } ${height} ${className}`}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
        ref={setMapInstance}
      >
        <TileLayer
          key={tileLayer.url}
          attribution={tileLayer.attribution}
          url={tileLayer.url}
        />
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
        <FlyToCenter center={center} />
        {children}
      </MapContainer>
      <MapSearchControl
        map={mapInstance}
        onSelect={(result) => onMapClick?.(result.lat, result.lng)}
        placeholder="Search location"
      />
    </div>
  );
};

export default InteractiveMap;
