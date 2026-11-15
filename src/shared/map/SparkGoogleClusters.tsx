/// <reference types="google.maps" />
import { useEffect, useMemo, useRef } from "react";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MarkerClusterer, type Renderer } from "@googlemaps/markerclusterer";
import { clusterSize, clusterSvg, svgDataUrl } from "./markerIcons";

export type SparkGooglePin = {
  id: string;
  position: { lat: number; lng: number };
  /** The mark, as SVG text (see markerIcons.ts). */
  svg: string;
  size: number;
  title?: string;
};

/**
 * Pins that group into a count when they would overlap, and split apart as
 * the map zooms in. Clicking a group zooms to its stores.
 *
 * Image markers, not AdvancedMarkers: those need a `mapId`, and a map with a
 * `mapId` ignores the shared map style. The camera is not moved here — that
 * is MapCamera's job.
 */
export function SparkGoogleClusters({
  pins,
  onSelect,
  groupNoun = "stores",
}: {
  pins: ReadonlyArray<SparkGooglePin>;
  onSelect: (id: string) => void;
  /** For a group's tooltip: "12 stores". */
  groupNoun?: string;
}) {
  const map = useMap();
  // Size / Point and Marker only exist once their libraries have loaded.
  const core = useMapsLibrary("core");
  const markerLib = useMapsLibrary("marker");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  const signature = useMemo(
    () =>
      pins
        .map((p) => `${p.id}:${p.position.lat}:${p.position.lng}:${p.size}:${p.svg.length}:${p.title ?? ""}`)
        .join("|"),
    [pins],
  );

  useEffect(() => {
    if (!map || !core || !markerLib) return;
    const current = pinsRef.current;
    if (current.length === 0) return;

    const icons = new Map<string, google.maps.Icon>();
    const iconFor = (svg: string, size: number): google.maps.Icon => {
      const key = `${size}|${svg}`;
      let icon = icons.get(key);
      if (!icon) {
        icon = {
          url: svgDataUrl(svg),
          scaledSize: new core.Size(size, size),
          anchor: new core.Point(size / 2, size / 2),
        };
        icons.set(key, icon);
      }
      return icon;
    };

    const markers = current.map((pin) => {
      const marker = new markerLib.Marker({
        position: pin.position,
        icon: iconFor(pin.svg, pin.size),
        title: pin.title,
      });
      marker.addListener("click", () => onSelectRef.current(pin.id));
      return marker;
    });

    const renderer: Renderer = {
      render: ({ count, position }) => {
        const size = clusterSize(count);
        return new markerLib.Marker({
          position,
          icon: iconFor(clusterSvg(size), size),
          label: {
            text: count.toLocaleString("en-US"),
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: "600",
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
          },
          title: `${count.toLocaleString("en-US")} ${groupNoun}`,
          // Groups sit above single pins; bigger groups above smaller ones.
          zIndex: 1000 + count,
        });
      },
    };

    const clusterer = new MarkerClusterer({ map, markers, renderer });
    return () => {
      clusterer.clearMarkers();
      // Detach the overlay too, or its map listeners outlive this effect.
      (clusterer as unknown as { setMap: (m: null) => void }).setMap(null);
    };
    // `signature` is the identity of the pin set; pins are read through a ref.
  }, [map, core, markerLib, signature, groupNoun]);

  return null;
}

export default SparkGoogleClusters;
