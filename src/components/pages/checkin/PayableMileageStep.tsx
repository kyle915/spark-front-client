import { useMemo, useState, type CSSProperties } from "react";
import GooglePlacesInput, {
  type ResolvedPlace,
} from "@/components/inputs/GooglePlacesInput";
import {
  formatPayableMiles,
  claimForShiftLabel,
  validatePayableMileageDraft,
  type PayableMileageClaim,
  type PayableMileageState,
  type PayableMileageStop,
  type StorageUnit,
} from "./payableMileage";

export type PayableMileageSaveResult = {
  claim: PayableMileageClaim | null;
  error?: string | null;
};

type Props = {
  accent: string;
  payableMileage: PayableMileageState;
  shiftLabel?: string;
  busy: boolean;
  onSave: (body: {
    startedFromStorage: boolean;
    stops: PayableMileageStop[];
    storageMarket?: string;
    shiftLabel?: string;
  }) => Promise<PayableMileageSaveResult>;
  onContinue: (miles?: number) => void;
  onBack: () => void;
};

const card: CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#111827",
  marginBottom: 8,
};

const btnBase: CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 15,
  border: "1px solid transparent",
  cursor: "pointer",
};

/**
 * Pre-recap step: yes/no started at storage + multi-stop Places itinerary.
 * On a successful save we advance straight to the recap (no extra Continue tap).
 */
export default function PayableMileageStep({
  accent,
  payableMileage,
  shiftLabel,
  busy,
  onSave,
  onContinue,
  onBack,
}: Props) {
  // Session may still carry the *first* shift claim. A second-shift filing
  // (shiftLabel set) must start blank so we don't skip or reuse morning miles.
  const existing = claimForShiftLabel(payableMileage.claim, shiftLabel);
  const [started, setStarted] = useState<boolean | null>(
    existing ? existing.startedFromStorage : null,
  );
  const [stops, setStops] = useState<PayableMileageStop[]>(
    () => existing?.stops ?? [],
  );
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [claim, setClaim] = useState<PayableMileageClaim | null>(existing);
  const [saving, setSaving] = useState(false);
  const [pickedMarket, setPickedMarket] = useState<string>(
    () =>
      existing?.storageMarket ||
      payableMileage.matchedStorage?.market ||
      payableMileage.marketHint ||
      "",
  );

  const matched: StorageUnit | null =
    payableMileage.matchedStorage ??
    (payableMileage.storageUnits.length === 1
      ? payableMileage.storageUnits[0]
      : null);

  const storage: StorageUnit | null = useMemo(() => {
    if (matched) return matched;
    const want = pickedMarket.trim().toLowerCase();
    if (!want) return null;
    return (
      payableMileage.storageUnits.find(
        (u) => u.market.trim().toLowerCase() === want,
      ) ?? null
    );
  }, [matched, pickedMarket, payableMileage.storageUnits]);

  const needStoragePick =
    started === true && !matched && payableMileage.storageUnits.length > 1;

  const minStops = started === true ? 1 : started === false ? 2 : 0;
  const stopsReady = started !== null && stops.length >= minStops;
  const draftPending = draft.trim().length >= 3;

  const addResolved = (place: ResolvedPlace) => {
    const stop: PayableMileageStop = {
      name: place.placeName || place.retailerName || "",
      address: place.formattedAddress,
      lat: place.lat,
      lng: place.lng,
    };
    setStops((prev) => [...prev, stop]);
    setDraft("");
    setErr(null);
    setClaim(null);
  };

  const removeStop = (idx: number) => {
    setStops((prev) => prev.filter((_, i) => i !== idx));
    setClaim(null);
  };

  const save = async () => {
    if (draftPending) {
      setErr(
        "Tap a suggestion under the search box to add that stop — typing alone doesn't save it.",
      );
      return;
    }
    if (needStoragePick && !storage) {
      setErr("Pick which storage unit you started from.");
      return;
    }
    const problem = validatePayableMileageDraft({
      startedFromStorage: started,
      stops,
    });
    if (problem || started === null) {
      setErr(problem || "Did you start at the storage unit?");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const result = await onSave({
        startedFromStorage: started,
        stops,
        storageMarket: storage?.market || pickedMarket || payableMileage.marketHint,
        shiftLabel,
      });
      if (!result.claim) {
        setErr(
          result.error ||
            "Couldn't save mileage. Check your signal and try again.",
        );
        return;
      }
      setClaim(result.claim);
      // Pass miles through so RecapForm doesn't race setState and open empty.
      onContinue(result.claim.payableMiles);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "#111827" }}>
        Payable mileage
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "#4b5563", lineHeight: 1.45 }}>
        Feel Free reimburses driving from your market storage unit to the places
        you sampled — or between those places if you didn&apos;t start at storage.
        We&apos;ll put the miles into your recap automatically.
      </p>

      {storage ? (
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#374151" }}>
          <strong>Storage ({storage.market}):</strong> {storage.address}
        </p>
      ) : null}

      <span style={labelStyle}>Did you start at the storage unit?</span>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[true, false].map((val) => {
          const selected = started === val;
          return (
            <button
              key={val ? "yes" : "no"}
              type="button"
              disabled={busy || saving}
              onClick={() => {
                setStarted(val);
                setClaim(null);
                setErr(null);
              }}
              style={{
                ...btnBase,
                background: selected ? accent : "#f9fafb",
                color: selected ? "#fff" : "#111827",
                borderColor: selected ? accent : "#e5e7eb",
              }}
            >
              {val ? "Yes" : "No"}
            </button>
          );
        })}
      </div>

      {needStoragePick ? (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Which storage unit?</span>
          <select
            value={pickedMarket}
            onChange={(e) => {
              setPickedMarket(e.target.value);
              setClaim(null);
              setErr(null);
            }}
            disabled={busy || saving}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              fontSize: 15,
              background: "#fff",
              boxSizing: "border-box",
            }}
          >
            <option value="">Select storage market…</option>
            {payableMileage.storageUnits.map((u) => (
              <option key={u.market} value={u.market}>
                {u.market} — {u.address}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {started !== null ? (
        <>
          <span style={labelStyle}>
            {started
              ? "Sampling locations (in order)"
              : "Sampling locations you drove between (in order)"}
          </span>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6b7280" }}>
            {started
              ? "Add every stop after leaving storage. Miles = storage → these stops."
              : "Storage is not included. Miles = between these stops only."}{" "}
            Search, then tap a suggestion — each stop appears as a card below.
          </p>
          <GooglePlacesInput
            value={draft}
            onChange={(v) => {
              setDraft(v);
              setErr(null);
            }}
            onResolved={addResolved}
            bias="place"
            allowFreeText={false}
            suggestionTheme="light"
            placeholder="Store name or address…"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              fontSize: 15,
              marginBottom: 10,
              boxSizing: "border-box",
            }}
          />
          {draftPending && stops.length === 0 ? (
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#92400e" }}>
              Still typing — tap a suggestion to lock in stop #{stops.length + 1}.
            </p>
          ) : null}
          {stops.length === 0 ? (
            <p
              style={{
                margin: "0 0 14px",
                padding: "10px 12px",
                borderRadius: 10,
                background: "#f9fafb",
                border: "1px dashed #d1d5db",
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              No stops yet
              {started === false
                ? " — add at least two places you drove between."
                : " — add each place you sampled after storage."}
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: "0 0 14px",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {stops.map((s, i) => {
                const title =
                  s.name?.trim() &&
                  s.name.trim().toLowerCase() !== s.address.trim().toLowerCase()
                    ? s.name.trim()
                    : null;
                return (
                  <li
                    key={`${s.lat}-${s.lng}-${i}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: accent,
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {title ? (
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            color: "#111827",
                            lineHeight: 1.3,
                          }}
                        >
                          {title}
                        </div>
                      ) : null}
                      <div
                        style={{
                          fontSize: 13,
                          color: "#374151",
                          lineHeight: 1.4,
                          marginTop: title ? 2 : 0,
                          wordBreak: "break-word",
                        }}
                      >
                        {s.address}
                      </div>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeStop(i)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#b91c1c",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        flexShrink: 0,
                        padding: "2px 0",
                      }}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      {claim ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: 15,
          }}
        >
          <strong>Payable miles: {formatPayableMiles(claim.payableMiles)}</strong>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
            {claim.routeSource === "google_route"
              ? "Google Maps driving route through your stops. "
              : claim.routeSource === "osrm_route"
                ? "Road route through your stops. "
                : ""}
            Opening your recap…
          </div>
        </div>
      ) : null}

      {err ? (
        <p style={{ color: "#b91c1c", fontSize: 14, margin: "0 0 10px" }}>{err}</p>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          style={{ ...btnBase, background: "#fff", borderColor: "#d1d5db", color: "#111827" }}
          onClick={onBack}
          disabled={busy || saving}
        >
          Back
        </button>
        <button
          type="button"
          style={{
            ...btnBase,
            background: accent,
            color: "#fff",
            opacity: !stopsReady || saving || busy ? 0.55 : 1,
          }}
          onClick={() => void save()}
          disabled={busy || saving || !stopsReady}
        >
          {saving
            ? "Saving miles…"
            : claim
              ? "Continue to recap"
              : "Save miles & continue"}
        </button>
      </div>
      {!stopsReady && started !== null ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280" }}>
          {started
            ? "Add at least one sampling stop (tap a suggestion) to continue."
            : "Add at least two stops (tap suggestions) to continue."}
        </p>
      ) : null}
    </div>
  );
}
