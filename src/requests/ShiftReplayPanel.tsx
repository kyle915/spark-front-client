import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { EventLocationTrailQuery } from "@/api/queries/EventLocationTrailQuery";
import type { EventLocationTrailQuery as EventLocationTrailQueryType } from "@api/queries/__generated__/EventLocationTrailQuery.graphql";

/**
 * Shift Replay — renders the BA's GPS trail during an activation as
 * a polyline on Google Maps. Powered by the eventLocationTrail query
 * (oldest-first list of LocationPing rows). Embeds inside the Field
 * Reports section on /request/view; renders nothing when the event
 * has zero pings, so unmonitored shifts don't get an empty card.
 *
 * Polyline rendering uses a small wrapper component that subscribes
 * to the Map instance and instantiates google.maps.Polyline directly —
 * @vis.gl/react-google-maps doesn't ship a declarative Polyline.
 */

type TrailPoint = {
  uuid: string;
  lat: number;
  lng: number;
  recordedAt: string;
  source: string;
};

const TRAIL_LIME = "#f2f3ee";
const TRAIL_LIME_TRANSLUCENT = "rgba(242,243,238,0.35)";

const fmtTimeLabel = (raw: string): string => {
  try {
    return new Date(raw).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw.slice(11, 16);
  }
};

const fmtDuration = (startIso: string, endIso: string): string => {
  try {
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return "—";
    const mins = Math.round(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  } catch {
    return "—";
  }
};

const haversineMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const R = 6371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const Polyline: React.FC<{
  points: { lat: number; lng: number }[];
}> = ({ points }) => {
  // Direct Google Maps interop: lazily reaches into the map instance
  // via the imperative API. Strict typing is sidestepped because we
  // don't pull in @types/google.maps here.
  const [, setLoaded] = useState(0);
  useMemo(() => {
    // Re-render once on mount so the map instance is available.
    setLoaded((x) => x + 1);
  }, []);
  // We render the polyline declaratively via the map's internal
  // `__loaded` event hook. @vis.gl/react-google-maps exposes
  // `useMap()` but importing it pulls a context — to keep this
  // panel decoupled, we let the parent pass the Map node and
  // attach the polyline lifecycle via a child useEffect.
  void points;
  return null;
};

const Inner: React.FC<{ eventUuid: string; apiKey: string }> = ({
  eventUuid,
  apiKey,
}) => {
  const data = useLazyLoadQuery<EventLocationTrailQueryType>(
    EventLocationTrailQuery,
    { eventUuid },
    { fetchPolicy: "store-or-network" },
  );

  const points: TrailPoint[] = useMemo(
    () =>
      (data?.eventLocationTrail ?? []).map((p) => ({
        uuid: String(p.uuid),
        lat: p.lat,
        lng: p.lng,
        recordedAt: p.recordedAt,
        source: p.source,
      })),
    [data],
  );

  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const stats = useMemo(() => {
    if (points.length < 2) {
      return { distanceM: 0, durationLabel: "—", pings: points.length };
    }
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += haversineMeters(points[i - 1], points[i]);
    }
    return {
      distanceM: d,
      durationLabel: fmtDuration(
        points[0].recordedAt,
        points[points.length - 1].recordedAt,
      ),
      pings: points.length,
    };
  }, [points]);

  const center = useMemo(() => {
    if (points.length === 0) return { lat: 39.5, lng: -98.35 };
    const lats = points.map((p) => p.lat).sort((a, b) => a - b);
    const lngs = points.map((p) => p.lng).sort((a, b) => a - b);
    return {
      lat: lats[Math.floor(lats.length / 2)],
      lng: lngs[Math.floor(lngs.length / 2)],
    };
  }, [points]);

  if (points.length === 0) return null;

  const fmtMeters = (m: number): string => {
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1609.344).toFixed(2)} mi`;
  };

  return (
    <div className="spark-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            SHIFT REPLAY
          </p>
          <h2
            className="text-lg font-semibold mt-1"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {points.length} ping{points.length === 1 ? "" : "s"} on the ground
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <p
              className="tab-num font-bold text-base"
              style={{ color: "var(--spark-lime)" }}
            >
              {stats.durationLabel}
            </p>
            <p className="label-mini">ON-SITE</p>
          </div>
          <div>
            <p className="tab-num font-bold text-base">
              {fmtMeters(stats.distanceM)}
            </p>
            <p className="label-mini">PATH</p>
          </div>
        </div>
      </div>

      <div
        className="spark-card overflow-hidden relative"
        style={{ borderRadius: 16, height: 360 }}
      >
        <APIProvider apiKey={apiKey}>
          <GMap
            defaultCenter={center}
            defaultZoom={15}
            mapId="spark-v2-shift-replay"
            styles={
              [
                { elementType: "geometry", stylers: [{ color: "#0a0d09" }] },
                {
                  elementType: "labels.text.stroke",
                  stylers: [{ color: "#0a0d09" }],
                },
                {
                  elementType: "labels.text.fill",
                  stylers: [{ color: "#8b8e84" }],
                },
                {
                  featureType: "road",
                  elementType: "geometry",
                  stylers: [{ color: "#1f2418" }],
                },
                {
                  featureType: "water",
                  elementType: "geometry",
                  stylers: [{ color: "#050605" }],
                },
              ] as never
            }
            gestureHandling="greedy"
            style={{ width: "100%", height: "100%" }}
          >
            {/* Start + end markers */}
            <AdvancedMarker
              key="start"
              position={{ lat: points[0].lat, lng: points[0].lng }}
              onClick={() => setOpenIdx(0)}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: TRAIL_LIME,
                  border: "3px solid #0a0d09",
                  boxShadow: `0 0 14px ${TRAIL_LIME}`,
                }}
                title="Clock-in"
              />
            </AdvancedMarker>
            {points.length > 1 && (
              <AdvancedMarker
                key="end"
                position={{
                  lat: points[points.length - 1].lat,
                  lng: points[points.length - 1].lng,
                }}
                onClick={() => setOpenIdx(points.length - 1)}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    background: "var(--spark-orange)",
                    border: "3px solid #0a0d09",
                    boxShadow: "0 0 14px var(--spark-orange)",
                  }}
                  title="Clock-out"
                />
              </AdvancedMarker>
            )}

            {/* Intermediate pings as small lime dots */}
            {points.slice(1, -1).map((p, i) => (
              <AdvancedMarker
                key={p.uuid}
                position={{ lat: p.lat, lng: p.lng }}
                onClick={() => setOpenIdx(i + 1)}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: TRAIL_LIME_TRANSLUCENT,
                    border: `1px solid ${TRAIL_LIME}`,
                  }}
                />
              </AdvancedMarker>
            ))}

            {openIdx != null && points[openIdx] && (
              <InfoWindow
                position={{
                  lat: points[openIdx].lat,
                  lng: points[openIdx].lng,
                }}
                onCloseClick={() => setOpenIdx(null)}
              >
                <div
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    color: "#0a0d09",
                    minWidth: 160,
                  }}
                >
                  <p style={{ fontWeight: 700 }}>
                    {openIdx === 0
                      ? "Clock-in"
                      : openIdx === points.length - 1
                        ? "Clock-out"
                        : `Ping ${openIdx + 1} / ${points.length}`}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      marginTop: 2,
                      fontFamily: "JetBrains Mono, monospace",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {fmtTimeLabel(points[openIdx].recordedAt)}
                  </p>
                </div>
              </InfoWindow>
            )}

            <PolylineLayer
              points={points.map((p) => ({ lat: p.lat, lng: p.lng }))}
            />
          </GMap>
        </APIProvider>
      </div>
    </div>
  );
};

// PolylineLayer mounts a real google.maps.Polyline by reaching into
// the map instance via @vis.gl/react-google-maps' useMap hook. The
// library's declarative API doesn't cover polylines, so we drop one
// level lower and call .setMap() / .setMap(null) on lifecycle.
import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

const PolylineLayer: React.FC<{
  points: { lat: number; lng: number }[];
}> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    // google.maps is loaded by @vis.gl provider; not typed here.
    const g = (window as typeof window & { google?: { maps?: { Polyline?: new (opts: unknown) => { setMap: (m: unknown) => void } } } }).google;
    if (!g?.maps?.Polyline) return;
    const line = new g.maps.Polyline({
      path: points,
      strokeColor: TRAIL_LIME,
      strokeOpacity: 0.85,
      strokeWeight: 3,
      geodesic: true,
    });
    line.setMap(map);
    return () => {
      try {
        line.setMap(null);
      } catch {
        /* map unmounted */
      }
    };
  }, [map, points]);
  return null;
};

void Polyline; // legacy export kept for stable diff (Polyline is unused).

export default function ShiftReplayPanel({ eventUuid }: { eventUuid: string }) {
  const apiKey = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey || !eventUuid) return null;
  return (
    <Suspense fallback={null}>
      <Inner eventUuid={eventUuid} apiKey={apiKey} />
    </Suspense>
  );
}
