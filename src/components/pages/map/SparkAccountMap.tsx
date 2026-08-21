import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import {
  APIProvider,
  Map as GMap,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { SparkGoogleClusters } from "@/shared/map/SparkGoogleClusters";
import {
  isPlottableLatLng,
  venuePinKey,
} from "@/shared/map/accountMapPins";
import Layout from "@/layout/Layout";
import { AccountMapQuery } from "@/api/queries/AccountMapQuery";
import type { AccountMapQuery as AccountMapQueryType } from "@api/queries/__generated__/AccountMapQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import {
  loadUploadedAccounts,
  type UploadedAccount,
} from "@/lib/accounts";
import AccountUploader from "./AccountUploader";

/**
 * Spark v2 — Account Map (Google Maps).
 *
 * Set VITE_GOOGLE_MAPS_API_KEY in your env to enable. Without a key the
 * map area shows a clear setup card so users aren't staring at a blank
 * grey rectangle.
 */

type Status = "recent" | "scheduled" | "unvisited";

const STATUS_COLOR: Record<Status, string> = {
  recent: "#c5f546",
  scheduled: "#5fb8ef",
  unvisited: "#ef5a2a",
};

type Account = {
  key: string;
  name: string;
  market: string;
  state: string; // 2-letter code, "" if unknown
  status: Status;
  coords: { lat: number; lng: number };
  lastDate: string | null;
  address: string;
};

/** City + ST from a US one-line address when Location FKs are empty. */
function marketFromAddress(address: string | null | undefined): {
  city: string;
  state: string;
} {
  const raw = String(address || "").trim();
  const m = raw.match(/^(.*?),\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\s*$/);
  if (!m) return { city: "", state: "" };
  const state = m[2].toUpperCase();
  const head = m[1].trim();
  const commaCity = head.match(/^(.*),\s*([^,]+)$/);
  if (commaCity) return { city: commaCity[2].trim(), state };
  const afterStreet = head.match(
    /^(?:.*?\b(?:Rd\.|Ave\.|St\.|Hwy\.|Dr\.|Blvd\.|Pkwy\.?|Ln\.|Ct\.|Pl\.|Trail))\s+(.+)$/i,
  );
  if (afterStreet) return { city: afterStreet[1].trim(), state };
  const words = head.split(/\s+/);
  return { city: words.slice(-2).join(" "), state };
}

// Google Maps "Aubergine" / dark-friendly style trimmed for Spark.
// Typed loosely so we don't pull in the @types/google.maps namespace.
type MapStyleRule = {
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string | number>>;
};

const DARK_MAP_STYLE: MapStyleRule[] = [
  { elementType: "geometry", stylers: [{ color: "#0a0d09" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0d09" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b8e84" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d0d2c8" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8b8e84" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#11140e" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1f2418" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8b8e84" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2a3020" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#11140e" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#050605" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3b4030" }],
  },
];

const Inner: React.FC<{ apiKey: string | undefined }> = ({ apiKey }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const { isClient } = useSparkRole();
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  // Single-select retailer filter. "all" = no filter. Values are the
  // exact retailer-name strings we display in the dropdown.
  const [retailerFilter, setRetailerFilter] = useState<string>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedAccount[]>([]);

  useEffect(() => {
    if (tenantId) setUploaded(loadUploadedAccounts(tenantId));
  }, [tenantId]);

  const data = useLazyLoadQuery<AccountMapQueryType>(
    AccountMapQuery,
    { first: 2000, tenantId: tenantId || null },
    { fetchPolicy: "store-or-network" },
  );

  const accounts: Account[] = useMemo(() => {
    const map = new Map<string, Account>();
    const pins = (data?.accountMapPins ?? []).filter(
      (p): p is NonNullable<typeof p> => Boolean(p),
    );
    for (const r of pins) {
      const lat = Number(r.lat);
      const lng = Number(r.lng);
      if (!isPlottableLatLng(lat, lng)) continue;
      const retailerName = r.retailerName || r.name || "—";
      const key = venuePinKey(retailerName, lat, lng);
      const parsed = marketFromAddress(r.address);
      const stateCode = r.stateCode || parsed.state;
      const cityish = r.locationName || parsed.city;
      const market = [cityish, stateCode].filter(Boolean).join(", ");
      const statusSlug = (r.statusSlug ?? "").toLowerCase();
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
          state: stateCode || "",
          status: inferred,
          coords: { lat, lng },
          lastDate: r.date ?? null,
          address: r.address ?? "",
        });
      } else {
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
    // Merge in client-uploaded accounts. Only include those with coords
    // or addresses we can later geocode. They show as "unvisited" by
    // default — admin/client schedules a demo to flip them to scheduled.
    for (const u of uploaded) {
      const lat = Number(u.lat);
      const lng = Number(u.lng);
      const key = `upload:${u.id}`;
      const market = [u.city, u.state].filter(Boolean).join(", ");
      if (isPlottableLatLng(lat, lng)) {
        if (!map.has(key)) {
          map.set(key, {
            key,
            name: u.name,
            market: market || "—",
            state: (u.state || "").toString().toUpperCase().slice(0, 2),
            status: u.status,
            coords: { lat, lng },
            lastDate: null,
            address: u.address ?? "",
          });
        }
      }
    }

    return Array.from(map.values());
  }, [data, uploaded]);

  // Distinct list of states present in the dataset for the dropdown.
  const states = useMemo(
    () =>
      Array.from(
        new Set(accounts.map((a) => a.state).filter(Boolean)),
      ).sort(),
    [accounts],
  );

  // Distinct retailer names with their account counts. Sorted by
  // count descending so the highest-coverage retailers come first
  // in the dropdown — ops usually wants to filter to "show me only
  // 7-Eleven" rather than picking from an alpha-sorted list.
  const retailers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of accounts) {
      const name = (a.name ?? "").trim();
      if (!name || name === "—") continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, n]) => ({ name, count: n }));
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return accounts.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (stateFilter !== "all" && a.state !== stateFilter) return false;
      if (retailerFilter !== "all" && a.name !== retailerFilter) return false;
      if (
        q &&
        !a.name.toLowerCase().includes(q) &&
        !a.market.toLowerCase().includes(q) &&
        !a.address.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [accounts, filter, stateFilter, retailerFilter, search]);

  const counts = useMemo(
    () => ({
      all: accounts.length,
      recent: accounts.filter((a) => a.status === "recent").length,
      scheduled: accounts.filter((a) => a.status === "scheduled").length,
      unvisited: accounts.filter((a) => a.status === "unvisited").length,
    }),
    [accounts],
  );

  const center = useMemo(() => {
    if (filtered.length === 0) return { lat: 39.5, lng: -98.35 };
    const lats = filtered.map((a) => a.coords.lat).sort((a, b) => a - b);
    const lngs = filtered.map((a) => a.coords.lng).sort((a, b) => a - b);
    return {
      lat: lats[Math.floor(lats.length / 2)],
      lng: lngs[Math.floor(lngs.length / 2)],
    };
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
            {isClient ? "YOUR ACCOUNTS · " : "ACCOUNT MAP · "}
            {counts.all} VENUES
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

      {/* Uploader */}
      <AccountUploader onImported={setUploaded} />

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
        {(
          [
            { key: "all" as const, label: "All", chip: "chip chip-muted", n: counts.all },
            { key: "recent" as const, label: "Visited", chip: "chip chip-lime", n: counts.recent },
            { key: "scheduled" as const, label: "Scheduled", chip: "chip chip-sky", n: counts.scheduled },
            { key: "unvisited" as const, label: "Needs visit", chip: "chip chip-orange", n: counts.unvisited },
          ]
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={f.chip}
            style={
              filter === f.key
                ? { outline: "1.5px solid currentColor" }
                : undefined
            }
          >
            {f.key !== "all" && "● "}
            {f.label} · {f.n}
          </button>
        ))}
        <span className="flex-1" />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-xl text-xs"
          style={{
            padding: "0.45rem 0.9rem",
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            maxWidth: 140,
            outline: "none",
          }}
          title="Filter by state"
        >
          <option value="all">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={retailerFilter}
          onChange={(e) => setRetailerFilter(e.target.value)}
          className="rounded-xl text-xs"
          style={{
            padding: "0.45rem 0.9rem",
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            maxWidth: 220,
            outline: "none",
          }}
          title="Filter by retailer name"
        >
          <option value="all">All retailers</option>
          {retailers.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name} · {r.count}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search account or address…"
          className="rounded-xl text-xs"
          style={{
            padding: "0.45rem 0.9rem",
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            maxWidth: 260,
            outline: "none",
          }}
        />
        {(filter !== "all" ||
          stateFilter !== "all" ||
          retailerFilter !== "all" ||
          search) && (
          <button
            onClick={() => {
              setFilter("all");
              setStateFilter("all");
              setRetailerFilter("all");
              setSearch("");
            }}
            className="mono text-[10px] px-3 py-1.5 rounded-xl"
            style={{
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.55)",
              border: "1px solid var(--spark-border)",
              background: "transparent",
            }}
            title="Clear all filters"
          >
            × CLEAR
          </button>
        )}
      </div>

      {/* Map + rail */}
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "1fr 360px" }}
      >
        <div
          className="spark-card overflow-hidden relative"
          style={{ borderRadius: 20, height: 640 }}
        >
          {!apiKey ? (
            <div
              className="absolute inset-0 grid place-items-center px-6"
              style={{
                background:
                  "linear-gradient(180deg, var(--spark-surface), var(--spark-surface-2))",
              }}
            >
              <div className="max-w-md text-center">
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-orange)",
                  }}
                >
                  GOOGLE MAPS NOT CONFIGURED
                </p>
                <h3
                  className="display text-lg font-bold mb-2"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Add your API key to enable the map.
                </h3>
                <p
                  className="text-sm mb-4"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  Set{" "}
                  <span
                    className="mono"
                    style={{ color: "var(--spark-lime)" }}
                  >
                    VITE_GOOGLE_MAPS_API_KEY
                  </span>{" "}
                  in <span className="mono">.env.local</span> and redeploy.
                  Pin data + the rail on the right still work without
                  the map.
                </p>
                <a
                  href="https://console.cloud.google.com/google/maps-apis"
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: "var(--spark-lime)",
                  }}
                >
                  GET A KEY →
                </a>
              </div>
            </div>
          ) : (
            <APIProvider apiKey={apiKey} libraries={["marker"]}>
              <GMap
                defaultCenter={center}
                defaultZoom={4}
                mapId="spark-v2-map"
                styles={DARK_MAP_STYLE as never}
                disableDefaultUI={false}
                gestureHandling="greedy"
                style={{ width: "100%", height: "100%" }}
              >
                <SparkGoogleClusters
                  pins={filtered.map((a) => ({
                    id: a.key,
                    position: a.coords,
                    color: STATUS_COLOR[a.status],
                    title: a.name,
                    onClick: () => setOpenKey(a.key),
                  }))}
                />
                {openKey &&
                  (() => {
                    const a = filtered.find((x) => x.key === openKey);
                    if (!a) return null;
                    const statusLabel =
                      a.status === "recent"
                        ? "Recently visited"
                        : a.status === "scheduled"
                          ? "Scheduled"
                          : "Needs visit";
                    const fmtLast = (() => {
                      if (!a.lastDate) return null;
                      try {
                        return new Date(a.lastDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        );
                      } catch {
                        return a.lastDate.slice(0, 10);
                      }
                    })();
                    return (
                      <InfoWindow
                        position={a.coords}
                        onCloseClick={() => setOpenKey(null)}
                      >
                        <div
                          style={{
                            fontFamily: "Space Grotesk, sans-serif",
                            color: "#0a0d09",
                            minWidth: 240,
                            maxWidth: 280,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                background: STATUS_COLOR[a.status],
                                boxShadow: `0 0 4px ${STATUS_COLOR[a.status]}`,
                              }}
                            />
                            <span
                              style={{
                                fontFamily: "JetBrains Mono, monospace",
                                fontSize: 9,
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                                color: "#3b4034",
                              }}
                            >
                              {statusLabel}
                              {a.state ? ` · ${a.state}` : ""}
                            </span>
                          </div>
                          <p style={{ fontWeight: 700, fontSize: 15 }}>
                            {a.name}
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              marginTop: 2,
                              color: "#3b4034",
                            }}
                          >
                            {a.market}
                          </p>
                          {a.address && (
                            <p
                              style={{
                                fontSize: 11,
                                marginTop: 2,
                                color: "#5a6354",
                                fontStyle: "italic",
                              }}
                            >
                              {a.address}
                            </p>
                          )}
                          {fmtLast && (
                            <p
                              style={{
                                fontSize: 10,
                                fontFamily:
                                  "JetBrains Mono, monospace",
                                letterSpacing: "0.14em",
                                opacity: 0.7,
                                marginTop: 6,
                                textTransform: "uppercase",
                              }}
                            >
                              Last visit · {fmtLast}
                            </p>
                          )}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              marginTop: 12,
                            }}
                          >
                            {/* Primary CTA — biggest target on the
                                popup. Prefills venue + address +
                                state + retailer name into the
                                Express form. */}
                            <button
                              onClick={() => {
                                const params = new URLSearchParams({
                                  venue: a.name,
                                  address: a.address || a.market,
                                });
                                if (a.state) params.set("state", a.state);
                                navigate(
                                  `/requests/create?${params.toString()}`,
                                );
                              }}
                              style={{
                                background: "#c5f546",
                                color: "#0a0d09",
                                border: "none",
                                padding: "10px 14px",
                                borderRadius: 10,
                                fontFamily:
                                  "Space Grotesk, sans-serif",
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: "pointer",
                                boxShadow:
                                  "0 0 18px rgba(197,245,70,0.55)",
                              }}
                            >
                              ✦ Schedule a visit
                            </button>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                              }}
                            >
                              <button
                                onClick={() => {
                                  setRetailerFilter(a.name);
                                  setOpenKey(null);
                                }}
                                style={{
                                  flex: 1,
                                  background: "transparent",
                                  color: "#0a0d09",
                                  border:
                                    "1px solid rgba(10,13,9,0.2)",
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  fontFamily:
                                    "JetBrains Mono, monospace",
                                  fontSize: 10,
                                  letterSpacing: "0.14em",
                                  cursor: "pointer",
                                  textTransform: "uppercase",
                                }}
                                title="Filter the map + list to only this retailer"
                              >
                                Filter to {a.name.length > 14
                                  ? a.name.slice(0, 14) + "…"
                                  : a.name}
                              </button>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${a.coords.lat},${a.coords.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: "transparent",
                                  color: "#0a0d09",
                                  border:
                                    "1px solid rgba(10,13,9,0.2)",
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  fontFamily:
                                    "JetBrains Mono, monospace",
                                  fontSize: 10,
                                  letterSpacing: "0.14em",
                                  textDecoration: "none",
                                  textTransform: "uppercase",
                                  lineHeight: "20px",
                                }}
                              >
                                Open ↗
                              </a>
                            </div>
                          </div>
                        </div>
                      </InfoWindow>
                    );
                  })()}
              </GMap>
            </APIProvider>
          )}
        </div>

        {/* List */}
        <div
          className="spark-card overflow-hidden flex flex-col"
          style={{ maxHeight: 640 }}
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
                className="px-4 py-3 transition"
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Prefill the request form with this account's
                      // venue + address (+ state when known) via
                      // query params. SparkRequestCreate picks
                      // these up on mount via useSearchParams.
                      const params = new URLSearchParams({
                        venue: a.name,
                        address: a.address || a.market,
                      });
                      if (a.state) params.set("state", a.state);
                      navigate(`/requests/create?${params.toString()}`);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 transition"
                    style={{
                      background: "var(--spark-lime)",
                      color: "#0a0d09",
                      border: "none",
                      letterSpacing: "0.14em",
                    }}
                    title="Schedule a visit at this account"
                  >
                    ✦ SCHEDULE
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * Layout-less body of the Account Map. Used by the client dashboard's
 * "Account Map" tab so we don't render the admin shell (sidebar +
 * topbar) inside the dashboard's existing Layout content area.
 *
 * The default export below wraps this in `<Layout>` for the
 * standalone `/account-map` route.
 */
export const AccountMapBody: React.FC = () => {
  const apiKey = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_GOOGLE_MAPS_API_KEY;
  return (
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
      <Inner apiKey={apiKey} />
    </Suspense>
  );
};

export default function SparkAccountMap() {
  return (
    <Layout>
      <AccountMapBody />
    </Layout>
  );
}
