import { useState, type CSSProperties } from "react";
import GooglePlacesInput, {
  type ResolvedPlace,
} from "@/components/inputs/GooglePlacesInput";
import {
  formatPayableMiles,
  validatePayableMileageDraft,
  type PayableMileageClaim,
  type PayableMileageState,
  type PayableMileageStop,
  type StorageUnit,
} from "./payableMileage";

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
  }) => Promise<PayableMileageClaim | null>;
  onContinue: () => void;
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
 * Shows computed payable miles for confirmation before the BA files the recap.
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
  const existing = payableMileage.claim;
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

  const storage: StorageUnit | null =
    payableMileage.matchedStorage ??
    (payableMileage.storageUnits.length === 1
      ? payableMileage.storageUnits[0]
      : null);

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
      const saved = await onSave({
        startedFromStorage: started,
        stops,
        storageMarket: storage?.market || payableMileage.marketHint,
        shiftLabel,
      });
      if (!saved) {
        setErr("Couldn't save mileage. Check your signal and try again.");
        return;
      }
      setClaim(saved);
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
      ) : payableMileage.storageUnits.length > 1 ? (
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#92400e" }}>
          Couldn&apos;t match this shift to one storage unit — confirm your market
          with your lead if miles look wrong.
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
              : "Storage is not included. Miles = between these stops only."}
          </p>
          <GooglePlacesInput
            value={draft}
            onChange={setDraft}
            onResolved={addResolved}
            bias="establishment"
            placeholder="Search a place (Whole Foods, park, …)"
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
          {stops.length > 0 ? (
            <ol style={{ margin: "0 0 14px", paddingLeft: 20, fontSize: 14 }}>
              {stops.map((s, i) => (
                <li key={`${s.lat}-${s.lng}-${i}`} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ flex: 1 }}>
                      {s.name ? <strong>{s.name}</strong> : null}
                      {s.name ? <br /> : null}
                      <span style={{ color: "#4b5563" }}>{s.address}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeStop(i)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#b91c1c",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
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
            {claim.startedFromStorage
              ? "Includes storage → your stops"
              : "Between your sampling stops only (no storage)"}
            . This fills the Mileage field on your recap.
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
        {!claim ? (
          <button
            type="button"
            style={{ ...btnBase, background: accent, color: "#fff" }}
            onClick={() => void save()}
            disabled={busy || saving}
          >
            {saving ? "Calculating…" : "Calculate miles"}
          </button>
        ) : (
          <button
            type="button"
            style={{ ...btnBase, background: accent, color: "#fff" }}
            onClick={onContinue}
            disabled={busy}
          >
            Continue to recap
          </button>
        )}
      </div>
      {claim ? (
        <button
          type="button"
          onClick={() => setClaim(null)}
          style={{
            marginTop: 10,
            border: "none",
            background: "transparent",
            color: "#6b7280",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Edit stops
        </button>
      ) : null}
    </div>
  );
}
