import { useState, Suspense, useEffect } from "react";
import { Marker, Popup, Circle } from "react-leaflet";
import { useLazyLoadQuery } from "react-relay";
import { TodayEventsCoordinatesQuery } from "@/api/queries/TodayEventsCoordinatesQuery";
import type { TodayEventsCoordinatesQuery as TodayEventsCoordinatesQueryType } from "@/api/queries/__generated__/TodayEventsCoordinatesQuery.graphql";
import * as L from "leaflet";
import markerIconUrl from "leaflet/dist/images/marker-icon.png?url";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png?url";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png?url";
import Layout from "@/layout/Layout";
import InteractiveMap from "@/shared/InteractiveMap";

// Icons
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

const EventsMapContent = ({
  coordinates,
  range,
  unit,
}: {
  coordinates: number[];
  range: number;
  unit: "KILOMETERS" | "MILES";
}) => {
  const data = useLazyLoadQuery<TodayEventsCoordinatesQueryType>(
    TodayEventsCoordinatesQuery,
    { coordinates, range, unit },
    { fetchPolicy: "store-or-network" }
  );
  const events = data.todayEventsCoordinates?.edges || [];

  return (
    <>
      {events.map((edge) => {
        const event = edge.node;
        const eventCoordinates = event.request?.coordinates;
        const lat = eventCoordinates?.[0];
        const lng = eventCoordinates?.[1];

        return lat && lng ? (
          <Marker key={event.id} position={[lat, lng]} icon={eventIcon}>
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-bold text-lg">{event.name}</h3>
                <p className="text-sm text-gray-600">{event.address}</p>
                <div className="mt-2 flex flex-col gap-1 text-xs">
                  <span className="badge badge-sm badge-primary">
                    {event.eventType?.name}
                  </span>
                  <span className="badge badge-sm badge-ghost">
                    {event.status?.name}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {event.startTime} - {event.endTime}
                </div>
              </div>
            </Popup>
          </Marker>
        ) : null;
      })}
    </>
  );
};

const TodayEventsMap = () => {
  const [center, setCenter] = useState<[number, number]>([19.4326, -99.1332]); // Default: Mexico City
  const [range, setRange] = useState(10);
  const [unit, setUnit] = useState<"KILOMETERS" | "MILES">("KILOMETERS");

  // Get user's current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.warn("Geolocation error:", error.message);
          // Keep default location (Mexico City) if geolocation fails
        }
      );
    }
  }, []);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-base-200 p-4 rounded-xl">
          <div>
            <h1 className="text-2xl font-bold">Map of Events</h1>
            <p className="text-sm text-base-content/70">
              Select a location and range to find events
            </p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="form-control">
              <label className="label cursor-pointer gap-2">
                <span className="label-text">Kilometers</span>
                <input
                  type="radio"
                  name="unit"
                  className="radio radio-primary radio-sm"
                  checked={unit === "KILOMETERS"}
                  onChange={() => setUnit("KILOMETERS")}
                />
              </label>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer gap-2">
                <span className="label-text">Miles</span>
                <input
                  type="radio"
                  name="unit"
                  className="radio radio-primary radio-sm"
                  checked={unit === "MILES"}
                  onChange={() => setUnit("MILES")}
                />
              </label>
            </div>
            <div className="form-control w-full max-w-xs">
              <label className="label">
                <span className="label-text">
                  Range ({unit === "KILOMETERS" ? "km" : "mi"}): {range}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                className="range range-primary range-sm"
              />
            </div>
          </div>
        </div>

        <InteractiveMap
          center={center}
          zoom={12}
          height="flex-1"
          onMapClick={(lat, lng) => setCenter([lat, lng])}
        >
          {/* Center Marker */}
          <Marker position={center} icon={defaultIcon}>
            <Popup>Selected Location</Popup>
          </Marker>

          {/* Range Circle */}
          <Circle
            center={center}
            radius={unit === "KILOMETERS" ? range * 1000 : range * 1609.34}
            pathOptions={{ color: "blue", fillColor: "blue", fillOpacity: 0.1 }}
          />

          {/* Events */}
          <Suspense fallback={null}>
            <EventsMapContent coordinates={center} range={range} unit={unit} />
          </Suspense>
        </InteractiveMap>
      </div>
    </Layout>
  );
};

export default TodayEventsMap;
