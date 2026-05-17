import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import Layout from "@/layout/Layout";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";

/**
 * "Today's events" — list of events happening today with a Google Maps
 * panel showing event pins. BA clock-in/out positions sync from the
 * mobile app's attendance writes (events_attendance) — UI ready,
 * backend pin sync is the next step.
 */

const fmtTime12 = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const [h, m] = raw.split(":");
  const hh = parseInt(h ?? "0", 10);
  const mm = m ?? "00";
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return mm === "00" ? `${h12} ${ampm}` : `${h12}:${mm} ${ampm}`;
};

type Shift = {
  uuid: string;
  name: string;
  startTime: string;
  endTime: string;
  retailer: string;
  state: string;
  address: string;
  coords: { lat: number; lng: number } | null;
  status: string;
};

const Inner: React.FC<{ apiKey: string | undefined }> = ({ apiKey }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const fmtIso = (d: Date) => d.toISOString().slice(0, 10);

  const data = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    {
      first: 200,
      filters: tenantId
        ? {
            tenantId,
            startDate: fmtIso(today),
            endDate: fmtIso(tomorrow),
          }
        : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const shifts: Shift[] = useMemo(() => {
    return (
      data?.events?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.filter((n) => {
          if (!n.date) return false;
          const d = new Date(n.date);
          return d.toDateString() === today.toDateString();
        })
        ?.map((n) => {
          // Coordinates aren't on the EventsQuery node yet — would need
          // a query extension. Map pins fall back to empty for now and
          // populate when we add `coordinates` to the events GraphQL type.
          return {
            uuid: String(n.uuid),
            name: n.name ?? "Untitled",
            startTime: fmtTime12(n.startTime),
            endTime: fmtTime12(n.endTime),
            retailer: n.request?.retailer?.name ?? "—",
            state: "",
            address: n.address ?? "",
            coords: null,
            status: n.status?.name ?? "Scheduled",
          };
        }) ?? []
    );
  }, [data, today]);

  const mappable = shifts.filter((s) => s.coords !== null);
  const center = useMemo(() => {
    if (mappable.length === 0) return { lat: 39.5, lng: -98.35 };
    const lats = mappable.map((s) => s.coords!.lat).sort((a, b) => a - b);
    const lngs = mappable.map((s) => s.coords!.lng).sort((a, b) => a - b);
    return {
      lat: lats[Math.floor(lats.length / 2)],
      lng: lngs[Math.floor(lngs.length / 2)],
    };
  }, [mappable]);

  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: "1fr 380px" }}
    >
      {/* Map */}
      <div
        className="spark-card overflow-hidden relative"
        style={{ borderRadius: 20, height: 640 }}
      >
        {!apiKey ? (
          <div
            className="absolute inset-0 grid place-items-center px-6"
            style={{ background: "var(--spark-surface)" }}
          >
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Map disabled — VITE_GOOGLE_MAPS_API_KEY not set.
            </p>
          </div>
        ) : (
          <APIProvider apiKey={apiKey}>
            <GMap
              defaultCenter={center}
              defaultZoom={mappable.length === 1 ? 11 : 4}
              mapId="spark-v2-today"
              styles={
                [
                  { elementType: "geometry", stylers: [{ color: "#0a0d09" }] },
                  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0d09" }] },
                  { elementType: "labels.text.fill", stylers: [{ color: "#8b8e84" }] },
                  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2418" }] },
                  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050605" }] },
                  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#11140e" }] },
                ] as never
              }
              gestureHandling="greedy"
              style={{ width: "100%", height: "100%" }}
            >
              {mappable.map((s) => (
                <AdvancedMarker
                  key={s.uuid}
                  position={s.coords!}
                  onClick={() => setOpenKey(s.uuid)}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      background: "var(--spark-lime)",
                      border: "2px solid #0a0d09",
                      boxShadow: "0 0 12px var(--spark-lime)",
                    }}
                  />
                </AdvancedMarker>
              ))}
              {openKey &&
                (() => {
                  const s = mappable.find((x) => x.uuid === openKey);
                  if (!s) return null;
                  return (
                    <InfoWindow
                      position={s.coords!}
                      onCloseClick={() => setOpenKey(null)}
                    >
                      <div
                        style={{
                          fontFamily: "Space Grotesk, sans-serif",
                          color: "#0a0d09",
                          minWidth: 180,
                        }}
                      >
                        <p style={{ fontWeight: 700 }}>{s.name}</p>
                        <p style={{ fontSize: 11, marginTop: 2 }}>
                          {s.retailer}
                          {s.state ? ` · ${s.state}` : ""}
                        </p>
                        <p
                          style={{
                            fontSize: 10,
                            fontFamily: "JetBrains Mono, monospace",
                            letterSpacing: "0.14em",
                            opacity: 0.7,
                            marginTop: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          {s.startTime} – {s.endTime}
                        </p>
                      </div>
                    </InfoWindow>
                  );
                })()}
            </GMap>
          </APIProvider>
        )}
        {/* Clock-in/out callout */}
        <div
          className="absolute bottom-4 left-4 z-10 p-3 rounded-xl"
          style={{
            background: "rgba(10,13,9,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--spark-border)",
            maxWidth: 260,
          }}
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            CLOCK-IN/OUT
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            BA GPS pings from the mobile app land here in real time once
            the BA app is wired. Tracked in the rebuild plan.
          </p>
        </div>
      </div>

      {/* Roster rail */}
      <div
        className="spark-card overflow-hidden flex flex-col"
        style={{ maxHeight: 640 }}
      >
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <h3 className="font-bold">
            Today
            <span
              className="mono text-xs ml-2"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {shifts.length} EVENT{shifts.length === 1 ? "" : "S"}
            </span>
          </h3>
        </div>
        <ul className="overflow-y-auto flex-1">
          {shifts.length === 0 && (
            <li
              className="p-6 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              No events on the books today.
            </li>
          )}
          {shifts.map((s) => (
            <li
              key={s.uuid}
              onClick={() => {
                if (s.coords) setOpenKey(s.uuid);
                else navigate(`/event/view/${s.uuid}`);
              }}
              className="px-4 py-3 cursor-pointer transition"
              style={{ borderBottom: "1px solid var(--spark-border)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "rgba(255,255,255,0.02)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div className="flex items-start gap-2">
                <span
                  className="spark-dot mt-1.5"
                  style={{
                    background: s.coords
                      ? "var(--spark-lime)"
                      : "var(--spark-orange)",
                    boxShadow: s.coords
                      ? "0 0 6px var(--spark-lime)"
                      : "0 0 6px var(--spark-orange)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{s.name}</p>
                  <p
                    className="mono text-[10px] uppercase mt-0.5 truncate"
                    style={{
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {s.retailer}
                    {s.state ? ` · ${s.state}` : ""}
                  </p>
                  <p
                    className="mono text-[10px] mt-1"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    {s.startTime} – {s.endTime}
                  </p>
                  {s.address && (
                    <p
                      className="text-xs mt-1 truncate"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                    >
                      {s.address}
                    </p>
                  )}
                  <p
                    className="mono text-[10px] mt-2"
                    style={{
                      letterSpacing: "0.16em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    BA · — · — (assigned from mobile app)
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default function SparkToday() {
  const { isClient } = useSparkRole();
  const apiKey = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_GOOGLE_MAPS_API_KEY;

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            LIVE · TODAY
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            {isClient ? "Today's activations." : "Today, on the ground."}
          </h1>
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Every event happening right now, plus the assigned BAs and
            their GPS clock-in/out locations.
          </p>
        </div>

        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading today's roster…
            </div>
          }
        >
          <Inner apiKey={apiKey} />
        </Suspense>
      </div>
    </Layout>
  );
}
