import { useMemo } from "react";
import { Marker, useMapsLibrary } from "@vis.gl/react-google-maps";
import { svgDataUrl } from "./markerIcons";

/**
 * One pin drawn from SVG text, centred on its position.
 *
 * An image marker rather than an AdvancedMarker on purpose: AdvancedMarkers
 * need a `mapId`, and a map with a `mapId` ignores the shared map style
 * (sparkMapStyle.ts).
 */
export function SvgMarker({
  position,
  svg,
  size,
  title,
  zIndex,
  opacity,
  onClick,
}: {
  position: { lat: number; lng: number };
  svg: string;
  size: number;
  title?: string;
  zIndex?: number;
  opacity?: number;
  onClick?: () => void;
}) {
  // Size and Point only exist once the Maps library has loaded.
  const core = useMapsLibrary("core");
  // google.maps.Marker lives in the "marker" library; wait for it too.
  const markerLib = useMapsLibrary("marker");
  const icon = useMemo(
    () =>
      core
        ? {
            url: svgDataUrl(svg),
            scaledSize: new core.Size(size, size),
            anchor: new core.Point(size / 2, size / 2),
          }
        : null,
    [core, svg, size],
  );
  if (!icon || !markerLib) return null;
  return (
    <Marker
      position={position}
      icon={icon}
      title={title}
      zIndex={zIndex}
      opacity={opacity}
      onClick={onClick}
    />
  );
}

export default SvgMarker;
