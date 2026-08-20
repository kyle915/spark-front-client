import { useEffect, useMemo } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MarkerClusterer, type Renderer } from "@googlemaps/markerclusterer";
import { boundsFromPins } from "@/shared/map/accountMapPins";

export type SparkGooglePin = {
  id: string;
  position: { lat: number; lng: number };
  color: string;
  onClick?: () => void;
  title?: string;
};

type AdvancedMarkerInstance = {
  addListener?: (event: string, fn: () => void) => void;
  addEventListener?: (event: string, fn: () => void) => void;
  map: unknown;
};

type AdvancedMarkerCtor = new (opts: {
  position: { lat: number; lng: number };
  content?: HTMLElement;
  zIndex?: number;
  title?: string;
  gmpClickable?: boolean;
}) => AdvancedMarkerInstance;

type LatLngBoundsInstance = {
  extend: (p: { lat: number; lng: number }) => void;
};

type GoogleMapsWindow = {
  google?: {
    maps?: {
      LatLngBounds?: new () => LatLngBoundsInstance;
      marker?: {
        AdvancedMarkerElement?: AdvancedMarkerCtor;
      };
    };
  };
};

function mapsApi(): GoogleMapsWindow["google"] {
  return (window as GoogleMapsWindow).google;
}

function pinElement(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "spark-gmap-dot";
  el.style.background = color;
  el.style.boxShadow = `0 0 10px ${color}`;
  return el;
}

function bindMarkerClick(
  marker: AdvancedMarkerInstance,
  onClick: () => void,
): void {
  if (typeof marker.addListener === "function") {
    marker.addListener("click", onClick);
    return;
  }
  marker.addEventListener?.("gmp-click", onClick);
}

function fitMapToPins(
  map: {
    fitBounds: (bounds: LatLngBoundsInstance, padding?: number) => void;
    setCenter: (p: { lat: number; lng: number }) => void;
    setZoom: (z: number) => void;
  },
  pins: SparkGooglePin[],
): void {
  const box = boundsFromPins(pins.map((p) => p.position));
  if (!box) return;
  if (pins.length === 1) {
    map.setCenter(pins[0].position);
    map.setZoom(12);
    return;
  }
  const Bounds = mapsApi()?.maps?.LatLngBounds;
  if (!Bounds) return;
  const bounds = new Bounds();
  bounds.extend({ lat: box.south, lng: box.west });
  bounds.extend({ lat: box.north, lng: box.east });
  map.fitBounds(bounds, 72);
}

/**
 * Lime count-badge clusters for @vis.gl/react-google-maps.
 * Waits for the `marker` library — AdvancedMarkerElement is not on
 * `google.maps` until that import finishes, and a silent skip left
 * Account Map with a populated rail and an empty continent camera.
 */
export function SparkGoogleClusters({ pins }: { pins: SparkGooglePin[] }) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker") as {
    AdvancedMarkerElement?: AdvancedMarkerCtor;
  } | null;
  const signature = useMemo(
    () =>
      pins
        .map((p) => `${p.id}:${p.position.lat}:${p.position.lng}:${p.color}`)
        .join("|"),
    [pins],
  );

  useEffect(() => {
    if (!map || pins.length === 0) return;
    fitMapToPins(map, pins);
    // signature captures pin identity; pins is read inside for callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);

  useEffect(() => {
    if (!map || pins.length === 0) return;
    const AdvancedMarker =
      markerLib?.AdvancedMarkerElement ??
      mapsApi()?.maps?.marker?.AdvancedMarkerElement;
    if (!AdvancedMarker) return;

    const clusterRenderer: Renderer = {
      render: ({ count, position }) => {
        const el = document.createElement("div");
        el.className = "spark-gmap-cluster";
        el.textContent = String(count);
        return new AdvancedMarker({
          position: { lat: position.lat(), lng: position.lng() },
          content: el,
          zIndex: 1000 + count,
          gmpClickable: true,
        }) as never;
      },
    };

    const markers = pins.map((pin) => {
      const marker = new AdvancedMarker({
        position: pin.position,
        content: pinElement(pin.color),
        title: pin.title,
        gmpClickable: true,
      });
      if (pin.onClick) bindMarkerClick(marker, pin.onClick);
      return marker;
    });

    const clusterer = new MarkerClusterer({
      map,
      markers: markers as never,
      renderer: clusterRenderer,
    });

    return () => {
      clusterer.clearMarkers();
      for (const marker of markers) {
        marker.map = null;
      }
    };
    // signature captures pin identity; pins is read inside for callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, markerLib, signature]);

  return null;
}

export default SparkGoogleClusters;
