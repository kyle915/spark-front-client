import { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GMap,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  LEGEND_ORDER,
  SINGLE_PIN_ZOOM,
  STATUS_META,
  US_DEFAULT,
  baMarkerTitle,
  cardLines,
  fitTarget,
  locationAgeWords,
  type BaMarker,
  type EventPin,
  type EventStatus,
  type FitTarget,
  type LatLng,
  type NameFormatter,
} from "./todayMap";

/**
 * The Today map: one pin per event with a position, smaller dots for the
 * phones of people on the clock, a legend in words. All derivation lives in
 * todayMap.ts; this file only draws and moves the camera.
 */

/** Text inside a Google InfoWindow: the bubble is white in both appearances. */
const BUBBLE_INK = "#14160f";
/** Phone-location dot. Fixed for the same reason the pin hues are. */
const PHONE_DOT = "#1f7fc0";
const FIT_PADDING = { top: 56, right: 56, bottom: 56, left: 56 };

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The status mark: used on the map, in the legend, in list rows, on cards. */
export function StatusPin({
  status,
  size = 28,
}: {
  status: EventStatus;
  size?: number;
}) {
  const meta = STATUS_META[status];
  const ring = meta.shape === "ring";
  // Amber and the hollow ring are light fills; everything else takes white.
  const ink = ring || status === "late" ? BUBBLE_INK : "#ffffff";
  const shape = (props: React.SVGProps<SVGElement>) => {
    if (meta.shape === "diamond") {
      return (
        <polygon
          points="14,3 25,14 14,25 3,14"
          strokeLinejoin="round"
          {...(props as React.SVGProps<SVGPolygonElement>)}
        />
      );
    }
    if (meta.shape === "square") {
      return (
        <rect
          x="5"
          y="5"
          width="18"
          height="18"
          rx="3"
          {...(props as React.SVGProps<SVGRectElement>)}
        />
      );
    }
    return (
      <circle cx="14" cy="14" r="9.5" {...(props as React.SVGProps<SVGCircleElement>)} />
    );
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      {ring ? (
        <>
          {shape({ fill: "none", stroke: "#ffffff", strokeWidth: 5 })}
          {shape({ fill: "#ffffff", stroke: BUBBLE_INK, strokeWidth: 2.5 })}
        </>
      ) : (
        <>
          {shape({ fill: "none", stroke: "rgba(20,22,15,0.7)", strokeWidth: 4.5 })}
          {shape({ fill: meta.color, stroke: "#ffffff", strokeWidth: 2 })}
        </>
      )}
      <g
        stroke={ink}
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {meta.glyph === "cross" && <path d="M10.5 10.5l7 7M17.5 10.5l-7 7" />}
        {meta.glyph === "bang" && (
          <>
            <path d="M14 8.5v6" />
            <circle cx="14" cy="18.6" r="1.2" fill={ink} stroke="none" />
          </>
        )}
        {meta.glyph === "play" && (
          <path d="M11.8 9.8l6.4 4.2-6.4 4.2z" fill={ink} stroke="none" />
        )}
        {meta.glyph === "check" && <path d="M9.6 14.4l3 3 5.8-6.6" />}
        {meta.glyph === "dash" && <path d="M10 14h8" />}
        {meta.glyph === "dot" && <circle cx="14" cy="14" r="2.6" fill={ink} stroke="none" />}
      </g>
    </svg>
  );
}

function PhoneDot({ stale, size = 12 }: { stale: boolean; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: 9999,
        background: PHONE_DOT,
        border: "2px solid #ffffff",
        outline: "1px solid rgba(20,22,15,0.7)",
        opacity: stale ? 0.55 : 1,
        flexShrink: 0,
      }}
    />
  );
}

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
 * Camera rules:
 *  - fit to every pin when the SET of pins changes (`fitKey`), never on a
 *    poll that only changed a status or moved a phone;
 *  - once the person has dragged or zoomed, leave the camera alone until
 *    they ask ("Show all events") or the brand/day (`scope`) changes;
 *  - a list click pans to that pin and counts as the person's own move.
 */
function CameraController({
  points,
  fitKey,
  scope,
  focus,
  showAllLabel,
}: {
  points: ReadonlyArray<LatLng>;
  fitKey: string;
  scope: string;
  focus: { position: LatLng; n: number } | null;
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
    const zoom = Math.max(map.getZoom() ?? 0, SINGLE_PIN_ZOOM);
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

function EventCard({
  pin,
  nameOf,
  onOpenEvent,
}: {
  pin: EventPin;
  nameOf: NameFormatter;
  onOpenEvent: (uuid: string) => void;
}) {
  const c = cardLines(pin, nameOf);
  const link: React.CSSProperties = {
    color: BUBBLE_INK,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "underline",
    background: "none",
    border: 0,
    padding: 0,
    cursor: "pointer",
    font: "inherit",
  };
  return (
    <div
      style={{
        color: BUBBLE_INK,
        fontSize: 13,
        lineHeight: 1.45,
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      {c.place ? <p style={{ fontSize: 12 }}>{c.place}</p> : null}
      <p style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <StatusPin status={pin.status} size={16} />
        <span>
          {c.status} · {c.time}
        </span>
      </p>
      {c.people.length > 0 ? (
        <ul style={{ marginTop: 6, padding: 0, listStyle: "none" }}>
          {c.people.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      ) : (
        <p style={{ marginTop: 6 }}>{c.peopleNote}</p>
      )}
      {c.address ? <p style={{ marginTop: 6, fontSize: 12 }}>{c.address}</p> : null}
      <p style={{ display: "flex", gap: 14, marginTop: 8 }}>
        {c.directionsUrl ? (
          <a
            href={c.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={link}
          >
            Directions
          </a>
        ) : null}
        <button type="button" style={link} onClick={() => onOpenEvent(pin.uuid)}>
          Open event
        </button>
      </p>
    </div>
  );
}

export function MapLegend({ showPhones }: { showPhones: boolean }) {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"
      style={{ color: "var(--spark-text-secondary)" }}
      aria-label="What the pins mean"
    >
      {LEGEND_ORDER.map((status) => (
        <li key={status} className="inline-flex items-center gap-1.5">
          <StatusPin status={status} size={16} />
          {STATUS_META[status].label}
        </li>
      ))}
      {showPhones ? (
        <li className="inline-flex items-center gap-1.5">
          <PhoneDot stale={false} size={10} />
          Ambassador's phone
        </li>
      ) : null}
    </ul>
  );
}

export default function TodayMapView({
  apiKey,
  pins,
  bas,
  fitKey,
  scope,
  selectedUuid,
  focus,
  nameOf,
  onSelectPin,
  onCloseCard,
  onOpenEvent,
}: {
  apiKey: string | undefined;
  pins: ReadonlyArray<EventPin>;
  /** Already empty for brand clients. */
  bas: ReadonlyArray<BaMarker>;
  fitKey: string;
  scope: string;
  selectedUuid: string | null;
  /** Bumped by a list click: pan to this event's pin. */
  focus: { uuid: string; n: number } | null;
  nameOf: NameFormatter;
  onSelectPin: (uuid: string) => void;
  onCloseCard: () => void;
  onOpenEvent: (uuid: string) => void;
}) {
  const [openBa, setOpenBa] = useState<string | null>(null);

  if (!apiKey) {
    return (
      <div className="absolute inset-0 grid place-items-center px-6">
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          The map is off: no Google Maps key is set for this build.
        </p>
      </div>
    );
  }

  const points: LatLng[] = [
    ...pins.map((p) => p.position),
    ...bas.map((b) => b.position),
  ];
  const initial = fitTarget(points);
  const selected = pins.find((p) => p.uuid === selectedUuid) ?? null;
  const focusPin = focus ? pins.find((p) => p.uuid === focus.uuid) : null;
  const ba = openBa ? (bas.find((b) => b.key === openBa) ?? null) : null;

  return (
    <APIProvider apiKey={apiKey} libraries={["marker"]}>
      <GMap
        mapId="spark-v2-today"
        {...(initial.kind === "bounds"
          ? {
              defaultBounds: {
                north: initial.north,
                south: initial.south,
                east: initial.east,
                west: initial.west,
                padding: FIT_PADDING,
              },
            }
          : {
              defaultCenter:
                initial.kind === "single" ? initial.center : US_DEFAULT.center,
              defaultZoom:
                initial.kind === "single" ? initial.zoom : US_DEFAULT.zoom,
            })}
        gestureHandling="greedy"
        mapTypeControl={false}
        streetViewControl={false}
        zoomControl
        fullscreenControl
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        {bas.map((b) => (
          <AdvancedMarker
            key={`ba-${b.key}`}
            position={b.position}
            anchorLeft="-50%"
            anchorTop="-50%"
            zIndex={1}
            title={baMarkerTitle(b)}
            onClick={() => {
              onCloseCard();
              setOpenBa(b.key);
            }}
          >
            <PhoneDot stale={b.stale} />
          </AdvancedMarker>
        ))}

        {pins.map((p) => {
          const isSelected = p.uuid === selectedUuid;
          return (
            <AdvancedMarker
              key={`ev-${p.uuid}`}
              position={p.position}
              anchorLeft="-50%"
              anchorTop="-50%"
              zIndex={isSelected ? 1000 : 10 + STATUS_META[p.status].rank}
              title={`${p.name}: ${STATUS_META[p.status].label}`}
              onClick={() => {
                setOpenBa(null);
                onSelectPin(p.uuid);
              }}
            >
              <StatusPin status={p.status} size={isSelected ? 38 : 28} />
            </AdvancedMarker>
          );
        })}

        {selected ? (
          <InfoWindow
            key={`card-${selected.uuid}`}
            position={selected.position}
            pixelOffset={[0, -20]}
            onCloseClick={onCloseCard}
            headerContent={
              <span style={{ color: BUBBLE_INK, fontSize: 14, fontWeight: 700 }}>
                {selected.name}
              </span>
            }
          >
            <EventCard pin={selected} nameOf={nameOf} onOpenEvent={onOpenEvent} />
          </InfoWindow>
        ) : null}

        {ba && !selected ? (
          <InfoWindow
            key={`ba-card-${ba.key}`}
            position={ba.position}
            pixelOffset={[0, -8]}
            onCloseClick={() => setOpenBa(null)}
            headerContent={
              <span style={{ color: BUBBLE_INK, fontSize: 14, fontWeight: 700 }}>
                {ba.name}
              </span>
            }
          >
            <div
              style={{ color: BUBBLE_INK, fontSize: 13, lineHeight: 1.45, minWidth: 180 }}
            >
              <p>On the clock at {ba.eventName}</p>
              <p style={{ marginTop: 4, fontSize: 12 }}>
                {locationAgeWords(ba.ageMin)}
              </p>
            </div>
          </InfoWindow>
        ) : null}
      </GMap>
      <CameraController
        points={points}
        fitKey={fitKey}
        scope={scope}
        focus={
          focus && focusPin ? { position: focusPin.position, n: focus.n } : null
        }
        showAllLabel={pins.length > 0 ? "Show all events" : "Show everyone"}
      />
    </APIProvider>
  );
}
