import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Layout from "@/layout/Layout";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Spark v2 — Account Map.
 * Wireframe: spark-demo/index.html lines 2565-2628.
 *
 * Renders accounts (= unique retailers with coordinates) on a Leaflet map,
 * with status-coded dots (recent / scheduled / unvisited) and a sortable
 * side rail. Source data is RequestsQuery — each request has coordinates
 * and a retailer, so we group by retailer.uuid and infer status from the
 * most recent request's status.
 */

type Status = "recent" | "scheduled" | "unvisited";

const STATUS_COLOR: Record<Status, string> = {
  recent: "#c5f546", // lime
  scheduled: "#5fb8ef", // sky
  unvisited: "#ef5a2a", // orange
};

type Account = {
  key: string;
  name: string;
  market: string;
  status: Status;
  coords: [number, number];
  lastDate: string | null;
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");

  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 1000, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const accounts: Account[] = useMemo(() => {
    const map = new Map<string, Account>();
    const requests =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    for (const r of requests) {
      const coords = r.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lat, lng] = [coords[0], coords[1]];
      if (lat === 0 && lng === 0) continue;
      const retailerName = r.retailer?.name ?? r.name ?? "—";
      const key = String(r.retailer?.uuid ?? `${retailerName}_${lat}_${lng}`);
      const stateCode = r.retailer?.location?.state?.code ?? r.state?.code ?? "";
      const cityish = r.retailer?.location?.name ?? r.location?.name ?? "";
      const market = [cityish, stateCode].filter(Boolean).join(", ");
      const statusSlug = (r.status?.slug ?? r.status?.name ?? "")
        .toLowerCase();
      const inferred: Status =
        statusSlug === "done" || statusSlug === "completed"
          ? "recent"
          : statusSlug === "scheduled" || statusSlug === "approved"
            ? "scheduled"
            : "unvisited";
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name: retailerName,
          market: market || "—",
          status: inferred,
          coords: [lat, lng],
          lastDate: r.date ?? null,
        });
      } else {
        // Promote status: recent > scheduled > unvisited
        if (inferred === "recent") existing.status = "recent";
        else if (
          inferred === "scheduled" &&
          existing.status === "unvisited"
        )
          existing.status = "scheduled";
        if (r.date && (!existing.lastDate || r.date > existing.lastDate)) {
          existing.lastDate = r.date;
        }
      }
    }
    return Array.from(map.values());
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return accounts.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.market.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [accounts, filter, search]);

  const counts = useMemo(
    () => ({
      all: accounts.length,
      recent: accounts.filter((a) => a.status === "recent").length,
      scheduled: accounts.filter((a) => a.status === "scheduled").length,
      unvisited: accounts.filter((a) => a.status === "unvisited").length,
    }),
    [accounts],
  );

  // Center the map: median of filtered, fallback to continental US.
  const center: [number, number] = useMemo(() => {
    if (filtered.length === 0) return [39.5, -98.35];
    const lats = filtered.map((a) => a.coords[0]).sort((a, b) => a - b);
    const lngs = filtered.map((a) => a.coords[1]).sort((a, b) => a - b);
    return [lats[Math.floor(lats.length / 2)], lngs[Math.floor(lngs.length / 2)]];
  }, [filtered]);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ACCOUNT MAP · {counts.all} VENUES
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Plan from the map.
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Click any pin to see the account and schedule a demo.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="spark-card p-4">
          <p className="label-mini">ACCOUNTS</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-lime)" }}
          >
            {counts.all || "—"}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">VISITED</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-lime)" }}
          >
            {counts.recent || "—"}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">SCHEDULED</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-sky)" }}
          >
            {counts.scheduled || "—"}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">NEEDS VISIT</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-orange)" }}
          >
            {counts.unvisited || "—"}
          </p>
        </div>
      </div>

      {/* Filter row */}
      <div className="spark-card p-4 flex flex-wrap items-center gap-2">
        <span className="label-mini mr-2">STATUS</span>
        <button
          onClick={() => setFilter("all")}
          className={`chip chip-muted ${filter === "all" ? "ring-2" : ""}`}
          style={
            filter === "all"
              ? { outline: "1.5px solid currentColor" }
              : undefined
          }
        >
          All · {counts.all}
        </button>
        <button
          onClick={() => setFilter("recent")}
          className="chip chip-lime"
          style={
            filter === "recent"
              ? { outline: "1.5px solid currentColor" }
              : undefined
          }
        >
          ● Visited · {counts.recent}
        </button>
        <button
          onClick={() => setFilter("scheduled")}
          className="chip chip-sky"
          style={
            filter === "scheduled"
              ? { outline: "1.5px solid currentColor" }
              : undefined
          }
        >
          ● Scheduled · {counts.scheduled}
        </button>
        <button
          onClick={() => setFilter("unvisited")}
          className="chip chip-orange"
          style={
            filter === "unvisited"
              ? { outline: "1.5px solid currentColor" }
              : undefined
          }
        >
          ● Needs visit · {counts.unvisited}
        </button>
        <span className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="rounded-xl text-xs"
          style={{
            padding: "0.45rem 0.9rem",
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            maxWidth: 200,
            outline: "none",
          }}
        />
      </div>

      {/* Map + rail */}
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "1fr 360px" }}
      >
        <div
          className="spark-card overflow-hidden relative"
          style={{ borderRadius: 20, height: 600 }}
        >
          <MapContainer
            center={center}
            zoom={4}
            style={{ width: "100%", height: "100%", background: "#0a0d09" }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution=""
            />
            {filtered.map((a) => (
              <CircleMarker
                key={a.key}
                center={a.coords}
                radius={7}
                pathOptions={{
                  color: STATUS_COLOR[a.status],
                  fillColor: STATUS_COLOR[a.status],
                  fillOpacity: 0.85,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    <p style={{ fontWeight: 700 }}>{a.name}</p>
                    <p
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        marginTop: 2,
                      }}
                    >
                      {a.market}
                    </p>
                    {a.lastDate && (
                      <p
                        style={{
                          fontSize: 10,
                          fontFamily: "JetBrains Mono, monospace",
                          letterSpacing: "0.14em",
                          opacity: 0.55,
                          marginTop: 4,
                          textTransform: "uppercase",
                        }}
                      >
                        Last · {a.lastDate}
                      </p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Legend */}
          <div
            className="absolute top-4 left-4 z-[400] spark-card p-3"
            style={{
              background: "rgba(10,13,9,0.85)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="spark-dot"
                  style={{ background: STATUS_COLOR.recent, boxShadow: `0 0 6px ${STATUS_COLOR.recent}` }}
                />
                VISITED
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="spark-dot"
                  style={{ background: STATUS_COLOR.scheduled, boxShadow: `0 0 6px ${STATUS_COLOR.scheduled}` }}
                />
                SCHEDULED
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="spark-dot"
                  style={{ background: STATUS_COLOR.unvisited, boxShadow: `0 0 6px ${STATUS_COLOR.unvisited}` }}
                />
                NEEDS VISIT
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div
          className="spark-card overflow-hidden flex flex-col"
          style={{ maxHeight: 600 }}
        >
          <div
            className="p-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <h3 className="font-bold">
              Accounts{" "}
              <span
                className="mono text-xs ml-1"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {filtered.length}
              </span>
            </h3>
          </div>
          <ul className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <li
                className="p-6 text-center text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No accounts match.
              </li>
            )}
            {filtered.slice(0, 200).map((a) => (
              <li
                key={a.key}
                onClick={() => navigate(`/requests/list`)}
                className="px-4 py-3 cursor-pointer transition"
                style={{
                  borderBottom: "1px solid var(--spark-border)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div className="flex items-start gap-2">
                  <span
                    className="spark-dot mt-1.5 shrink-0"
                    style={{
                      background: STATUS_COLOR[a.status],
                      boxShadow: `0 0 6px ${STATUS_COLOR[a.status]}`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{a.name}</p>
                    <p
                      className="mono text-[10px] uppercase truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      {a.market}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default function SparkAccountMap() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading account map…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
