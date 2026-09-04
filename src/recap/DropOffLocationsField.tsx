import {
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import GooglePlacesInput, {
  type ResolvedPlace,
} from "@/components/inputs/GooglePlacesInput";
import {
  emptyDropOffLocation,
  parseDropOffLocations,
  serializeDropOffLocations,
  totalCasesFromDropOffs,
  type DropOffLocation,
  type DropOffProductRef,
  type DropOffSkuLine,
} from "./dropOffLocations";

type Theme = "checkin" | "ops";

type Props = {
  label: ReactNode;
  value: string | null | undefined;
  onChange: (next: string) => void;
  products: readonly DropOffProductRef[];
  required?: boolean;
  theme?: Theme;
  /** Accent for selected pills (check-in brand color / spark lime). */
  accent?: string;
};

const checkinInput: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 15,
  background: "#fff",
  color: "#111827",
  boxSizing: "border-box",
};

const opsInputCls =
  "w-full rounded-lg px-3 py-2 text-sm border bg-transparent outline-none";

function reverseGeocodeLatLng(
  lat: number,
  lng: number,
): Promise<{ address: string; placeName?: string }> {
  const key = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.resolve({
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  }
  return fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`,
  )
    .then((r) => r.json())
    .then((json) => {
      const result = Array.isArray(json?.results) ? json.results[0] : null;
      const address =
        typeof result?.formatted_address === "string"
          ? result.formatted_address
          : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const comp = Array.isArray(result?.address_components)
        ? result.address_components
        : [];
      const establishment = comp.find((c: { types?: string[] }) =>
        (c.types ?? []).includes("establishment"),
      );
      const premise = comp.find((c: { types?: string[] }) =>
        (c.types ?? []).includes("premise"),
      );
      const placeName =
        (establishment?.long_name as string | undefined) ||
        (premise?.long_name as string | undefined);
      return { address, placeName };
    })
    .catch(() => ({
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    }));
}

function productLabel(p: DropOffProductRef): string {
  const cat = (p.category ?? "").trim();
  return cat ? `${cat} — ${p.name}` : p.name;
}

/**
 * Repeatable drop-off blocks: place name + GPS/Places/manual pin + per-SKU
 * cases. Persists as JSON in the Drop-off Locations longtext field.
 */
export function DropOffLocationsField({
  label,
  value,
  onChange,
  products,
  required = false,
  theme = "checkin",
  accent = "#C5F546",
}: Props) {
  const baseId = useId();
  const [locatingIdx, setLocatingIdx] = useState<number | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [skuFilter, setSkuFilter] = useState<Record<number, string>>({});

  const locations = useMemo(() => {
    const parsed = parseDropOffLocations(value);
    return parsed.length > 0 ? parsed : [emptyDropOffLocation()];
  }, [value]);

  const commit = (next: DropOffLocation[]) => {
    onChange(serializeDropOffLocations(next));
  };

  const updateAt = (idx: number, patch: Partial<DropOffLocation>) => {
    commit(
      locations.map((loc, i) => (i === idx ? { ...loc, ...patch } : loc)),
    );
  };

  const setSkuCases = (idx: number, product: DropOffProductRef, casesRaw: string) => {
    const cases = Number(casesRaw);
    const nextCases = Number.isFinite(cases) && cases > 0 ? Math.round(cases) : 0;
    const loc = locations[idx]!;
    const existing = loc.skus.filter((s) => s.productId !== product.id);
    const skus: DropOffSkuLine[] =
      nextCases > 0
        ? [
            ...existing,
            {
              productId: product.id,
              productName: product.name,
              cases: nextCases,
            },
          ]
        : existing;
    updateAt(idx, { skus });
  };

  const toggleSku = (idx: number, product: DropOffProductRef) => {
    const loc = locations[idx]!;
    const on = loc.skus.some((s) => s.productId === product.id && s.cases > 0);
    if (on) {
      updateAt(idx, {
        skus: loc.skus.filter((s) => s.productId !== product.id),
      });
      return;
    }
    updateAt(idx, {
      skus: [
        ...loc.skus.filter((s) => s.productId !== product.id),
        { productId: product.id, productName: product.name, cases: 1 },
      ],
    });
  };

  const pullGps = (idx: number) => {
    setGpsErr(null);
    if (!navigator.geolocation) {
      setGpsErr("This phone won't share its location. Type the address instead.");
      return;
    }
    setLocatingIdx(idx);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const geo = await reverseGeocodeLatLng(lat, lng);
          const loc = locations[idx]!;
          updateAt(idx, {
            lat,
            lng,
            address: geo.address,
            placeName: loc.placeName.trim()
              ? loc.placeName
              : geo.placeName || loc.placeName,
            source: "gps",
          });
        } catch {
          setGpsErr("Couldn't name that spot — type the address instead.");
        } finally {
          setLocatingIdx(null);
        }
      },
      () => {
        setLocatingIdx(null);
        setGpsErr("Location is off for this site. Type the address instead.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const onPlaceResolved = (idx: number, place: ResolvedPlace) => {
    const loc = locations[idx]!;
    updateAt(idx, {
      address: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
      placeName: loc.placeName.trim()
        ? loc.placeName
        : place.placeName || place.retailerName || loc.placeName,
      source: "places",
    });
  };

  const isCheckin = theme === "checkin";
  const totalCases = totalCasesFromDropOffs(locations);
  const searchable = products.length > 24;

  const blockStyle: CSSProperties = isCheckin
    ? {
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: 12,
        padding: 14,
        background: "rgba(0,0,0,0.02)",
      }
    : {
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: 14,
        background: "rgba(255,255,255,0.03)",
      };

  const muted: CSSProperties = {
    fontSize: 12,
    opacity: 0.6,
    margin: "4px 0 0",
  };

  const labelStyle: CSSProperties = isCheckin
    ? { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }
    : { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };

  const secondaryBtn: CSSProperties = isCheckin
    ? {
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.15)",
        background: "transparent",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }
    : {
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.2)",
        background: "transparent",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        color: "inherit",
      };

  return (
    <div className={isCheckin ? undefined : "sm:col-span-2 space-y-3"}>
      <div>
        <label style={labelStyle}>
          {label}
          {required ? <span style={{ color: "#EF5A2A" }}> *</span> : null}
        </label>
        <p style={muted}>
          Add each account you dropped product at — name, pin (GPS or address),
          and cases by SKU. Tap Add more for another stop.
          {totalCases > 0
            ? ` · ${totalCases} case${totalCases === 1 ? "" : "s"} total`
            : null}
        </p>
      </div>

      {gpsErr ? (
        <p style={{ ...muted, color: "#b45309", opacity: 1 }}>{gpsErr}</p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {locations.map((loc, idx) => {
          const filter = (skuFilter[idx] ?? "").trim().toLowerCase();
          const visible = filter
            ? products.filter((p) =>
                productLabel(p).toLowerCase().includes(filter),
              )
            : products;
          const selected = loc.skus.filter((s) => s.cases > 0);
          return (
            <div key={`${baseId}-${idx}`} style={blockStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <strong style={{ fontSize: 14 }}>
                  Drop-off {idx + 1}
                </strong>
                {locations.length > 1 ? (
                  <button
                    type="button"
                    style={{ ...secondaryBtn, color: "#EF5A2A" }}
                    onClick={() =>
                      commit(locations.filter((_, i) => i !== idx))
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <label style={labelStyle}>
                Account / place name{" "}
                <span style={{ color: "#EF5A2A" }}>*</span>
              </label>
              {isCheckin ? (
                <input
                  style={checkinInput}
                  value={loc.placeName}
                  onChange={(e) => updateAt(idx, { placeName: e.target.value })}
                  placeholder="e.g. Whole Foods — Downtown"
                  autoComplete="organization"
                />
              ) : (
                <input
                  className={opsInputCls}
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  value={loc.placeName}
                  onChange={(e) => updateAt(idx, { placeName: e.target.value })}
                  placeholder="e.g. Whole Foods — Downtown"
                  autoComplete="organization"
                />
              )}

              <label style={{ ...labelStyle, marginTop: 12 }}>
                Address / pin <span style={{ color: "#EF5A2A" }}>*</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  style={{
                    ...secondaryBtn,
                    background: locatingIdx === idx ? accent : "transparent",
                    color: locatingIdx === idx ? "#0a0d09" : undefined,
                  }}
                  disabled={locatingIdx === idx}
                  onClick={() => pullGps(idx)}
                >
                  {locatingIdx === idx ? "Locating…" : "Pull GPS"}
                </button>
                {loc.lat != null && loc.lng != null ? (
                  <span style={{ ...muted, alignSelf: "center", opacity: 0.75 }}>
                    {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}
                    {loc.source ? ` · ${loc.source}` : ""}
                  </span>
                ) : null}
              </div>
              <GooglePlacesInput
                value={loc.address ?? ""}
                onChange={(v) =>
                  updateAt(idx, {
                    address: v,
                    source: loc.lat != null ? loc.source : "manual",
                  })
                }
                onResolved={(place) => onPlaceResolved(idx, place)}
                bias="place"
                allowFreeText
                suggestionTheme={isCheckin ? "light" : "dark"}
                placeholder="Search place or type address…"
                style={
                  isCheckin
                    ? checkinInput
                    : {
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "transparent",
                        color: "inherit",
                        fontSize: 14,
                      }
                }
              />

              <label style={{ ...labelStyle, marginTop: 12 }}>
                SKUs + cases <span style={{ color: "#EF5A2A" }}>*</span>
              </label>
              {products.length === 0 ? (
                <p style={muted}>No products in this tenant catalog yet.</p>
              ) : (
                <>
                  {searchable ? (
                    isCheckin ? (
                      <input
                        style={{ ...checkinInput, marginBottom: 8 }}
                        type="search"
                        value={skuFilter[idx] ?? ""}
                        onChange={(e) =>
                          setSkuFilter((s) => ({ ...s, [idx]: e.target.value }))
                        }
                        placeholder="Search SKUs…"
                      />
                    ) : (
                      <input
                        className={opsInputCls}
                        style={{
                          borderColor: "rgba(255,255,255,0.15)",
                          marginBottom: 8,
                        }}
                        type="search"
                        value={skuFilter[idx] ?? ""}
                        onChange={(e) =>
                          setSkuFilter((s) => ({ ...s, [idx]: e.target.value }))
                        }
                        placeholder="Search SKUs…"
                      />
                    )
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    {visible.map((p) => {
                      const on = loc.skus.some(
                        (s) => s.productId === p.id && s.cases > 0,
                      );
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleSku(idx, p)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            fontSize: 13,
                            cursor: "pointer",
                            border: on
                              ? "none"
                              : isCheckin
                                ? "1px solid rgba(0,0,0,0.15)"
                                : "1px solid rgba(255,255,255,0.2)",
                            background: on ? accent : "transparent",
                            color: on ? "#0a0d09" : "inherit",
                          }}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                  {selected.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      {selected.map((sku) => {
                        const product =
                          products.find((p) => p.id === sku.productId) ?? null;
                        return (
                          <div
                            key={sku.productId}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            {product?.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt=""
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 8,
                                  objectFit: "cover",
                                }}
                              />
                            ) : null}
                            <span
                              style={{
                                flex: 1,
                                fontSize: 14,
                                minWidth: 0,
                              }}
                            >
                              {product?.name || sku.productName || sku.productId}
                            </span>
                            {isCheckin ? (
                              <input
                                style={{
                                  ...checkinInput,
                                  width: 88,
                                  margin: 0,
                                }}
                                inputMode="numeric"
                                placeholder="cases"
                                aria-label={`Cases — ${product?.name || sku.productId}`}
                                value={sku.cases ? String(sku.cases) : ""}
                                onChange={(e) =>
                                  setSkuCases(
                                    idx,
                                    product ?? {
                                      id: sku.productId,
                                      name: sku.productName || sku.productId,
                                    },
                                    e.target.value,
                                  )
                                }
                              />
                            ) : (
                              <input
                                className={opsInputCls}
                                style={{
                                  width: 88,
                                  borderColor: "rgba(255,255,255,0.15)",
                                }}
                                inputMode="numeric"
                                placeholder="cases"
                                aria-label={`Cases — ${product?.name || sku.productId}`}
                                value={sku.cases ? String(sku.cases) : ""}
                                onChange={(e) =>
                                  setSkuCases(
                                    idx,
                                    product ?? {
                                      id: sku.productId,
                                      name: sku.productName || sku.productId,
                                    },
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        style={{
          ...secondaryBtn,
          width: "100%",
          marginTop: 4,
          borderStyle: "dashed",
        }}
        onClick={() => commit([...locations, emptyDropOffLocation()])}
      >
        + Add more
      </button>
    </div>
  );
}

/** Read-only list for ops / share when the value is structured JSON. */
export function DropOffLocationsReadout({
  value,
}: {
  value: string | null | undefined;
}) {
  const locs = parseDropOffLocations(value);
  if (locs.length === 0) {
    return <span>—</span>;
  }
  return (
    <div className="space-y-3 text-left">
      {locs.map((loc, i) => {
        const cases = (loc.skus ?? []).reduce(
          (s, row) => s + (Number(row.cases) > 0 ? Math.round(Number(row.cases)) : 0),
          0,
        );
        return (
          <div key={`${loc.placeName}-${i}`} className="space-y-1">
            <p className="font-semibold text-sm">
              {loc.placeName || `Location ${i + 1}`}
              {cases > 0
                ? ` · ${cases} case${cases === 1 ? "" : "s"}`
                : null}
            </p>
            {loc.address ? (
              <p className="text-xs opacity-70">{loc.address}</p>
            ) : loc.lat != null && loc.lng != null ? (
              <p className="text-xs opacity-70">
                {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}
              </p>
            ) : null}
            {(loc.skus ?? []).filter((s) => s.cases > 0).length > 0 ? (
              <ul className="text-xs opacity-80 list-disc pl-4">
                {loc.skus
                  .filter((s) => s.cases > 0)
                  .map((s) => (
                    <li key={s.productId}>
                      {s.productName || s.productId}: {s.cases}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
