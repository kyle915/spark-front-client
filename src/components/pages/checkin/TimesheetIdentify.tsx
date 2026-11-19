import { useEffect, useRef, useState } from "react";
import { apiOrigin, fmtDay, readIdentity, todayISO, writeIdentity } from "./checkinHelpers";
import { timedFetch } from "./timedFetch";
import type { EventTypeOption } from "./checkinTypes";
import { card, errText, h2, helperText, input, label, primaryBtn, secondaryBtn } from "./checkinStyles";
import {
  TIMESHEET_LOCATING,
  TIMESHEET_LOCATION_OFF,
  TIMESHEET_LOCATION_UNNAMED,
  timesheetIdentifyBody,
  timesheetIdentifyError,
} from "./timesheetOnly";

/**
 * Step 1 on a time-sheet-only link: name, mobile phone and location.
 *
 * Location comes from the phone. On open we ask for a GPS fix and turn it into
 * an address through the link's own /where endpoint. Only when the phone
 * won't share its location (or the spot can't be named) does the worker type
 * it. These are event locations, so there is no store name to ask for.
 *
 * The date is today. A worker who lost their session just fills this in again
 * with the same phone: the server puts them back on today's open shift.
 */
export default function TimesheetIdentify({
  code,
  accent,
  storeKey,
  onDone,
  eventTypes = [],
  programPickerTitle = "",
}: {
  code: string;
  accent: string;
  storeKey: string;
  onDone: (token: string) => void;
  eventTypes?: EventTypeOption[];
  programPickerTitle?: string;
}) {
  const saved = readIdentity(code);
  const [firstName, setFirstName] = useState(saved.firstName);
  const [lastName, setLastName] = useState(saved.lastName);
  const [phone, setPhone] = useState(saved.phone);
  const [location, setLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [eventTypeId, setEventTypeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const asked = useRef(false);
  const today = todayISO();
  const needsProgram = eventTypes.length > 1;

  const locate = () => {
    setLocationNote(null);
    if (!navigator.geolocation) {
      setLocationNote(TIMESHEET_LOCATION_OFF);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await timedFetch(
            `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/where`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
            },
          );
          const json = (await res.json()) as { address?: string | null };
          if (json.address) setLocation(String(json.address));
          else setLocationNote(TIMESHEET_LOCATION_UNNAMED);
        } catch {
          setLocationNote(TIMESHEET_LOCATION_UNNAMED);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocationNote(TIMESHEET_LOCATION_OFF);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  // Ask once, as soon as the page opens — the worker is standing where they
  // work, and typing an address one-handed is the thing this saves.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setErr(null);
    const values = { firstName, lastName, phone, location, today, eventTypeId, needsProgram };
    const problem = timesheetIdentifyError(values);
    if (problem) {
      setErr(problem);
      return;
    }
    setBusy(true);
    try {
      const res = await timedFetch(
        `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/identify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(timesheetIdentifyBody(values)),
        },
      );
      const json = (await res.json()) as { sessionToken?: string; message?: string };
      if (!res.ok || !json.sessionToken) {
        setErr(json.message || "Couldn't start your shift. Try again.");
        setBusy(false);
        return;
      }
      try {
        window.localStorage.setItem(storeKey, json.sessionToken);
      } catch {
        /* private mode — the token still lives in memory for this visit */
      }
      writeIdentity(code, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: "",
        lastPlace: location.trim(),
      });
      onDone(json.sessionToken);
    } catch {
      setErr("Couldn't reach Spark. Check your signal and tap again.");
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={h2}>Who's working?</h2>
      <p style={{ ...helperText, margin: "4px 0 14px" }}>
        Your name and mobile number go on the time sheet. Already clocked in today? Use the same
        number to pick up your shift.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...input, flex: "1 1 140px" }}
          placeholder="First name"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          style={{ ...input, flex: "1 1 140px" }}
          placeholder="Last name"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <input
        style={input}
        placeholder="Mobile phone"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <p style={{ fontSize: 12, lineHeight: 1.4, margin: "6px 0 0", color: "#57534e" }}>
        Ignite may text this number about your shift. Msg frequency varies; msg &amp; data rates may
        apply. Reply STOP to opt out, HELP for help. By continuing you agree to the{" "}
        <a href="/terms-of-service#sms" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy-policy" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
          Privacy Policy
        </a>
        .
      </p>

      {needsProgram ? (
        <div style={{ marginTop: 16 }}>
          <label style={label} htmlFor="timesheet-program">
            {programPickerTitle || "What are you working?"}
          </label>
          <select
            id="timesheet-program"
            style={input}
            value={eventTypeId}
            onChange={(e) => setEventTypeId(e.target.value)}
          >
            <option value="">Pick one</option>
            {eventTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label || t.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <label style={label} htmlFor="timesheet-location">
          Location
        </label>
        {locating ? (
          <p style={{ ...helperText, margin: "4px 0 0" }} role="status">
            {TIMESHEET_LOCATING}
          </p>
        ) : null}
        <input
          id="timesheet-location"
          style={input}
          placeholder="Address where you're working"
          autoComplete="street-address"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        {locationNote ? (
          <p style={{ ...helperText, margin: "6px 0 0" }} role="status">
            {locationNote}
          </p>
        ) : !locating && location ? (
          <p style={{ ...helperText, margin: "6px 0 0" }}>
            From your phone's location. Fix it if it's not quite right.
          </p>
        ) : null}
        {!locating ? (
          <button type="button" style={{ ...secondaryBtn, width: "100%", marginTop: 10 }} onClick={locate}>
            Use my location again
          </button>
        ) : null}
      </div>

      <p style={{ ...helperText, margin: "16px 0 0" }}>Date: {fmtDay(today)}</p>

      {err ? (
        <p role="alert" style={errText}>
          {err}
        </p>
      ) : null}
      <button
        type="button"
        style={{ ...primaryBtn(accent), width: "100%", marginTop: 16 }}
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy ? "Starting…" : "Continue"}
      </button>
    </div>
  );
}
