import { useRef, useState } from "react";

import { apiOrigin, fetchWithTimeout } from "./checkinHelpers";
import { card, errText, helperText, input, label, primaryBtn, secondaryBtn } from "./checkinStyles";
import type { Context } from "./checkinTypes";
import { readDraft, writeDraft } from "./recapDraft";
import {
  buildChangeStoreBody,
  currentPlaceLine,
  farWarningCopy,
  fixLabel,
  hereQuestion,
  moveConfirmCopy,
  moveResultCopy,
  newRequestKey,
  storeNameField,
  storeNameMissing,
  type StoreChangeResult,
  type StoreLookup,
} from "./storeFixRules";
import { isFiniteLatLng } from "./storeProximity";
import { matchingStores, storeNameForPicker, type StoreSuggestion } from "./storeSuggestions";

const STORE_FIX_TIMEOUT_MS = 20_000;

const linkBtn = {
  background: "none",
  border: "none",
  padding: "10px 0",
  minHeight: 44,
  color: "#1c1917",
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "underline",
  cursor: "pointer",
} as const;

type Gps = { lat: number; lng: number; accuracy: number | null };
type Source = "gps" | "search" | "typed";
type Step = "closed" | "locating" | "here" | "search" | "far" | "confirm";

/**
 * "Store: Kroger · 123 Main St · Wrong store? Fix it".
 *
 * Shown once the BA has clocked in and until the recap is filed. The phone's
 * GPS is reverse-geocoded to an address ("You're at … Is this where you're
 * working?"), the store name is prefilled from a store Spark already knows
 * there, and the BA can search the brand's stores or type an address instead.
 * An address far from GPS needs "I'm sure". The API moves the shift in place,
 * so the clock-in time, hours and mileage stay.
 */
export default function StoreFix({
  code,
  token,
  ctx,
  accent,
  onMoved,
}: {
  code: string;
  token: string;
  ctx: Context;
  accent: string;
  /** Reload the context after a move. */
  onMoved: () => Promise<void>;
}) {
  const state = ctx.session?.storeChange;
  const [step, setStep] = useState<Step>("closed");
  const [gps, setGps] = useState<Gps | null>(null);
  const [place, setPlace] = useState<StoreLookup | null>(null);
  const [source, setSource] = useState<Source>("gps");
  const [address, setAddress] = useState("");
  const [storeName, setStoreName] = useState("");
  const [query, setQuery] = useState("");
  const [stores, setStores] = useState<StoreSuggestion[] | null>(null);
  const [farKm, setFarKm] = useState<number | null>(null);
  const [confirmFar, setConfirmFar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const requestKey = useRef<string>("");

  if (!state) return null;
  const addressOnly = Boolean(state.addressOnly);
  const nameField = storeNameField(state);
  const line = currentPlaceLine(state, ctx.event?.address);
  const placeWord = addressOnly ? "location" : state.venue ? "venue" : "store";

  const reset = () => {
    setStep("closed");
    setPlace(null);
    setAddress("");
    setStoreName("");
    setQuery("");
    setFarKm(null);
    setConfirmFar(false);
    setErr(null);
    requestKey.current = "";
  };

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetchWithTimeout(
      `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      STORE_FIX_TIMEOUT_MS,
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && !json.error, status: res.status, json };
  };

  const lookup = async (opts: { fix: Gps | null; typed?: string; includeStores?: boolean }) => {
    const { ok, json } = await post("store-lookup", {
      session: token,
      ...(opts.fix ? { latitude: opts.fix.lat, longitude: opts.fix.lng } : {}),
      ...(opts.typed ? { address: opts.typed } : {}),
      ...(opts.includeStores ? { includeStores: true } : {}),
    });
    if (!ok) throw new Error(String(json.message || "lookup"));
    const result = json as unknown as StoreLookup;
    if (Array.isArray(result.stores)) setStores(result.stores);
    return result;
  };

  const openSearch = async (why: string | null) => {
    setErr(why);
    setStep("search");
    if (stores === null && !addressOnly) {
      try {
        await lookup({ fix: null, includeStores: true });
      } catch {
        setStores([]);
      }
    }
  };

  const start = () => {
    setErr(null);
    setNote(null);
    setStep("locating");
    if (!navigator.geolocation) {
      void openSearch("This phone won't share its location. Search or type the address instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const fix: Gps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        };
        if (!isFiniteLatLng(fix)) {
          setGps(null);
          void openSearch("Couldn't get your location. Search or type the address instead.");
          return;
        }
        setGps(fix);
        try {
          const found = await lookup({ fix, includeStores: !addressOnly });
          if (!found.address) {
            void openSearch("Couldn't name that spot. Search or type the address instead.");
            return;
          }
          setPlace(found);
          setAddress(found.address);
          setStoreName(found.store?.name ?? "");
          setSource("gps");
          setStep("here");
        } catch (e) {
          void openSearch(
            e instanceof Error && e.message !== "lookup"
              ? e.message
              : "Couldn't look that up. Search or type the address instead.",
          );
        }
      },
      () => {
        setGps(null);
        void openSearch("Location is off for this site. Search or type the address instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  /** A picked suggestion or a typed address: geocode it and measure it. */
  const choose = async (opts: { address: string; name: string; source: Source }) => {
    setBusy(true);
    setErr(null);
    try {
      const found = await lookup({ fix: gps, typed: opts.address });
      setPlace(found);
      setAddress(opts.address);
      setStoreName(opts.name || found.store?.name || "");
      setSource(opts.source);
      setStep("here");
    } catch {
      // Can't measure it: still let the BA continue; the server checks again.
      setPlace(null);
      setAddress(opts.address);
      setStoreName(opts.name);
      setSource(opts.source);
      setStep("here");
    } finally {
      setBusy(false);
    }
  };

  const continueFromHere = () => {
    setErr(null);
    if (!address.trim()) return setErr("Enter the address you're working at.");
    if (storeNameMissing(state, storeName)) return setErr("Enter the store name.");
    requestKey.current = newRequestKey();
    setConfirmFar(false);
    if (place?.far && place.distanceKm != null) {
      setFarKm(place.distanceKm);
      setStep("far");
      return;
    }
    setStep("confirm");
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const placePoint =
        place && place.placeLatitude != null && place.placeLongitude != null
          ? { lat: place.placeLatitude, lng: place.placeLongitude }
          : null;
      const { ok, json } = await post(
        "change-store",
        buildChangeStoreBody({
          session: token,
          address,
          storeName,
          addressOnly,
          gps,
          place: placePoint,
          state: place?.state,
          source,
          confirmFar,
          requestKey: requestKey.current || newRequestKey(),
        }),
      );
      if (!ok) {
        if (json.error === "far_from_gps" && typeof json.distanceKm === "number") {
          setFarKm(json.distanceKm);
          setStep("far");
        } else {
          setErr(String(json.message || "Couldn't move your shift. Try again."));
        }
        setBusy(false);
        return;
      }
      const result = (json as { storeChange?: StoreChangeResult }).storeChange;
      // The recap's Store name box (Torch) follows the move.
      const local = readDraft(code, token, "shift");
      if (local?.store && result?.toStore) {
        writeDraft(
          code,
          token,
          { ...local, store: { ...local.store, name: result.toStore } },
          "shift",
        );
      }
      setNote(result ? moveResultCopy(result, addressOnly) : null);
      reset();
      setBusy(false);
      await onMoved();
    } catch {
      setErr("Couldn't move your shift. Check your signal and try again.");
      setBusy(false);
    }
  };

  const hits = matchingStores(stores ?? [], query);

  return (
    <div style={{ ...card, padding: "12px 18px" }} data-testid="store-fix">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 10px" }}>
        <div style={{ fontSize: 14, minWidth: 0, overflowWrap: "anywhere" }}>
          <span style={{ color: "#44403c" }}>{line.label}: </span>
          <strong>{line.value}</strong>
        </div>
        {state.allowed && step === "closed" ? (
          <button type="button" style={linkBtn} onClick={start}>
            {fixLabel(state)}
          </button>
        ) : null}
      </div>
      {!state.allowed ? (
        <p style={{ ...helperText, margin: "4px 0 0" }}>
          {fixLabel(state).replace(" Fix it", "")}{" "}
          {state.message || "Message your lead and they'll fix it."}
        </p>
      ) : null}
      {note && step === "closed" ? (
        <p role="status" style={{ ...helperText, margin: "4px 0 0" }}>
          {note}
        </p>
      ) : null}

      {step === "locating" ? (
        <p role="status" style={{ ...helperText, margin: "8px 0 0" }}>
          Finding where you are…
        </p>
      ) : null}

      {step === "here" ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "4px 0 8px", lineHeight: 1.4 }}>
            {source === "gps" ? hereQuestion(address) : `Use ${address}?`}
          </p>
          {nameField.show ? (
            <div style={{ marginBottom: 10 }}>
              <label style={label} htmlFor="store-fix-name">
                {nameField.label}
              </label>
              <div style={helperText}>
                {place?.store?.name && storeName === place.store.name
                  ? `Spark knows ${place.store.name} here. Change it if that's not right.`
                  : nameField.hint}
              </div>
              <input
                id="store-fix-name"
                style={input}
                value={storeName}
                autoComplete="off"
                placeholder={nameField.placeholder}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              style={{ ...primaryBtn(accent), flex: "none" }}
              disabled={busy}
              onClick={continueFromHere}
            >
              Yes, continue
            </button>
            <button
              type="button"
              style={{ ...secondaryBtn, flex: "none" }}
              disabled={busy}
              onClick={() => void openSearch(null)}
            >
              {addressOnly ? "Type the address instead" : `Search for the ${placeWord} instead`}
            </button>
            <button type="button" style={{ ...linkBtn, alignSelf: "flex-start" }} onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "search" ? (
        <div style={{ marginTop: 8 }}>
          <label style={label} htmlFor="store-fix-search">
            {addressOnly ? "Address" : "Store name or address"}
          </label>
          <input
            id="store-fix-search"
            style={input}
            value={query}
            autoComplete="off"
            placeholder={addressOnly ? "e.g. 123 Main St, Austin, TX" : "e.g. Kroger or 123 Main St"}
            onChange={(e) => setQuery(e.target.value)}
          />
          {hits.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {hits.map((s) => {
                const name = storeNameForPicker(s);
                return (
                  <button
                    key={`${s.name}|${s.address}`}
                    type="button"
                    style={{ ...secondaryBtn, textAlign: "left", flex: "none" }}
                    disabled={busy}
                    onClick={() => void choose({ address: s.address, name, source: "search" })}
                  >
                    {name ? <span style={{ display: "block", fontWeight: 700 }}>{name}</span> : null}
                    <span style={{ ...helperText, display: "block", fontWeight: 400 }}>
                      {s.address}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              style={{ ...primaryBtn(accent), flex: "none" }}
              disabled={busy || query.trim().length < 5}
              onClick={() => void choose({ address: query, name: "", source: "typed" })}
            >
              {busy ? "Checking…" : "Use this address"}
            </button>
            <button type="button" style={{ ...linkBtn, alignSelf: "flex-start" }} onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "far" && farKm != null ? (
        <div style={{ marginTop: 8 }} role="alert">
          <p style={{ fontSize: 15, fontWeight: 700, margin: "4px 0 6px", color: "#9a3412" }}>
            This is far from you
          </p>
          <p style={{ ...helperText, margin: "0 0 10px" }}>{farWarningCopy(farKm, addressOnly)}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              style={{ ...secondaryBtn, flex: "none" }}
              onClick={() => {
                setConfirmFar(true);
                setStep("confirm");
              }}
            >
              I'm sure, this is where I am
            </button>
            <button
              type="button"
              style={{ ...primaryBtn(accent), flex: "none" }}
              onClick={() => void openSearch(null)}
            >
              Pick again
            </button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "4px 0 8px", lineHeight: 1.4 }}>
            {moveConfirmCopy({ storeName, address, addressOnly })}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              style={{ ...primaryBtn(accent), flex: "none" }}
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "Moving…" : "Move my shift"}
            </button>
            <button
              type="button"
              style={{ ...secondaryBtn, flex: "none" }}
              disabled={busy}
              onClick={reset}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {err ? (
        <p role="alert" style={errText}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
