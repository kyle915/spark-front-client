import { useState, Suspense, useEffect, useMemo } from "react";
import { Marker, Popup, Circle } from "react-leaflet";
import { useLazyLoadQuery } from "react-relay";

import Layout from "@/layout/Layout";
import InteractiveMap from "@/shared/InteractiveMap";
import { SparkLeafletCluster } from "@/shared/map/SparkLeafletCluster";
import { STATUS_COLOR, sparkDotIcon } from "@/shared/map/sparkMap";
import { useAuthStore } from "@/store/authStore";

import { TodayEventsCoordinatesQuery } from "@/api/queries/TodayEventsCoordinatesQuery";
import type { TodayEventsCoordinatesQuery as TodayEventsCoordinatesQueryType } from "@/api/queries/__generated__/TodayEventsCoordinatesQuery.graphql";

import { LocateFixed, MapPin } from "lucide-react";

const defaultIcon = sparkDotIcon(STATUS_COLOR.scheduled);

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
  unit: "MILES";
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
    { fetchPolicy: "store-or-network" },
  );

  const events = useMemo(
    () => data.todayEventsCoordinates?.edges ?? [],
    [data.todayEventsCoordinates],
  );

  const pins = useMemo(
    () =>
      events
        .map(({ node }) => {
          const coords = node.request?.coordinates;
          if (!coords?.[0] || !coords?.[1]) return null;
          const type = node.eventType?.name ?? "";
          const status = node.status?.name ?? "";
          return {
            id: node.id,
            position: [coords[0], coords[1]] as [number, number],
            color: STATUS_COLOR.unvisited,
            popupHtml: `<div style="min-width:220px">
              <strong>${escapeHtml(node.name ?? "Event")}</strong>
              <p style="font-size:12px;margin:4px 0 0">${escapeHtml(node.address ?? "")}</p>
              <p style="font-size:11px;margin:6px 0 0">${escapeHtml(type)} · ${escapeHtml(status)}</p>
              <p style="font-size:11px;margin:2px 0 0">${escapeHtml(node.startTime ?? "")} – ${escapeHtml(node.endTime ?? "")}</p>
            </div>`,
          };
        })
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [events],
  );

  if (events.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-500">
        <div className="bg-base-200/80 backdrop-blur-sm p-4 rounded-xl text-sm">
          No events found in this area
        </div>
      </div>
    );
  }

  return <SparkLeafletCluster pins={pins} />;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =========================
// PAGE
// =========================
const TodayEventsMap = () => {
  const [center, setCenter] = useState<[number, number]>([40.7128, -74.006]);
  const [range, setRange] = useState(35);
  const unit = "MILES";

  // ===== Actions =====
  const locateUser = () => {
    navigator.geolocation?.getCurrentPosition((pos) =>
      setCenter([pos.coords.latitude, pos.coords.longitude]),
    );
  };

  useEffect(() => {
    locateUser();
  }, []);

  const radius = useMemo(() => range * 1609.34, [range]);

  return (
    <Layout>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <MapPin className="w-8 h-8" />
          </div>
          <h1>Nearby Events</h1>
        </div>

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
                        {range} miles
                      </span>
                    </div>
                    <input
                      type="range"
                      min={35}
                      max={75}
                      value={range}
                      onChange={(e) => setRange(Number(e.target.value))}
                      className="range range-primary range-sm"
                    />
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
                  color: "#c5f546",
                  fillColor: "#c5f546",
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
