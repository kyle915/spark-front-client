import { useEffect, useMemo } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { MarkerClusterer, type Renderer } from "@googlemaps/markerclusterer";

export type SparkGooglePin = {
  id: string;
  position: { lat: number; lng: number };
  color: string;
  onClick?: () => void;
  title?: string;
};

type AdvancedMarkerCtor = new (opts: {
  position: { lat: number; lng: number };
  content?: HTMLElement;
  zIndex?: number;
  title?: string;
}) => {
  addListener: (event: string, fn: () => void) => void;
  map: unknown;
};

type GoogleMapsWindow = {
  google?: {
    maps?: {
      marker?: {
        AdvancedMarkerElement?: AdvancedMarkerCtor;
      };
    };
  };
};

function mapsApi(): GoogleMapsWindow["google"] {
  return (window as GoogleMapsWindow).google;
}

const clusterRenderer: Renderer = {
  render: ({ count, position }) => {
    const AdvancedMarker = mapsApi()?.maps?.marker?.AdvancedMarkerElement;
    const el = document.createElement("div");
    el.className = "spark-gmap-cluster";
    el.textContent = String(count);
    if (!AdvancedMarker) {
      return { position, content: el } as never;
    }
    return new AdvancedMarker({
      position: { lat: position.lat(), lng: position.lng() },
      content: el,
      zIndex: 1000 + count,
    }) as never;
  },
};

function pinElement(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "spark-gmap-dot";
  el.style.background = color;
  el.style.boxShadow = `0 0 10px ${color}`;
  return el;
}

/**
 * Lime count-badge clusters for @vis.gl/react-google-maps.
 * Not default Google cluster chrome.
 */
export function SparkGoogleClusters({ pins }: { pins: SparkGooglePin[] }) {
  const map = useMap();
  const signature = useMemo(
    () =>
      pins
        .map((p) => `${p.id}:${p.position.lat}:${p.position.lng}:${p.color}`)
        .join("|"),
    [pins],
  );

  useEffect(() => {
    if (!map || pins.length === 0) return;
    const AdvancedMarker = mapsApi()?.maps?.marker?.AdvancedMarkerElement;
    if (!AdvancedMarker) return;

    const markers = pins.map((pin) => {
      const marker = new AdvancedMarker({
        position: pin.position,
        content: pinElement(pin.color),
        title: pin.title,
      });
      if (pin.onClick) {
        marker.addListener("click", pin.onClick);
      }
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
  }, [map, signature]);

  return null;
}

export default SparkGoogleClusters;
