import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { SparkGoogleClusters } from "@/shared/map/SparkGoogleClusters";
import Layout from "@/layout/Layout";
import { DashboardSkeleton } from "@/layout/PageSkeletons";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import { RecentLocationPingsQuery } from "@/api/queries/RecentLocationPingsQuery";
import type { RecentLocationPingsQuery as RecentLocationPingsQueryType } from "@api/queries/__generated__/RecentLocationPingsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { SparkBentoTile, SparkStat } from "@/shared/SparkStatBlocks";
import { todayGroundKpis } from "@/shared/sparkStat";
import SparkPageHeader from "@/shared/SparkPageHeader";

/**
 * "Today's events" — list of events happening today with a Google Maps
 * panel showing event pins. BA clock-in/out positions sync from the
 * mobile app's attendance writes (events_attendance) — UI ready,
 * backend pin sync is the next step.
 */

const fmtTime12 = (raw: string | null | undefined): string => {
  if (!raw) return "";
  // raw may be a full venue-local datetime ("2026-05-29T07:00:00") or "HH:MM".
  // Grab the time-of-day so split(":") doesn't read the date as the hour.
  const match = String(raw).match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hh = parseInt(match[1], 10);
  const mm = match[2];
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

type Ping = {
  uuid: string;
  lat: number;
  lng: number;
  baName: string;
  baUuid: string;
  eventName: string;
  eventUuid: string;
  recordedAt: string;
  freshnessMin: number;
};

const minutesSince = (iso: string): number => {
  try {
    const t = new Date(iso).getTime();
    return Math.max(0, Math.round((Date.now() - t) / 60_000));
  } catch {
    return 999;
  }
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
          // Coordinates are stored as [lat, lng] (ArrayField of floats).
          const c = n.coordinates ?? null;
          const coords =
            c && c.length >= 2
              ? { lat: c[0] as number, lng: c[1] as number }
              : null;
          return {
            uuid: String(n.uuid),
            name: n.name ?? "Untitled",
            startTime: fmtTime12(n.startTime),
            endTime: fmtTime12(n.endTime),
            retailer: n.request?.retailer?.name ?? "—",
            state: "",
            address: n.address ?? "",
            coords,
            status: n.status?.name ?? "Scheduled",
          };
        }) ?? []
    );
  }, [data, today]);

  // GPS pings — re-fetches every 60 seconds so the map stays live.
  // Must be useEffect (not useMemo) so the interval cleans up on unmount.
  const [pingTick, setPingTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPingTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const pingData = useLazyLoadQuery<RecentLocationPingsQueryType>(
    RecentLocationPingsQuery,
    // 120 min: walk-up may only ping at clock-in + while the check-in
    // tab stays open; 30 min dropped anyone who clocked early and put
    // the phone away.
    { withinMinutes: 120, tenantId: tenantId || null },
    { fetchPolicy: "network-only", fetchKey: pingTick },
  );
  const pings: Ping[] = useMemo(() => {
    const rows = pingData?.recentLocationPings ?? [];
    return rows.map((p) => ({
      uuid: String(p.uuid),
      lat: p.lat,
      lng: p.lng,
      baName: p.ambassadorName,
      baUuid: String(p.ambassadorUuid),
      eventName: p.eventName,
      eventUuid: String(p.eventUuid),
      recordedAt: p.recordedAt,
      freshnessMin: minutesSince(p.recordedAt),
    }));
  }, [pingData]);
  const [openPing, setOpenPing] = useState<string | null>(null);

  const mappable = shifts.filter((s) => s.coords !== null);
  const center = useMemo(() => {
    // Prefer event coords; fall back to live BA pings so an empty
    // "MAPPED" day still frames the map on people on the ground.
    const pts =
      mappable.length > 0
        ? mappable.map((s) => s.coords!)
        : pings.map((p) => ({ lat: p.lat, lng: p.lng }));
    if (pts.length === 0) return { lat: 39.5, lng: -98.35 };
    const lats = pts.map((p) => p.lat).sort((a, b) => a - b);
    const lngs = pts.map((p) => p.lng).sort((a, b) => a - b);
    return {
      lat: lats[Math.floor(lats.length / 2)],
      lng: lngs[Math.floor(lngs.length / 2)],
    };
  }, [mappable, pings]);

  return (
    <div className="space-y-4">
      <div className="spark-bento" aria-label="Today on the ground">
        {todayGroundKpis({
          events: shifts.length,
          liveBas: pings.length,
          mapped: mappable.length,
        }).map((k) => (
          <SparkBentoTile key={k.label} {...k} />
        ))}
      </div>
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1fr_380px]">
      {/* Map */}
      <div
        className="spark-card overflow-hidden relative order-1 min-h-[280px] h-[420px] lg:h-[640px]"
        style={{ borderRadius: 20 }}
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
          <APIProvider apiKey={apiKey} libraries={["marker"]}>
            <GMap
              defaultCenter={center}
              defaultZoom={
                mappable.length === 1 || pings.length === 1 ? 11 : 4
              }
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
              <SparkGoogleClusters
                pins={mappable.map((s) => ({
                  id: s.uuid,
                  position: s.coords!,
                  color: "#c5f546",
                  title: s.name,
                  onClick: () => setOpenKey(s.uuid),
                }))}
              />

              {/* Live BA GPS pins — orange / sky based on freshness. */}
              {pings.map((p) => {
                const fresh = p.freshnessMin <= 5;
                const stale = p.freshnessMin > 15;
                const color = stale
                  ? "#8b8e84"
                  : fresh
                    ? "var(--spark-orange)"
                    : "var(--spark-sky)";
                return (
                  <AdvancedMarker
                    key={`ping-${p.uuid}`}
                    position={{ lat: p.lat, lng: p.lng }}
                    onClick={() => setOpenPing(p.uuid)}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        background: color,
                        border: "2px solid #0a0d09",
                        boxShadow: stale ? "none" : `0 0 10px ${color}`,
                        position: "relative",
                      }}
                      title={`${p.baName} · ${p.freshnessMin}m ago`}
                    >
                      {fresh && (
                        <span
                          style={{
                            position: "absolute",
                            inset: -6,
                            borderRadius: 14,
                            border: "2px solid var(--spark-orange)",
                            opacity: 0.45,
                            animation: "spark-pulse 1.4s ease-out infinite",
                          }}
                        />
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}

              {openPing &&
                (() => {
                  const p = pings.find((x) => x.uuid === openPing);
                  if (!p) return null;
                  return (
                    <InfoWindow
                      position={{ lat: p.lat, lng: p.lng }}
                      onCloseClick={() => setOpenPing(null)}
                    >
                      <div
                        style={{
                          fontFamily: "Space Grotesk, sans-serif",
                          color: "#0a0d09",
                          minWidth: 180,
                        }}
                      >
                        <p style={{ fontWeight: 700 }}>{p.baName}</p>
                        <p style={{ fontSize: 11, marginTop: 2 }}>
                          {p.eventName}
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
                          {p.freshnessMin === 0
                            ? "JUST NOW"
                            : `${p.freshnessMin} MIN AGO`}
                        </p>
                      </div>
                    </InfoWindow>
                  );
                })()}
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
              color:
                pings.length > 0 ? "var(--spark-orange)" : "var(--spark-lime)",
            }}
          >
            {pings.length > 0
              ? `${pings.length} BA${pings.length === 1 ? "" : "S"} LIVE`
              : "ON THE GROUND"}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            {pings.length > 0
              ? "Orange = pinged in the last 5 min, blue = within 15, gray = stale. Tap a dot for the BA."
              : "No live BAs right now. Pings show automatically once a BA clocks in from the mobile app."}
          </p>
        </div>
      </div>

      {/* Roster rail */}
      <div
        className="spark-card overflow-hidden flex flex-col order-2 min-h-[280px] max-h-[420px] lg:max-h-[640px]"
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
                <SparkStat
                  size="sm"
                  tone="lime"
                  value={s.startTime || "—"}
                  label={s.endTime ? `To ${s.endTime}` : "Start"}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
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
      <div className="space-y-6 max-w-7xl spark-fade-in">
        <SparkPageHeader
          eyebrow="LIVE · TODAY"
          title={isClient ? "Today's activations." : "Today, on the ground."}
          support="Every event happening right now, plus the assigned BAs and their GPS clock-in/out locations."
        />

        <Suspense fallback={<DashboardSkeleton />}>
          <Inner apiKey={apiKey} />
        </Suspense>
      </div>
    </Layout>
  );
}
