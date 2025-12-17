import { useState, Suspense, useEffect, useMemo } from "react";
import { Marker, Popup, Circle } from "react-leaflet";
import { useLazyLoadQuery } from "react-relay";
import * as L from "leaflet";

import Layout from "@/layout/Layout";
import InteractiveMap from "@/shared/InteractiveMap";
import { useAuthStore } from "@/store/authStore";

import { TodayEventsCoordinatesQuery } from "@/api/queries/TodayEventsCoordinatesQuery";
import type { TodayEventsCoordinatesQuery as TodayEventsCoordinatesQueryType } from "@/api/queries/__generated__/TodayEventsCoordinatesQuery.graphql";

import markerIconUrl from "leaflet/dist/images/marker-icon.png?url";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png?url";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png?url";

import { LocateFixed, MapPin } from "lucide-react";

// =========================
// ICONS
// =========================
const defaultIcon = new L.Icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const eventIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// =========================
// EVENTS LAYER
// =========================
const EventsMapLayer = ({
  coordinates,
  range,
  unit,
}: {
  coordinates: number[];
  range: number;
  unit: "KILOMETERS" | "MILES";
}) => {
  const { tenantId } = useAuthStore();

  const data = useLazyLoadQuery<TodayEventsCoordinatesQueryType>(
    TodayEventsCoordinatesQuery,
    {
      coordinates,
      range,
      unit,
      filters: { tenantId: tenantId || "" },
    },
    { fetchPolicy: "store-or-network" }
  );

  const events = data.todayEventsCoordinates?.edges ?? [];

  if (events.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-500">
        <div className="bg-base-200/80 backdrop-blur-sm p-4 rounded-xl text-sm">
          No events found in this area
        </div>
      </div>
    );
  }

  return (
    <>
      {events.map(({ node }) => {
        const coords = node.request?.coordinates;
        if (!coords?.[0] || !coords?.[1]) return null;

        return (
          <Marker
            key={node.id}
            position={[coords[0], coords[1]]}
            icon={eventIcon}
          >
            <Popup>
              <div className="min-w-[220px] space-y-2">
                <h3 className="font-semibold">{node.name}</h3>
                <p className="text-xs text-base-content/70">{node.address}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="badge badge-sm badge-primary">
                    {node.eventType?.name}
                  </span>
                  <span className="badge badge-sm badge-outline">
                    {node.status?.name}
                  </span>
                </div>
                <div className="text-xs text-base-content/60">
                  {node.startTime} – {node.endTime}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

// =========================
// PAGE
// =========================
const TodayEventsMap = () => {
  const [center, setCenter] = useState<[number, number]>([19.4326, -99.1332]);
  const [range, setRange] = useState(10);
  const [unit, setUnit] = useState<"KILOMETERS" | "MILES">("KILOMETERS");

  // ===== Actions =====
  const locateUser = () => {
    navigator.geolocation?.getCurrentPosition((pos) =>
      setCenter([pos.coords.latitude, pos.coords.longitude])
    );
  };

  useEffect(() => {
    locateUser();
  }, []);

  const radius = useMemo(
    () => (unit === "KILOMETERS" ? range * 1000 : range * 1609.34),
    [range, unit]
  );

  return (
    <Layout>
      <div className="flex flex-col gap-2 mb-4">
        <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
          <MapPin className="w-8 h-8" />
          <h1>Nearby Events</h1>
        </span>
        <p className="text-sm text-base-content/60">
          Showing events around the selected location
        </p>
      </div>
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
            {/* =========================
                CONTROL PANEL
            ========================= */}
            <div className="flex justify-end gap-6 bg-base-200 rounded-2xl">
              <div className="flex flex-wrap items-center gap-5">
                {/* LOCATION ACTIONS */}
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline flex items-center gap-2"
                    onClick={locateUser}
                  >
                    <LocateFixed className="w-4 h-4" />
                    My location
                  </button>
                </div>

                {/* DIVIDER */}
                <div className="hidden md:block h-6 w-px bg-base-300" />

                <div className="flex flex-col gap-2 ">
                  {/* RANGE */}
                  <div className="w-56 space-y-1">
                    <div className="flex justify-between items-center text-xs text-base-content/60">
                      <span>Radius</span>
                      <span className="font-medium text-base-content">
                        {range} {unit === "KILOMETERS" ? "km" : "mi"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={range}
                      onChange={(e) => setRange(Number(e.target.value))}
                      className="range range-primary range-sm"
                    />
                  </div>
                  {/* UNIT SELECTOR */}
                  <div className="flex items-center justify-end">
                    <div className="join">
                      <button
                        className={`btn btn-sm join-item ${
                          unit === "KILOMETERS" ? "btn-primary" : "btn-ghost"
                        }`}
                        onClick={() => setUnit("KILOMETERS")}
                      >
                        Km
                      </button>
                      <button
                        className={`btn btn-sm join-item ${
                          unit === "MILES" ? "btn-primary" : "btn-ghost"
                        }`}
                        onClick={() => setUnit("MILES")}
                      >
                        Mi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =========================
                MAP
            ========================= */}
            <InteractiveMap
              center={center}
              zoom={11}
              height="flex-1"
              onMapClick={(lat, lng) => setCenter([lat, lng])}
            >
              <Marker position={center} icon={defaultIcon}>
                <Popup>
                  <div className="text-sm">
                    <strong>Search center</strong>
                    <p className="text-xs text-base-content/60">
                      Events are searched around this point
                    </p>
                  </div>
                </Popup>
              </Marker>

              <Circle
                center={center}
                radius={radius}
                pathOptions={{
                  color: "#2563eb",
                  fillColor: "#2563eb",
                  fillOpacity: 0.08,
                }}
              />

              <Suspense
                fallback={
                  <div className="absolute top-4 right-4 badge badge-ghost animate-pulse z-500">
                    Loading events…
                  </div>
                }
              >
                <EventsMapLayer
                  coordinates={center}
                  range={range}
                  unit={unit}
                />
              </Suspense>
            </InteractiveMap>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TodayEventsMap;
