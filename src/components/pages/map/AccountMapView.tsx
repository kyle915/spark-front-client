import { useMemo } from "react";
import { APIProvider, InfoWindow, Map as GMap } from "@vis.gl/react-google-maps";
import { MapCamera } from "@/shared/map/MapCamera";
import {
  FIT_PADDING,
  directionsUrl,
  fitTarget,
  US_DEFAULT,
  type LatLng,
} from "@/shared/map/mapFit";
import {
  COVERAGE_MARK,
  PIN_INK,
  coveragePinSvg,
} from "@/shared/map/markerIcons";
import { SparkGoogleClusters } from "@/shared/map/SparkGoogleClusters";
import { SvgMarker } from "@/shared/map/SvgMarker";
import { useSparkMapStyle } from "@/shared/map/useSparkMapStyle";
import type { CoverageClass } from "@/shared/map/accountCoverage";
import type { Store } from "./accountStores";
import { storeHref } from "@/lib/storeProfile";

/**
 * The Account Map: one pin per store, grouped into counts where they would
 * overlap. Built on the same pieces as the Today map — the shared map style,
 * MapCamera's camera rules, a card with Directions — so the two maps behave
 * alike. All derivation lives in accountStores.ts; this file only draws.
 */

/** Text inside a Google InfoWindow: the bubble is white in both appearances. */
const BUBBLE_INK = PIN_INK;
const PIN_SIZE = 22;
const SELECTED_SIZE = 32;
/** A list click zooms in far enough to pull a store out of its group. */
const STORE_ZOOM = 15;

const LEGEND: ReadonlyArray<CoverageClass> = ["never_visited", "sampled", "repeat"];

/** The coverage mark: on the map, in the legend, in list rows, on the card. */
export function CoverageMark({
  coverage,
  size = 16,
}: {
  coverage: CoverageClass;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0, width: size, height: size, lineHeight: 0 }}
      // Our own fixed SVG text built from a coverage class; no user input.
      dangerouslySetInnerHTML={{ __html: coveragePinSvg(coverage, size) }}
    />
  );
}

export function CoverageLegend() {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"
      style={{ color: "var(--spark-text-secondary)" }}
      aria-label="What the pins mean"
    >
      {LEGEND.map((cls) => (
        <li key={cls} className="inline-flex items-center gap-1.5">
          <CoverageMark coverage={cls} />
          {COVERAGE_MARK[cls].label}
        </li>
      ))}
    </ul>
  );
}

const visitsWords = (n: number): string =>
  n === 0 ? "No filed visits" : n === 1 ? "1 filed visit" : `${n.toLocaleString("en-US")} filed visits`;

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StoreCard({
  store,
  onSchedule,
  onOnlyRetailer,
}: {
  store: Store;
  onSchedule: (store: Store) => void;
  onOnlyRetailer: (name: string) => void;
}) {
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
  const lastRequest = formatDay(store.lastRequestDate);
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
      {store.market ? <p style={{ fontSize: 12 }}>{store.market}</p> : null}
      <p style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <CoverageMark coverage={store.coverage} />
        <span>
          {visitsWords(store.visitCount)}
          {store.planned ? " · Visit planned" : ""}
        </span>
      </p>
      {store.address ? (
        <p style={{ marginTop: 6, fontSize: 12 }}>{store.address}</p>
      ) : null}
      {lastRequest ? (
        <p style={{ marginTop: 6, fontSize: 12 }}>Latest request: {lastRequest}</p>
      ) : null}
      {store.source === "list" ? (
        <p style={{ marginTop: 6, fontSize: 12 }}>From the uploaded account list</p>
      ) : null}
      <p style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 8 }}>
        {store.position ? (
          <a
            href={directionsUrl(store.position)}
            target="_blank"
            rel="noopener noreferrer"
            style={link}
          >
            Directions
          </a>
        ) : null}
        {store.source === "requests" && storeHref(store.key) ? (
          <a href={storeHref(store.key) ?? undefined} style={link}>
            Store page
          </a>
        ) : null}
        <button type="button" style={link} onClick={() => onSchedule(store)}>
          Schedule a visit
        </button>
        <button type="button" style={link} onClick={() => onOnlyRetailer(store.name)}>
          Only this retailer
        </button>
      </p>
    </div>
  );
}

export default function AccountMapView({
  apiKey,
  stores,
  fitKey,
  scope,
  selectedKey,
  focus,
  onSelect,
  onCloseCard,
  onSchedule,
  onOnlyRetailer,
}: {
  apiKey: string | undefined;
  /** The stores passing the filters; those without a position are skipped. */
  stores: ReadonlyArray<Store>;
  fitKey: string;
  scope: string;
  selectedKey: string | null;
  /** Bumped by a list click: pan to this store's pin. */
  focus: { key: string; n: number } | null;
  onSelect: (key: string) => void;
  onCloseCard: () => void;
  onSchedule: (store: Store) => void;
  onOnlyRetailer: (name: string) => void;
}) {
  const mapStyle = useSparkMapStyle();
  const placed = useMemo(
    () => stores.filter((s): s is Store & { position: LatLng } => s.position !== null),
    [stores],
  );
  const pins = useMemo(
    () =>
      placed.map((s) => ({
        id: s.key,
        position: s.position,
        svg: coveragePinSvg(s.coverage, PIN_SIZE),
        size: PIN_SIZE,
        title: `${s.name}: ${COVERAGE_MARK[s.coverage].label}`,
      })),
    [placed],
  );
  const points = useMemo(() => placed.map((s) => s.position), [placed]);

  if (!apiKey) {
    return (
      <div className="absolute inset-0 grid place-items-center px-6">
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          The map is off: no Google Maps key is set for this build.
        </p>
      </div>
    );
  }

  const initial = fitTarget(points);
  const selected = placed.find((s) => s.key === selectedKey) ?? null;
  const focusStore = focus ? placed.find((s) => s.key === focus.key) : null;

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
        <SparkGoogleClusters pins={pins} onSelect={onSelect} />

        {selected ? (
          <>
            {/* Drawn on its own, above the groups, so the chosen store is
                visible even while its pin is inside a count. */}
            <SvgMarker
              position={selected.position}
              svg={coveragePinSvg(selected.coverage, SELECTED_SIZE)}
              size={SELECTED_SIZE}
              zIndex={100000}
              title={selected.name}
            />
            <InfoWindow
              key={`card-${selected.key}`}
              position={selected.position}
              pixelOffset={[0, -18]}
              onCloseClick={onCloseCard}
              headerContent={
                <span style={{ color: BUBBLE_INK, fontSize: 14, fontWeight: 700 }}>
                  {selected.name}
                </span>
              }
            >
              <StoreCard
                store={selected}
                onSchedule={onSchedule}
                onOnlyRetailer={onOnlyRetailer}
              />
            </InfoWindow>
          </>
        ) : null}
      </GMap>
      <MapCamera
        points={points}
        fitKey={fitKey}
        scope={scope}
        focus={
          focus && focusStore ? { position: focusStore.position, n: focus.n } : null
        }
        focusZoom={STORE_ZOOM}
        showAllLabel="Show all stores"
      />
    </APIProvider>
  );
}
