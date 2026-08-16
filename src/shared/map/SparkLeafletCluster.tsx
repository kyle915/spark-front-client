import { useEffect } from "react";
import { useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { clusterIconCreateFunction, sparkDotIcon, STATUS_COLOR } from "./sparkMap";

export type SparkLeafletPin = {
  id: string;
  position: [number, number];
  color?: string;
  popupHtml?: string;
};

/**
 * Leaflet.markercluster with a lime count badge — not the plugin's
 * default green / yellow / red chrome.
 */
export function SparkLeafletCluster({ pins }: { pins: SparkLeafletPin[] }) {
  const map = useMap();
  const signature = pins
    .map((p) => `${p.id}:${p.position[0]}:${p.position[1]}:${p.color ?? ""}`)
    .join("|");

  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
      iconCreateFunction: clusterIconCreateFunction,
    });

    for (const pin of pins) {
      const marker = L.marker(pin.position, {
        icon: sparkDotIcon(pin.color ?? STATUS_COLOR.recent),
      });
      if (pin.popupHtml) marker.bindPopup(pin.popupHtml);
      group.addLayer(marker);
    }

    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);

  return null;
}

export default SparkLeafletCluster;
