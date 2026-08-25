import { useEffect, useId, useRef, useState } from "react";

/**
 * Spark v2 — Google Places autocomplete input.
 *
 * Lightweight wrapper around `google.maps.places.AutocompleteService` +
 * `PlacesService`. We load the Maps JS SDK once on mount (idempotent —
 * subsequent inputs share the same loaded script) and proxy keystrokes
 * to the suggestion endpoint with a 200ms debounce.
 *
 * On selection we resolve the place to its full formatted address + lat
 * /lng, then look up the IANA timezone via the Google Timezone API so
 * parent forms can auto-fill the time-zone field.
 *
 * Props are intentionally minimal so this works as a drop-in replacement
 * for `<input>` — pass `value`, `onChange`, and `onResolved` and forget
 * the rest.
 */

export type ResolvedPlace = {
  /** Google's `name` field on a Place (e.g. "Whole Foods Market",
   *  "7-Eleven"). Empty for raw addresses with no establishment. */
  placeName?: string;
  /** Canonical retailer / chain name with location suffixes stripped
   *  (e.g. "Whole Foods Market" from "Whole Foods Market – Brentwood
   *  #1234"). Falls back to placeName, then the first comma segment. */
  retailerName?: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  zip?: string;
  /** IANA tz id, e.g. "America/Chicago". Empty if the lookup failed. */
  timezoneId?: string;
};

/**
 * Normalize a Google establishment name to a clean retailer brand.
 *   "Whole Foods Market - Brentwood"  → "Whole Foods Market"
 *   "Target Store T-1234"              → "Target"
 *   "7-Eleven #25448"                  → "7-Eleven"
 *   "Costco Wholesale (La Quinta)"     → "Costco Wholesale"
 */
export const canonicalRetailerName = (raw: string): string => {
  let s = raw.trim();
  // Strip everything after an em/en/hyphen separator
  s = s.split(/\s+[-–—]\s+/)[0];
  // Strip parenthesized location suffixes
  s = s.replace(/\s*\([^)]+\)\s*$/g, "");
  // Strip store-number suffixes ("#1234", "Store 25448", "T-1234")
  s = s.replace(/\s*[#№]\s*\d+.*$/i, "");
  s = s.replace(/\s*\b(store|location|unit)\s+[\w-]+.*$/i, "");
  // Final pass — drop trailing whitespace + punctuation
  return s.replace(/[\s,]+$/, "").trim();
};

/**
 * Loose compare key for typed vs predicted labels. Keeps letters/digits,
 * collapses punctuation (including `&`) to spaces so
 * "Castle Heights Liquors & Wine" ≈ "Castle Heights Liquors Wine".
 * Does NOT mutate the value shown in the input — comparison only.
 */
export const normalizeForMatch = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Should blur auto-resolve the typed string to a Google prediction?
 *
 * The old path always bound preds[0], so "USE AS TYPED" for an unknown
 * independent (e.g. "Castle Heights Liquors & Wine") was overwritten by a
 * fuzzy neighbor ("New Castle Liquors"). Require a close match on the
 * prediction's main label before auto-picking.
 */
export const shouldAutoResolveTyped = (
  typed: string,
  predictionMain: string,
  threshold = 0.7,
): boolean => {
  const a = normalizeForMatch(typed);
  const b = normalizeForMatch(predictionMain);
  if (!a || !b) return false;
  if (a === b) return true;

  // Typed is a prefix of the prediction — common while finishing an
  // address. Require enough typed mass so "Cas" / "New C" do not bind.
  if (b.startsWith(a) && a.length >= 8) return true;
  // Prediction is a short prefix of a longer typed string.
  if (a.startsWith(b) && b.length / a.length >= threshold) return true;

  // Shared starting characters as a fraction of the longer string
  // (matches the documented ">=70% of the same starting chars" gate).
  let shared = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) shared += 1;
    else break;
  }
  return shared / Math.max(a.length, b.length) >= threshold;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onResolved?: (place: ResolvedPlace) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Bias predictions toward Account/Venue names instead of street
   *  addresses. When true we use the "establishment" type. */
  bias?: "address" | "establishment";
};

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              req: { input: string; types?: string[] },
              cb: (
                preds:
                  | Array<{
                      place_id: string;
                      description: string;
                      structured_formatting?: {
                        main_text: string;
                        secondary_text: string;
                      };
                    }>
                  | null,
                status: string,
              ) => void,
            ) => void;
          };
          PlacesService: new (attr: HTMLElement) => {
            getDetails: (
              req: { placeId: string; fields: string[] },
              cb: (
                result:
                  | {
                      name?: string;
                      formatted_address?: string;
                      geometry?: { location?: { lat: () => number; lng: () => number } };
                      address_components?: Array<{
                        long_name: string;
                        short_name: string;
                        types: string[];
                      }>;
                    }
                  | null,
                status: string,
              ) => void,
            ) => void;
          };
          PlacesServiceStatus?: { OK: string };
        };
      };
    };
    __sparkMapsLoading?: Promise<void>;
  }
}

const loadMapsSdk = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__sparkMapsLoading) return window.__sparkMapsLoading;
  const key = (import.meta as { env?: Record<string, string> }).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY missing"));
  window.__sparkMapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps JS SDK"));
    document.head.appendChild(script);
  });
  return window.__sparkMapsLoading;
};

const timezoneForLatLng = async (lat: number, lng: number): Promise<string | null> => {
  const key = (import.meta as { env?: Record<string, string> }).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const ts = Math.floor(Date.now() / 1000);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${ts}&key=${key}`,
    );
    const json = await res.json();
    return typeof json?.timeZoneId === "string" ? json.timeZoneId : null;
  } catch {
    return null;
  }
};

/**
 * Map a Google IANA tz id (e.g. America/Los_Angeles) to a Spark timezone
 * dropdown option. We pick the DST or STD variant based on whether DST is
 * in effect right now at that location, then find the option whose
 * abbreviation (PDT/PST/…) matches.
 *
 * Two callers feed two different option shapes, and we must match BOTH:
 *  - Internal /requests/create + /event forms hold the raw backend rows,
 *    where `code` is the abbreviation ("PST") and `name` is just the
 *    region ("Pacific").
 *  - The public /spark-form holds rows whose `name` has been rewritten to
 *    a display label ("Pacific-PST (UTC-08:00)") and may not carry `code`.
 *
 * So we match against `code` first (exact abbreviation — the reliable
 * signal on the internal forms), then fall back to substring patterns on
 * the display `name` (for the public form's label). Keying off `name`
 * alone silently failed on the internal form — every region name like
 * "Pacific" lacks the "PDT" token — which left the Time Zone field
 * unset and made NV/CA/etc. fall back to the first row (Alaska).
 *
 * Caller passes the dropdown options so we don't hard-code IDs.
 */
export const matchTimezoneOption = <
  T extends { id: string; name: string | null; code?: string | null },
>(
  ianaId: string,
  options: ReadonlyArray<T | null | undefined>,
): T | null => {
  // DST is observed in most of the lower 48 today if we're between
  // ~Mar 2nd Sunday and ~Nov 1st Sunday. Pull from a real Date for
  // the IANA zone to handle Arizona / Hawaii correctly.
  const isDst = (() => {
    try {
      const now = new Date();
      // Compare the current offset vs January's offset for the IANA tz.
      const jan = new Date(now.getFullYear(), 0, 1).toLocaleString("en-US", {
        timeZone: ianaId,
        timeZoneName: "short",
      });
      const jul = new Date(now.getFullYear(), 6, 1).toLocaleString("en-US", {
        timeZone: ianaId,
        timeZoneName: "short",
      });
      const cur = now.toLocaleString("en-US", {
        timeZone: ianaId,
        timeZoneName: "short",
      });
      // If the current tz abbr matches Jul's (DST month) and differs
      // from Jan's, DST is on.
      const curAbbr = cur.split(" ").pop();
      const janAbbr = jan.split(" ").pop();
      const julAbbr = jul.split(" ").pop();
      return curAbbr === julAbbr && julAbbr !== janAbbr;
    } catch {
      return false;
    }
  })();

  // IANA → preferred dropdown name fragment (DST first, STD fallback).
  const map: Record<string, [string, string]> = {
    "America/Los_Angeles": ["PDT", "PST"],
    "America/Tijuana":     ["PDT", "PST"],
    "America/Denver":      ["MDT", "MST"],
    "America/Boise":       ["MDT", "MST"],
    "America/Phoenix":     ["MST", "MST"], // no DST
    "America/Chicago":     ["CDT", "CST"],
    "America/Indiana/Indianapolis": ["EDT", "EST"],
    "America/Detroit":     ["EDT", "EST"],
    "America/New_York":    ["EDT", "EST"],
    "America/Anchorage":   ["AKDT", "AKST"],
    "America/Juneau":      ["AKDT", "AKST"],
    "Pacific/Honolulu":    ["HST", "HST"],
    "America/Adak":        ["HDT", "HST"],
  };
  const target = map[ianaId];
  if (!target) return null;
  const want = (isDst ? target[0] : target[1]).toUpperCase();
  // Prefer an exact match on the abbreviation `code` ("PDT") — the
  // reliable signal on the internal forms whose `name` is just the region.
  const byCode = options.find(
    (o) => o && (o.code ?? "").trim().toUpperCase() === want,
  );
  if (byCode) return byCode as T;
  // Fallback: the public form rewrites `name` into a display label like
  // "Pacific-PDT (UTC-07:00)" and may drop `code`, so match the
  // abbreviation as a token inside the label.
  const byName = options.find((o) => {
    if (!o) return false;
    const upper = (o.name ?? "").toUpperCase();
    return (
      upper.includes(`-${want} `) ||
      upper.includes(`-${want}(`) ||
      upper.includes(` ${want} `) ||
      upper.endsWith(want)
    );
  });
  return (byName as T | undefined) ?? null;
};

export default function GooglePlacesInput({
  value,
  onChange,
  onResolved,
  placeholder,
  className,
  style,
  bias = "address",
}: Props) {
  const [suggestions, setSuggestions] = useState<
    Array<{ place_id: string; main: string; sub: string }>
  >([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const inputId = useId();
  const attrEl = useRef<HTMLDivElement | null>(null);
  // Set when the user explicitly picks "USE … AS TYPED". Blocks blur
  // auto-resolve so a fuzzy Google neighbor cannot overwrite free text
  // (incl. names with `&` / punctuation). Cleared on the next keystroke.
  const freeTextChosenRef = useRef(false);

  useEffect(() => {
    loadMapsSdk()
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!value || value.length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      const svc = new window.google!.maps!.places!.AutocompleteService();
      svc.getPlacePredictions(
        {
          input: value,
          types: bias === "establishment" ? ["establishment"] : ["address"],
        },
        (preds) => {
          const mapped = (preds ?? []).map((p) => ({
            place_id: p.place_id,
            main: p.structured_formatting?.main_text ?? p.description,
            sub: p.structured_formatting?.secondary_text ?? "",
          }));
          // When biased to establishments, collapse multiple branches
          // of the same chain into ONE suggestion keyed by the
          // canonical retailer brand. Kyle wants "national names"
          // (Whole Foods Market, 7-Eleven, Target) — not "Whole Foods
          // Market – South Virginia Street" repeated for every
          // location in the city.
          if (bias === "establishment") {
            const seen = new Map<string, typeof mapped[number]>();
            for (const s of mapped) {
              const canon = canonicalRetailerName(s.main).toLowerCase();
              if (!canon) continue;
              if (!seen.has(canon)) {
                seen.set(canon, {
                  ...s,
                  main: canonicalRetailerName(s.main),
                  sub: "", // hide the street, keep the brand clean
                });
              }
            }
            setSuggestions(Array.from(seen.values()));
          } else {
            setSuggestions(mapped);
          }
        },
      );
    }, 200);
  }, [value, ready, bias]);

  const pick = (placeId: string, label: string) => {
    if (!ready) return;
    if (!attrEl.current) {
      attrEl.current = document.createElement("div");
    }
    const svc = new window.google!.maps!.places!.PlacesService(attrEl.current);
    svc.getDetails(
      {
        placeId,
        fields: ["name", "formatted_address", "geometry", "address_components"],
      },
      async (place) => {
        if (!place) return;
        const fa = place.formatted_address ?? label;
        const placeName = place.name ?? "";
        const retailerName = canonicalRetailerName(
          placeName || fa.split(",")[0] || "",
        );
        const loc = place.geometry?.location;
        const lat = loc?.lat() ?? 0;
        const lng = loc?.lng() ?? 0;
        const comp = (type: string) =>
          place.address_components?.find((c) => c.types.includes(type));
        const city =
          comp("locality")?.long_name ??
          comp("sublocality")?.long_name ??
          comp("postal_town")?.long_name;
        const state = comp("administrative_area_level_1")?.short_name;
        const zip = comp("postal_code")?.long_name;
        const tz = await timezoneForLatLng(lat, lng);
        // Default onChange (no onResolved override) → write the place
        // name when biased to establishments (so the venue field shows
        // "Whole Foods Market"), otherwise write the formatted address.
        // Callers can override via onResolved.
        onChange(bias === "establishment" ? retailerName || fa : fa);
        setOpen(false);
        setSuggestions([]);
        onResolved?.({
          placeName,
          retailerName,
          formattedAddress: fa,
          lat,
          lng,
          city,
          state,
          zip,
          timezoneId: tz ?? undefined,
        });
      },
    );
  };

  // Fallback resolver — fires when the user types an *address* but never
  // taps a suggestion. We geocode via the Maps SDK so onResolved still
  // runs (timezone auto-pick). Venue/establishment fields never
  // auto-resolve: free-text independents must stay exactly as typed.
  const resolveTyped = (raw: string) => {
    if (!ready || !raw || raw.length < 4) return;
    if (freeTextChosenRef.current) return;
    if (bias === "establishment") return;
    if (!attrEl.current) attrEl.current = document.createElement("div");
    const svc = new window.google!.maps!.places!.AutocompleteService();
    svc.getPlacePredictions(
      { input: raw, types: ["address"] },
      (preds) => {
        const best = preds?.[0];
        if (!best) return;
        const main =
          best.structured_formatting?.main_text ?? best.description;
        // Only auto-pick when typed text closely matches the top hit —
        // otherwise free-text / mid-type blur would bind a fuzzy neighbor.
        if (!shouldAutoResolveTyped(raw, main)) return;
        pick(best.place_id, best.description);
      },
    );
  };

  return (
    <div className="relative" style={{ width: "100%" }}>
      <input
        id={inputId}
        value={value}
        onChange={(e) => {
          freeTextChosenRef.current = false;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          // Address fields only: try to resolve so timezone auto-fill
          // works. Skipped after "USE AS TYPED" and for venue names.
          resolveTyped(value);
        }}
        placeholder={placeholder}
        className={className}
        style={style}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || value.trim().length >= 3) && (
        <div
          className="absolute left-0 right-0 z-30 mt-1 rounded-xl overflow-hidden"
          style={{
            background: "var(--spark-surface, #11140e)",
            border: "1px solid var(--spark-border, #1f2418)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {suggestions.map((s) => (
            <button
              type="button"
              key={s.place_id}
              onMouseDown={(e) => {
                e.preventDefault();
                freeTextChosenRef.current = false;
                pick(s.place_id, `${s.main}${s.sub ? ", " + s.sub : ""}`);
              }}
              className="block w-full text-left px-3 py-2.5 transition"
              style={{
                color: "var(--spark-text, #f2f3ee)",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(197,245,70,0.06)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="text-sm font-semibold">{s.main}</div>
              {s.sub && (
                <div
                  className="mono text-[10px] mt-0.5"
                  style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}
                >
                  {s.sub.toUpperCase()}
                </div>
              )}
            </button>
          ))}
          {/* Free-form fallback: persist exactly what the user typed
              (incl. `&` and punctuation). Do not call pick()/onResolved. */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              freeTextChosenRef.current = true;
              // Re-assert the exact typed string so parent state cannot
              // race with a stale Places resolve.
              onChange(value);
              setOpen(false);
              setSuggestions([]);
            }}
            className="block w-full text-left px-3 py-2.5"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              color: "var(--spark-lime, #c5f546)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(197,245,70,0.08)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
            }
          >
            <div
              className="mono text-[10px]"
              style={{ letterSpacing: "0.18em" }}
            >
              + USE “{value}” AS TYPED
            </div>
            <div
              className="text-[11px] mt-0.5"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Don't see your account? We'll save it exactly as you wrote it.
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
