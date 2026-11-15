import { useCallback, useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import {
  FIT_PADDING,
  fitTarget,
  prefersReducedMotion,
  SINGLE_PIN_ZOOM,
  US_DEFAULT,
  type FitTarget,
  type LatLng,
} from "./mapFit";

type GoogleMap = NonNullable<ReturnType<typeof useMap>>;

function applyFit(map: GoogleMap, target: FitTarget): void {
  if (target.kind === "none") {
    map.moveCamera({ center: US_DEFAULT.center, zoom: US_DEFAULT.zoom });
    return;
  }
  if (target.kind === "single") {
    map.moveCamera({ center: target.center, zoom: target.zoom });
    return;
  }
  map.fitBounds(
    {
      north: target.north,
      south: target.south,
      east: target.east,
      west: target.west,
    },
    FIT_PADDING,
  );
}

/**
 * Camera rules, the same on every Spark map:
 *  - fit to every pin when the SET of pins changes (`fitKey`), never on a
 *    refresh that only changed a status or moved a phone;
 *  - once the person has dragged or zoomed, leave the camera alone until
 *    they ask (the "show all" button) or the `scope` changes (another brand,
 *    day, or set of filters);
 *  - a list click pans to that pin and counts as the person's own move.
 *
 * Must be rendered inside the map's APIProvider. Draws the "show all" button
 * in the top-left corner of the nearest positioned ancestor.
 */
export function MapCamera({
  points,
  fitKey,
  scope,
  focus,
  focusZoom = SINGLE_PIN_ZOOM,
  showAllLabel,
}: {
  points: ReadonlyArray<LatLng>;
  fitKey: string;
  scope: string;
  focus: { position: LatLng; n: number } | null;
  /** Zoom in at least this far when a list row is clicked. */
  focusZoom?: number;
  showAllLabel: string;
}) {
  const map = useMap();
  const userMoved = useRef(false);
  // True while a camera change of ours is settling, so it is not mistaken
  // for the person zooming. Starts true: the map's own first layout.
  const ours = useRef(true);
  const oursTimer = useRef<number | null>(null);
  const lastScope = useRef(scope);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const markOurs = useCallback(() => {
    ours.current = true;
    if (oursTimer.current !== null) window.clearTimeout(oursTimer.current);
    // `idle` does not fire when the camera did not actually move.
    oursTimer.current = window.setTimeout(() => {
      ours.current = false;
    }, 1500);
  }, []);

  useEffect(() => {
    if (!map) return;
    const listeners = [
      map.addListener("dragstart", () => {
        userMoved.current = true;
      }),
      map.addListener("zoom_changed", () => {
        if (!ours.current) userMoved.current = true;
      }),
      map.addListener("idle", () => {
        ours.current = false;
      }),
    ];
    return () => {
      for (const l of listeners) l.remove();
      if (oursTimer.current !== null) window.clearTimeout(oursTimer.current);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    if (lastScope.current !== scope) {
      lastScope.current = scope;
      userMoved.current = false;
    }
    if (userMoved.current) return;
    markOurs();
    applyFit(map, fitTarget(pointsRef.current));
  }, [map, fitKey, scope, markOurs]);

  const focusN = focus?.n ?? 0;
  useEffect(() => {
    if (!map || !focus) return;
    userMoved.current = true;
    markOurs();
    const zoom = Math.max(map.getZoom() ?? 0, focusZoom);
    if (prefersReducedMotion()) {
      map.moveCamera({ center: focus.position, zoom });
    } else {
      if ((map.getZoom() ?? 0) < zoom) map.setZoom(zoom);
      map.panTo(focus.position);
    }
    // `focusN` is the click counter: the same row clicked twice pans twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusN]);

  if (points.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (!map) return;
        userMoved.current = false;
        markOurs();
        applyFit(map, fitTarget(pointsRef.current));
      }}
      className="absolute top-3 left-3 z-10 text-xs font-medium px-2.5 py-1.5 rounded-lg"
      style={{
        background: "var(--spark-surface)",
        color: "var(--spark-text)",
        border: "1px solid var(--spark-border)",
      }}
    >
      {showAllLabel}
    </button>
  );
}

export default MapCamera;
