/**
 * Public clock in / clock out (`/clock/:token`). No login: the token is the link.
 *
 * Workers give name, email, market, and the address they're working at, then
 * Clock in. Each punch sends one GPS fix (or why there isn't one). The phone
 * remembers the open punch so Clock out is a single tap; a phone that lost it
 * clocks out by email. Spark mirrors every punch to the link's Google Sheet.
 */

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useParams } from "react-router";
import { TenantLogo } from "@/layout/TenantLogo";
import {
  captureGps,
  deviceTimezone,
  formatDuration,
  gpsNote,
  loadDevice,
  minutesBetween,
  saveProfile,
  saveSessionToken,
} from "./clockDevice";
import type { ClockProfile, GpsStatus } from "./clockDevice";

const IGNITE_HOME = "https://igniteproductions.co";
const FALLBACK_ACCENT = "#C4D82E";
const ORANGE = "#EF5A2A";

type Brand = {
  name: string;
  primaryColor: string | null;
  image: string | null;
  logoUrl: string | null;
  requestUrlName: string | null;
};

type Session = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  market: string;
  address: string;
  timezone: string;
  clockInAt: string;
  clockInGps: GpsStatus;
  clockOutAt: string | null;
  clockOutGps: GpsStatus | null;
  durationMinutes: number | null;
};

type LinkPayload = {
  label: string;
  active: boolean;
  timezone: string;
  brand: Brand | null;
  session: Session | null;
};

type View =
  | { kind: "loading" }
  | { kind: "missing"; message: string }
  | { kind: "form" }
  | { kind: "in"; session: Session }
  | { kind: "conflict"; session: Session }
  | { kind: "out"; session: Session }
  | { kind: "byEmail" };

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

function inkOn(hex: string): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#0a0d09";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0d09" : "#ffffff";
}

function timeIn(iso: string, timezone: string): string {
  const d = new Date(iso);
  try {
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    });
  } catch {
    return d.toLocaleString();
  }
}

async function postJson(url: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

export default function PublicClock() {
  const { token = "" } = useParams();
  const base = `${apiOrigin()}/api/public/clock/${encodeURIComponent(token)}`;
  const [link, setLink] = useState<LinkPayload | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [profile, setProfile] = useState<ClockProfile>(() => loadDevice(token).profile);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastGps, setLastGps] = useState<GpsStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { sessionToken } = loadDevice(token);
    fetch(base, { headers: sessionToken ? { "X-Clock-Session": sessionToken } : {} })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Partial<LinkPayload> & { message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setView({ kind: "missing", message: data.message || "This clock link isn't working right now." });
          return;
        }
        const payload = data as LinkPayload;
        setLink(payload);
        if (!payload.active) {
          setView({ kind: "missing", message: "This clock link is turned off. Check with your manager for the current one." });
          return;
        }
        if (payload.session && !payload.session.clockOutAt) {
          setView({ kind: "in", session: payload.session });
        } else {
          if (sessionToken) saveSessionToken(token, null);
          setView({ kind: "form" });
        }
      })
      .catch(() => {
        if (!cancelled) setView({ kind: "missing", message: "Couldn't reach Spark. Check your signal and reload." });
      });
    return () => {
      cancelled = true;
    };
  }, [base, token]);

  const accent = link?.brand?.primaryColor || FALLBACK_ACCENT;

  const clockIn = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      saveProfile(token, profile);
      setBusy("Getting your location…");
      const reading = await captureGps();
      setBusy("Clocking you in…");
      try {
        const { status, data } = await postJson(`${base}/in`, {
          ...profile,
          ...reading,
          timezone: deviceTimezone(),
        });
        if (status === 201) {
          saveSessionToken(token, String(data.sessionToken));
          setLastGps(reading.gpsStatus);
          setView({ kind: "in", session: data.session as Session });
        } else if (status === 409 && data.openSession) {
          setView({ kind: "conflict", session: data.openSession as Session });
        } else {
          setError(String(data.message || "Couldn't clock you in. Try again."));
        }
      } catch {
        setError("Couldn't reach Spark. Check your signal and try again.");
      } finally {
        setBusy(null);
      }
    },
    [base, profile, token],
  );

  const clockOut = useCallback(
    async (opts: { email?: string }) => {
      setError(null);
      setBusy("Getting your location…");
      const reading = await captureGps();
      setBusy("Clocking you out…");
      const { sessionToken } = loadDevice(token);
      const body = opts.email ? { email: opts.email, ...reading } : { sessionToken, ...reading };
      try {
        const { status, data } = await postJson(`${base}/out`, body);
        if (status === 200 || (status === 409 && data.session)) {
          saveSessionToken(token, null);
          setLastGps(status === 200 ? reading.gpsStatus : null);
          setView({ kind: "out", session: data.session as Session });
        } else if (data.error === "no_session") {
          setView({ kind: "byEmail" });
          setError(String(data.message));
        } else {
          setError(String(data.message || "Couldn't clock you out. Try again."));
        }
      } catch {
        setError("Couldn't reach Spark. Check your signal and try again.");
      } finally {
        setBusy(null);
      }
    },
    [base, token],
  );

  return (
    <Shell brand={link?.brand ?? null} label={link?.label}>
      {view.kind === "loading" ? <p style={muted}>Loading…</p> : null}
      {view.kind === "missing" ? (
        <div style={card}>
          <h1 style={h1}>Link unavailable</h1>
          <p style={{ ...muted, marginTop: 8 }}>{view.message}</p>
        </div>
      ) : null}
      {view.kind === "form" ? (
        <ClockInForm
          profile={profile}
          setProfile={setProfile}
          accent={accent}
          busy={busy}
          error={error}
          onSubmit={clockIn}
          onLostPhone={() => {
            setError(null);
            setView({ kind: "byEmail" });
          }}
        />
      ) : null}
      {view.kind === "in" ? (
        <ClockedIn
          session={view.session}
          accent={accent}
          busy={busy}
          error={error}
          gps={lastGps ?? view.session.clockInGps}
          onClockOut={() => void clockOut({})}
        />
      ) : null}
      {view.kind === "conflict" ? (
        <div style={card}>
          <h1 style={h1}>You're already clocked in</h1>
          <p style={{ ...muted, marginTop: 8 }}>
            {view.session.firstName}, you clocked in {timeIn(view.session.clockInAt, view.session.timezone)} at{" "}
            {view.session.address}. Clock out of that shift before starting a new one.
          </p>
          <PrimaryButton accent={accent} busy={busy} onClick={() => void clockOut({ email: view.session.email })}>
            Clock out now
          </PrimaryButton>
          <ErrorText error={error} />
          <button type="button" style={linkBtn} onClick={() => setView({ kind: "form" })}>
            Back
          </button>
        </div>
      ) : null}
      {view.kind === "byEmail" ? (
        <ClockOutByEmail
          initialEmail={profile.email}
          accent={accent}
          busy={busy}
          error={error}
          onSubmit={(email) => void clockOut({ email })}
          onBack={() => {
            setError(null);
            setView({ kind: "form" });
          }}
        />
      ) : null}
      {view.kind === "out" ? (
        <div style={card}>
          <p style={kicker}>CLOCKED OUT</p>
          <h1 style={h1}>
            Thanks, {view.session.firstName}. {formatDuration(view.session.durationMinutes ?? 0)} logged.
          </h1>
          <dl style={facts}>
            <Fact label="In">{timeIn(view.session.clockInAt, view.session.timezone)}</Fact>
            {view.session.clockOutAt ? (
              <Fact label="Out">{timeIn(view.session.clockOutAt, view.session.timezone)}</Fact>
            ) : null}
            <Fact label="Where">{view.session.address}</Fact>
          </dl>
          <GpsNotice status={lastGps} />
          <PrimaryButton
            accent={accent}
            busy={null}
            onClick={() => {
              setLastGps(null);
              setView({ kind: "form" });
            }}
          >
            Clock in for another shift
          </PrimaryButton>
        </div>
      ) : null}
    </Shell>
  );
}

function ClockInForm({
  profile,
  setProfile,
  accent,
  busy,
  error,
  onSubmit,
  onLostPhone,
}: {
  profile: ClockProfile;
  setProfile: (p: ClockProfile) => void;
  accent: string;
  busy: string | null;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
  onLostPhone: () => void;
}) {
  const field = (key: keyof ClockProfile) => ({
    value: profile[key],
    onChange: (e: { target: { value: string } }) => setProfile({ ...profile, [key]: e.target.value }),
    required: true,
    style: input,
    disabled: Boolean(busy),
  });
  return (
    <form style={card} onSubmit={onSubmit}>
      <h1 style={h1}>Clock in</h1>
      <p style={{ ...muted, marginTop: 6 }}>Fill this in once — your phone remembers it for next time.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <label style={labelStyle}>
          First name
          <input {...field("firstName")} autoComplete="given-name" maxLength={80} />
        </label>
        <label style={labelStyle}>
          Last name
          <input {...field("lastName")} autoComplete="family-name" maxLength={80} />
        </label>
      </div>
      <label style={{ ...labelStyle, marginTop: 12 }}>
        Email
        <input {...field("email")} type="email" inputMode="email" autoComplete="email" maxLength={254} />
      </label>
      <label style={{ ...labelStyle, marginTop: 12 }}>
        Market
        <input {...field("market")} placeholder="e.g. Phoenix" maxLength={120} />
      </label>
      <label style={{ ...labelStyle, marginTop: 12 }}>
        Address you're working at
        <input {...field("address")} autoComplete="street-address" placeholder="Store or venue address" maxLength={300} />
      </label>
      <p style={{ ...hint, marginTop: 14 }}>
        When you tap Clock in, your phone will ask to share your location. Spark saves it once when you clock in and
        once when you clock out — never in between. If you say no, you can still clock in.
      </p>
      <PrimaryButton accent={accent} busy={busy} type="submit">
        Clock in
      </PrimaryButton>
      <ErrorText error={error} />
      <button type="button" style={linkBtn} onClick={onLostPhone} disabled={Boolean(busy)}>
        Already clocked in on another phone? Clock out with your email
      </button>
    </form>
  );
}

function ClockedIn({
  session,
  accent,
  busy,
  error,
  gps,
  onClockOut,
}: {
  session: Session;
  accent: string;
  busy: string | null;
  error: string | null;
  gps: GpsStatus | null;
  onClockOut: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div style={card}>
      <p style={{ ...kicker, color: "#3f6212" }}>● ON THE CLOCK</p>
      <h1 style={h1}>
        {session.firstName}, you're clocked in · {formatDuration(minutesBetween(session.clockInAt, now))}
      </h1>
      <dl style={facts}>
        <Fact label="Since">{timeIn(session.clockInAt, session.timezone)}</Fact>
        <Fact label="Where">{session.address}</Fact>
        <Fact label="Market">{session.market}</Fact>
      </dl>
      <GpsNotice status={gps} />
      <p style={{ ...hint, marginTop: 14 }}>Keep this page handy. Tap Clock out when your shift ends.</p>
      <PrimaryButton accent={accent} busy={busy} onClick={onClockOut}>
        Clock out
      </PrimaryButton>
      <ErrorText error={error} />
    </div>
  );
}

function ClockOutByEmail({
  initialEmail,
  accent,
  busy,
  error,
  onSubmit,
  onBack,
}: {
  initialEmail: string;
  accent: string;
  busy: string | null;
  error: string | null;
  onSubmit: (email: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email.trim());
      }}
    >
      <h1 style={h1}>Clock out with your email</h1>
      <p style={{ ...muted, marginTop: 6 }}>Use the email you clocked in with.</p>
      <label style={{ ...labelStyle, marginTop: 12 }}>
        Email
        <input
          style={input}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          disabled={Boolean(busy)}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <PrimaryButton accent={accent} busy={busy} type="submit">
        Clock out
      </PrimaryButton>
      <ErrorText error={error} />
      <button type="button" style={linkBtn} onClick={onBack} disabled={Boolean(busy)}>
        Back to clock in
      </button>
    </form>
  );
}

function GpsNotice({ status }: { status: GpsStatus | null }) {
  const note = gpsNote(status);
  if (!note) return null;
  return (
    <p
      role="status"
      style={{
        marginTop: 14,
        fontSize: 13,
        lineHeight: 1.45,
        background: "rgba(239,90,42,0.08)",
        border: "1px solid rgba(239,90,42,0.3)",
        color: "#9a3412",
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      {note}
    </p>
  );
}

function PrimaryButton({
  accent,
  busy,
  onClick,
  type = "button",
  children,
}: {
  accent: string;
  busy: string | null;
  onClick?: () => void;
  type?: "button" | "submit";
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={Boolean(busy)}
      style={{
        marginTop: 16,
        width: "100%",
        padding: "15px 16px",
        borderRadius: 14,
        border: "none",
        fontSize: 16,
        fontWeight: 700,
        background: accent,
        color: inkOn(accent),
        opacity: busy ? 0.65 : 1,
        cursor: busy ? "wait" : "pointer",
      }}
    >
      {busy || children}
    </button>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" style={{ color: ORANGE, fontSize: 13, marginTop: 10, marginBottom: 0 }}>
      {error}
    </p>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.4 }}>
      <dt style={{ minWidth: 56, color: "#78716c" }}>{label}</dt>
      <dd style={{ margin: 0, color: "#1c1917" }}>{children}</dd>
    </div>
  );
}

function Shell({ brand, label, children }: { brand: Brand | null; label?: string; children: ReactNode }) {
  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
          <a href={IGNITE_HOME} style={{ display: "inline-flex", alignItems: "center" }}>
            <img src="/legal/spark-logo.png" alt="Spark by Ignite" style={{ height: 26, width: "auto" }} />
          </a>
          {brand ? (
            <TenantLogo
              variant="header"
              tone="light"
              name={brand.name}
              requestUrlName={brand.requestUrlName}
              image={brand.image}
              logoUrl={brand.logoUrl}
            />
          ) : null}
        </header>
        {label ? <p style={{ ...kicker, marginBottom: 10 }}>{label.toUpperCase()}</p> : null}
        {children}
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  minHeight: "100dvh",
  background: "#faf7f1",
  color: "#1c1917",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "36px 18px 56px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const card: CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 18,
  padding: 18,
};
const h1: CSSProperties = { fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.25 };
const muted: CSSProperties = { fontSize: 14, color: "#57534e", margin: 0, lineHeight: 1.45 };
const hint: CSSProperties = { fontSize: 12.5, color: "#78716c", margin: 0, lineHeight: 1.45 };
const kicker: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  color: "#78716c",
  margin: "0 0 6px",
};
const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#44403c" };
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  fontSize: 16,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff",
  color: "#14181a",
  marginTop: 6,
  outline: "none",
  fontWeight: 400,
};
const facts: CSSProperties = { display: "grid", gap: 6, margin: "14px 0 0" };
const linkBtn: CSSProperties = {
  display: "block",
  margin: "14px auto 0",
  background: "transparent",
  border: "none",
  color: "#57534e",
  fontSize: 13,
  textDecoration: "underline",
  cursor: "pointer",
};
