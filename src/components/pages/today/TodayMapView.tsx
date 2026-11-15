import { useState } from "react";
import { APIProvider, InfoWindow, Map as GMap } from "@vis.gl/react-google-maps";
import { MapCamera } from "@/shared/map/MapCamera";
import { FIT_PADDING } from "@/shared/map/mapFit";
import { PIN_INK, phoneDotSvg } from "@/shared/map/markerIcons";
import { SvgMarker } from "@/shared/map/SvgMarker";
import { useSparkMapStyle } from "@/shared/map/useSparkMapStyle";
import {
  LEGEND_ORDER,
  STATUS_META,
  US_DEFAULT,
  baMarkerTitle,
  cardLines,
  fitTarget,
  locationAgeWords,
  type BaMarker,
  type EventPin,
  type EventStatus,
  type LatLng,
  type NameFormatter,
} from "./todayMap";
import { statusPinSvg } from "./statusPinSvg";

/**
 * The Today map: one pin per event with a position, smaller dots for the
 * phones of people on the clock, a legend in words. All derivation lives in
 * todayMap.ts; this file only draws. The camera (MapCamera) and the map
 * style (useSparkMapStyle) are shared with the Account Map.
 */

/** Text inside a Google InfoWindow: the bubble is white in both appearances. */
const BUBBLE_INK = PIN_INK;

/** The status mark: used on the map, in the legend, in list rows, on cards.
 *  One drawing (statusPinSvg.ts) for all of them. */
export function StatusPin({
  status,
  size = 28,
}: {
  status: EventStatus;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0, width: size, height: size, lineHeight: 0 }}
      // Our own fixed SVG text built from a status and a number; no user input.
      dangerouslySetInnerHTML={{ __html: statusPinSvg(status, size) }}
    />
  );
}

function PhoneDot({ size = 12 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0, width: size, height: size, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: phoneDotSvg(size) }}
    />
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
          <PhoneDot size={12} />
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
  const mapStyle = useSparkMapStyle();

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
        styles={mapStyle.styles as never}
        backgroundColor={mapStyle.backgroundColor}
        gestureHandling="greedy"
        mapTypeControl={false}
        streetViewControl={false}
        zoomControl
        fullscreenControl
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        {bas.map((b) => (
          <SvgMarker
            key={`ba-${b.key}`}
            position={b.position}
            svg={phoneDotSvg(14)}
            size={14}
            zIndex={1}
            opacity={b.stale ? 0.55 : 1}
            title={baMarkerTitle(b)}
            onClick={() => {
              onCloseCard();
              setOpenBa(b.key);
            }}
          />
        ))}

        {pins.map((p) => {
          const isSelected = p.uuid === selectedUuid;
          const size = isSelected ? 38 : 28;
          return (
            <SvgMarker
              key={`ev-${p.uuid}`}
              position={p.position}
              svg={statusPinSvg(p.status, size)}
              size={size}
              zIndex={isSelected ? 1000 : 10 + STATUS_META[p.status].rank}
              title={`${p.name}: ${STATUS_META[p.status].label}`}
              onClick={() => {
                setOpenBa(null);
                onSelectPin(p.uuid);
              }}
            />
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
      <MapCamera
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
