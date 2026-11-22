/**
 * Public clock in / clock out (`/clock/:token`). No login: the token is the link.
 *
 * Workers give name, email, market, and the address they're working at, then
 * Clock in. Each punch sends one GPS fix (or why there isn't one). The phone
 * remembers the open punch so Clock out is a single tap; a phone that lost it
 * clocks out by email. Spark mirrors every punch to the link's Google Sheet.
 *
 * Dead-zone warehouse support: when a punch fails on connectivity or gateway
 * timeout, `offlinePunchQueue` holds the punch locally on-device with its
 * exact tap timestamp (`clientClockedInAt` / `clientClockedOutAt`) and
 * flushes automatically on reconnect.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useParams } from "react-router";
import { TenantLogo } from "@/layout/TenantLogo.tsx";
import {
  CLOCK_FETCH_TIMEOUT_MS,
  clearPendingPublicClockIn,
  clearPendingPublicClockOut,
  clearPublicClockLostPunch,
  clockRetryDelayMs,
  enqueuePublicClockIn,
  enqueuePublicClockOut,
  flushPendingPublicClockIn,
  flushPendingPublicClockOut,
  formatSavedClockTime,
  isOfflineClockFailure,
  newIdempotencyKey,
  offlineClockBanner,
  offlineClockOutBanner,
  provisionalClosedSession,
  provisionalSessionFromQueuedIn,
  readCachedPublicClockLink,
  readPendingPublicClockIn,
  readPendingPublicClockOut,
  readPublicClockLostPunch,
  restoreSessionAfterRejectedClockOut,
  timedFetchJson,
  writeCachedPublicClockLink,
  type LostPunch,
  type PendingPublicClockIn,
  type PendingPublicClockOut,
} from "@/shared/offlinePunchQueue";
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

export type Brand = {
  name: string;
  primaryColor: string | null;
  image: string | null;
  logoUrl: string | null;
  requestUrlName: string | null;
};

export type Session = {
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

export type LinkPayload = {
  label: string;
  active: boolean;
  timezone: string;
  brand: Brand | null;
  session: Session | null;
};

export type View =
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

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return timedFetchJson<Record<string, unknown>>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    CLOCK_FETCH_TIMEOUT_MS,
  );
}

function restoreOfflineView(
  token: string,
  cached: LinkPayload | null,
): { link: LinkPayload | null; view: View } | null {
  const pendingIn = readPendingPublicClockIn(token);
  const pendingOut = readPendingPublicClockOut(token);
  if (!cached && !pendingIn) return null;
  const fallbackTz = cached?.timezone || deviceTimezone() || "America/New_York";
  if (pendingIn) {
    const open = provisionalSessionFromQueuedIn(pendingIn, fallbackTz);
    if (pendingOut) {
      return {
        link: cached,
        view: { kind: "out", session: provisionalClosedSession(open, pendingOut) },
      };
    }
    return { link: cached, view: { kind: "in", session: open } };
  }
  if (cached?.session && !cached.session.clockOutAt) {
    if (pendingOut) {
      return {
        link: cached,
        view: { kind: "out", session: provisionalClosedSession(cached.session, pendingOut) },
      };
    }
    return { link: cached, view: { kind: "in", session: cached.session } };
  }
  if (cached) {
    return { link: cached, view: { kind: "form" } };
  }
  return null;
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
  const [queuedIn, setQueuedIn] = useState<PendingPublicClockIn | null>(() =>
    readPendingPublicClockIn(token),
  );
  const [queuedOut, setQueuedOut] = useState<PendingPublicClockOut | null>(() =>
    readPendingPublicClockOut(token),
  );
  const [lostPunch, setLostPunch] = useState<LostPunch | null>(() =>
    readPublicClockLostPunch(token),
  );
  const [flushingNow, setFlushingNow] = useState(false);
  // Bumped whenever a punch or queue flush updates session state so a slower
  // initial GET never clobbers a newly minted sessionToken or active view.
  const sessionEpochRef = useRef(0);

  useEffect(() => {
    setQueuedIn(readPendingPublicClockIn(token));
    setQueuedOut(readPendingPublicClockOut(token));
    setLostPunch(readPublicClockLostPunch(token));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = sessionEpochRef.current;
    const { sessionToken } = loadDevice(token);
    timedFetchJson<Partial<LinkPayload> & { message?: string }>(
      base,
      { headers: sessionToken ? { "X-Clock-Session": sessionToken } : {} },
      CLOCK_FETCH_TIMEOUT_MS,
    )
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        const staleForSession = sessionEpochRef.current !== epochAtStart;
        if (!ok) {
          if (staleForSession) return;
          if (isOfflineClockFailure({ status })) {
            const restored = restoreOfflineView(
              token,
              readCachedPublicClockLink<LinkPayload>(token),
            );
            if (restored) {
              setLink(restored.link);
              setView(restored.view);
              return;
            }
          }
          setView({
            kind: "missing",
            message: data.message || "This clock link isn't working right now.",
          });
          return;
        }
        const payload = data as LinkPayload;
        if (staleForSession) {
          // A concurrent queue flush or manual punch already established the
          // fresher session state — update brand/link chrome only.
          setLink((prev) => {
            const merged = { ...payload, session: prev?.session ?? payload.session };
            writeCachedPublicClockLink(token, merged);
            return merged;
          });
          if (!payload.active) {
            setView({
              kind: "missing",
              message:
                "This clock link is turned off. Check with your manager for the current one.",
            });
          }
          return;
        }
        setLink(payload);
        writeCachedPublicClockLink(token, payload);
        if (!payload.active) {
          setView({
            kind: "missing",
            message:
              "This clock link is turned off. Check with your manager for the current one.",
          });
          return;
        }
        const pendingIn = readPendingPublicClockIn(token);
        const pendingOut = readPendingPublicClockOut(token);
        if (payload.session && !payload.session.clockOutAt) {
          if (pendingOut) {
            setView({
              kind: "out",
              session: provisionalClosedSession(payload.session, pendingOut),
            });
          } else {
            setView({ kind: "in", session: payload.session });
          }
        } else if (pendingIn) {
          const open = provisionalSessionFromQueuedIn(pendingIn, payload.timezone);
          setView(
            pendingOut
              ? { kind: "out", session: provisionalClosedSession(open, pendingOut) }
              : { kind: "in", session: open },
          );
        } else {
          if (sessionToken && !pendingOut) saveSessionToken(token, null);
          setView({ kind: "form" });
        }
      })
      .catch(() => {
        if (cancelled || sessionEpochRef.current !== epochAtStart) return;
        const restored = restoreOfflineView(
          token,
          readCachedPublicClockLink<LinkPayload>(token),
        );
        if (restored) {
          setLink(restored.link);
          setView(restored.view);
          return;
        }
        setView({
          kind: "missing",
          message: "Couldn't reach Spark. Check your signal and reload.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [base, token]);

  const flushQueues = useCallback(async () => {
    if (!token) return;
    let mintedToken = loadDevice(token).sessionToken;

    if (readPendingPublicClockIn(token)) {
      const inResult = await flushPendingPublicClockIn({
        token,
        postIn: async (body) => {
          const { ok, status, data } = await postJson(`${base}/in`, body);
          return {
            ok,
            status,
            sessionToken:
              typeof data.sessionToken === "string" ? data.sessionToken : null,
            session: (data.session as Session | undefined) ?? null,
            openSession: (data.openSession as Session | undefined) ?? null,
            alreadyIn: Boolean(data.alreadyIn),
          };
        },
        onSession: ({ sessionToken, session, conflictSession }) => {
          sessionEpochRef.current += 1;
          if (sessionToken) {
            mintedToken = sessionToken;
            saveSessionToken(token, sessionToken);
          }
          if (session) {
            setLink((prev) => {
              if (!prev) return prev;
              const updated = { ...prev, session };
              writeCachedPublicClockLink(token, updated);
              return updated;
            });
            if (!readPendingPublicClockOut(token)) {
              setView({ kind: "in", session });
            }
          } else if (conflictSession) {
            setView({ kind: "conflict", session: conflictSession });
          }
        },
      });
      setQueuedIn(readPendingPublicClockIn(token));
      setLostPunch(readPublicClockLostPunch(token));
      if (inResult === "rejected") {
        sessionEpochRef.current += 1;
        setView((prev) =>
          prev.kind === "in" && prev.session.id.startsWith("queued-")
            ? { kind: "form" }
            : prev,
        );
        return;
      }
      if (inResult === "retry") return;
    }

    if (readPendingPublicClockOut(token)) {
      const outResult = await flushPendingPublicClockOut({
        token,
        latestSessionToken: mintedToken,
        postOut: async (body) => {
          const { ok, status, data } = await postJson(`${base}/out`, body);
          return {
            ok,
            status,
            session: (data.session as Session | undefined) ?? null,
            alreadyOut: Boolean(data.alreadyOut),
          };
        },
        onClosed: (closedSession) => {
          sessionEpochRef.current += 1;
          saveSessionToken(token, null);
          setLink((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, session: null };
            writeCachedPublicClockLink(token, updated);
            return updated;
          });
          if (closedSession) {
            setView({ kind: "out", session: closedSession });
          }
        },
      });
      setQueuedOut(readPendingPublicClockOut(token));
      setLostPunch(readPublicClockLostPunch(token));
      if (outResult === "rejected") {
        sessionEpochRef.current += 1;
        const hasDeviceToken = Boolean(loadDevice(token).sessionToken);
        setView((prev) =>
          prev.kind === "out"
            ? restoreSessionAfterRejectedClockOut(prev.session, hasDeviceToken)
            : prev,
        );
        return;
      }
    }
  }, [base, token]);

  useEffect(() => {
    if (!queuedIn && !queuedOut) return;
    const run = () => {
      void flushQueues();
    };
    const onOnline = () => run();
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    run();

    let attempt = 0;
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") run();
        attempt += 1;
        schedule();
      }, clockRetryDelayMs(attempt));
    };
    schedule();

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [queuedIn, queuedOut, flushQueues]);

  const accent = link?.brand?.primaryColor || FALLBACK_ACCENT;

  const clockIn = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      saveProfile(token, profile);
      const tappedAt = new Date().toISOString();
      const idemKey = newIdempotencyKey();
      const tz = deviceTimezone();
      setBusy("Getting your location…");
      const reading = await captureGps();
      setBusy("Clocking you in…");

      const queueOffline = () => {
        sessionEpochRef.current += 1;
        // Clear any leftover closed-shift out queue before starting a new offline shift
        clearPendingPublicClockOut(token);
        setQueuedOut(null);
        const queued = enqueuePublicClockIn({
          token,
          id: idemKey,
          profile,
          gps: reading.gps,
          gpsStatus: reading.gpsStatus,
          timezone: tz,
          clientClockedInAt: tappedAt,
        });
        setQueuedIn(queued);
        setLastGps(reading.gpsStatus);
        const provisional = provisionalSessionFromQueuedIn(
          queued,
          link?.timezone || tz || "America/New_York",
        );
        setView({ kind: "in", session: provisional });
      };

      try {
        const { status, data } = await postJson(`${base}/in`, {
          ...profile,
          ...reading,
          timezone: tz,
          clientClockedInAt: tappedAt,
          idempotencyKey: idemKey,
        });
        if (status === 201 || (status === 200 && data.alreadyIn)) {
          sessionEpochRef.current += 1;
          clearPendingPublicClockIn(token);
          setQueuedIn(null);
          saveSessionToken(token, String(data.sessionToken));
          const created = data.session as Session;
          setLink((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, session: created };
            writeCachedPublicClockLink(token, updated);
            return updated;
          });
          setLastGps(reading.gpsStatus);
          setView({ kind: "in", session: created });
        } else if (status === 409 && data.openSession) {
          sessionEpochRef.current += 1;
          setView({ kind: "conflict", session: data.openSession as Session });
        } else if (isOfflineClockFailure({ status })) {
          queueOffline();
        } else {
          setError(String(data.message || "Couldn't clock you in. Try again."));
        }
      } catch (err) {
        if (isOfflineClockFailure({ error: err })) {
          queueOffline();
        } else {
          setError("Couldn't reach Spark. Check your signal and try again.");
        }
      } finally {
        setBusy(null);
      }
    },
    [base, link?.timezone, profile, token],
  );

  const clockOut = useCallback(
    async (opts: { email?: string }) => {
      setError(null);
      const tappedAt = new Date().toISOString();
      const idemKey = newIdempotencyKey();
      setBusy("Getting your location…");
      const reading = await captureGps();
      setBusy("Clocking you out…");

      // If clock-in is still queued on this phone, try flushing it first;
      // if still offline, queue clock-out right behind it.
      if (readPendingPublicClockIn(token)) {
        await flushQueues();
      }
      const { sessionToken } = loadDevice(token);
      const activeSession =
        view.kind === "in" || view.kind === "conflict" ? view.session : null;
      const fallbackEmail =
        opts.email || activeSession?.email || profile.email || undefined;

      const queueOfflineOut = () => {
        sessionEpochRef.current += 1;
        const queued = enqueuePublicClockOut({
          token,
          id: idemKey,
          sessionToken,
          email: fallbackEmail ?? null,
          gps: reading.gps,
          gpsStatus: reading.gpsStatus,
          clientClockedOutAt: tappedAt,
        });
        setQueuedOut(queued);
        setLastGps(reading.gpsStatus);
        const baseSession: Session =
          activeSession ??
          provisionalSessionFromQueuedIn(
            readPendingPublicClockIn(token) ?? {
              v: 1,
              id: "local",
              token,
              profile: {
                ...profile,
                email: fallbackEmail || profile.email,
              },
              gps: null,
              gpsStatus: "unavailable",
              timezone: deviceTimezone(),
              clientClockedInAt: tappedAt,
              queuedAt: Date.now(),
            },
            link?.timezone || "America/New_York",
          );
        setView({
          kind: "out",
          session: provisionalClosedSession(baseSession, queued),
        });
      };

      if (readPendingPublicClockIn(token)) {
        queueOfflineOut();
        setBusy(null);
        return;
      }

      const body = opts.email
        ? {
            email: opts.email,
            ...reading,
            clientClockedOutAt: tappedAt,
            idempotencyKey: idemKey,
          }
        : {
            sessionToken,
            ...(fallbackEmail ? { email: fallbackEmail } : {}),
            ...reading,
            clientClockedOutAt: tappedAt,
            idempotencyKey: idemKey,
          };

      try {
        const { status, data } = await postJson(`${base}/out`, body);
        if (status === 200 || (status === 409 && data.session)) {
          sessionEpochRef.current += 1;
          clearPendingPublicClockOut(token);
          setQueuedOut(null);
          saveSessionToken(token, null);
          setLink((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, session: null };
            writeCachedPublicClockLink(token, updated);
            return updated;
          });
          setLastGps(status === 200 ? reading.gpsStatus : null);
          setView({ kind: "out", session: data.session as Session });
        } else if (isOfflineClockFailure({ status })) {
          queueOfflineOut();
        } else if (data.error === "no_session") {
          setView({ kind: "byEmail" });
          setError(String(data.message));
        } else {
          setError(String(data.message || "Couldn't clock you out. Try again."));
        }
      } catch (err) {
        if (isOfflineClockFailure({ error: err })) {
          queueOfflineOut();
        } else {
          setError("Couldn't reach Spark. Check your signal and try again.");
        }
      } finally {
        setBusy(null);
      }
    },
    [base, flushQueues, link?.timezone, profile, token, view],
  );

  const handleManualFlush = () => {
    setFlushingNow(true);
    void flushQueues().finally(() => setFlushingNow(false));
  };

  return (
    <Shell brand={link?.brand ?? null} label={link?.label}>
      {lostPunch ? (
        <LostPunchAlert
          lostPunch={lostPunch}
          onDismiss={() => {
            clearPublicClockLostPunch(token);
            setLostPunch(null);
          }}
        />
      ) : null}
      {queuedIn || queuedOut ? (
        <QueuedPunchBanner
          queuedIn={queuedIn}
          queuedOut={queuedOut}
          flushing={flushingNow}
          onSendNow={handleManualFlush}
        />
      ) : null}
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
          queued={Boolean(queuedIn)}
          onClockOut={() => void clockOut({})}
        />
      ) : null}
      {view.kind === "conflict" ? (
        <div style={card}>
          <h1 style={h1}>You're already clocked in</h1>
          <p style={{ ...muted, marginTop: 8 }}>
            {view.session.firstName}, you clocked in{" "}
            {timeIn(view.session.clockInAt, view.session.timezone)} at{" "}
            {view.session.address}. Clock out of that shift before starting a new one.
          </p>
          <PrimaryButton
            accent={accent}
            busy={busy}
            onClick={() => void clockOut({ email: view.session.email })}
          >
            Clock out now
          </PrimaryButton>
          <ErrorText error={error} />
          <button
            type="button"
            style={linkBtn}
            onClick={() => setView({ kind: "form" })}
          >
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
          <p style={kicker}>
            {queuedOut ? "CLOCK-OUT SAVED ON THIS PHONE" : "CLOCKED OUT"}
          </p>
          <h1 style={h1}>
            Thanks, {view.session.firstName}.{" "}
            {formatDuration(view.session.durationMinutes ?? 0)} logged.
          </h1>
          <dl style={facts}>
            <Fact label="In">
              {timeIn(view.session.clockInAt, view.session.timezone)}
              {queuedIn ? " (queued)" : ""}
            </Fact>
            {view.session.clockOutAt ? (
              <Fact label="Out">
                {timeIn(view.session.clockOutAt, view.session.timezone)}
                {queuedOut ? " (queued)" : ""}
              </Fact>
            ) : null}
            <Fact label="Where">{view.session.address}</Fact>
          </dl>
          <GpsNotice status={lastGps} />
          {!queuedIn && !queuedOut ? (
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
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}

export function QueuedPunchBanner({
  queuedIn,
  queuedOut,
  flushing,
  onSendNow,
}: {
  queuedIn: PendingPublicClockIn | null;
  queuedOut: PendingPublicClockOut | null;
  flushing: boolean;
  onSendNow: () => void;
}) {
  if (!queuedIn && !queuedOut) return null;
  return (
    <div
      role="status"
      data-testid="public-clock-queued-banner"
      style={{
        marginBottom: 14,
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(180, 83, 9, 0.35)",
        background: "#fffbeb",
        color: "#78350f",
        fontSize: 13.5,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {queuedIn?.memoryOnly || queuedOut?.memoryOnly
          ? "Saved in this tab — keep this page open until signal returns"
          : "Saved offline — syncs automatically when signal returns"}
      </div>
      {queuedIn ? (
        <div>{offlineClockBanner(queuedIn.clientClockedInAt)}</div>
      ) : null}
      {queuedOut ? (
        <div style={{ marginTop: queuedIn ? 4 : 0 }}>
          {offlineClockOutBanner(queuedOut.clientClockedOutAt)}
        </div>
      ) : null}
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          disabled={flushing}
          onClick={onSendNow}
          style={{
            background: "#fff",
            border: "1px solid #92400e",
            color: "#78350f",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            cursor: flushing ? "wait" : "pointer",
          }}
        >
          {flushing ? "Syncing…" : "Send now"}
        </button>
      </div>
    </div>
  );
}

export function LostPunchAlert({
  lostPunch,
  onDismiss,
}: {
  lostPunch: LostPunch;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        marginBottom: 14,
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid #b91c1c",
        background: "#fef2f2",
        color: "#7f1d1d",
        fontSize: 13.5,
        lineHeight: 1.45,
      }}
    >
      <strong>
        Your {formatSavedClockTime(lostPunch.at) || "saved"} clock-
        {lostPunch.kind === "in" ? "in" : "out"} couldn't be recorded.
      </strong>{" "}
      It was held while you had no service and the server rejected it afterwards.
      Let your manager know the time so your hours can be adjusted.
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "#fff",
            border: "1px solid #b91c1c",
            color: "#7f1d1d",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Got it
        </button>
      </div>
    </div>
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
    onChange: (e: { target: { value: string } }) =>
      setProfile({ ...profile, [key]: e.target.value }),
    required: true,
    style: input,
    disabled: Boolean(busy),
  });
  return (
    <form style={card} onSubmit={onSubmit}>
      <h1 style={h1}>Clock in</h1>
      <p style={{ ...muted, marginTop: 6 }}>
        Fill this in once — your phone remembers it for next time.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 14,
        }}
      >
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
        <input
          {...field("email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
        />
      </label>
      <label style={{ ...labelStyle, marginTop: 12 }}>
        Market
        <input {...field("market")} placeholder="e.g. Phoenix" maxLength={120} />
      </label>
      <label style={{ ...labelStyle, marginTop: 12 }}>
        Address you're working at
        <input
          {...field("address")}
          autoComplete="street-address"
          placeholder="Store or venue address"
          maxLength={300}
        />
      </label>
      <p style={{ ...hint, marginTop: 14 }}>
        When you tap Clock in, your phone will ask to share your location. Spark
        saves it once when you clock in and once when you clock out — never in
        between. If you say no, you can still clock in.{" "}
        <a
          href="/privacy-policy#location"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          Privacy Policy
        </a>
      </p>
      <PrimaryButton accent={accent} busy={busy} type="submit">
        Clock in
      </PrimaryButton>
      <ErrorText error={error} />
      <button
        type="button"
        style={linkBtn}
        onClick={onLostPhone}
        disabled={Boolean(busy)}
      >
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
  queued,
  onClockOut,
}: {
  session: Session;
  accent: string;
  busy: string | null;
  error: string | null;
  gps: GpsStatus | null;
  queued?: boolean;
  onClockOut: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div style={card}>
      <p style={{ ...kicker, color: queued ? "#92400e" : "#3f6212" }}>
        {queued ? "● ON THE CLOCK · QUEUED OFFLINE" : "● ON THE CLOCK"}
      </p>
      <h1 style={h1}>
        {session.firstName}, you're clocked in ·{" "}
        {formatDuration(minutesBetween(session.clockInAt, now))}
      </h1>
      <dl style={facts}>
        <Fact label="Since">{timeIn(session.clockInAt, session.timezone)}</Fact>
        <Fact label="Where">{session.address}</Fact>
        <Fact label="Market">{session.market}</Fact>
      </dl>
      <GpsNotice status={gps} />
      <p style={{ ...hint, marginTop: 14 }}>
        Keep this page handy. Tap Clock out when your shift ends.
      </p>
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
      <button
        type="button"
        style={linkBtn}
        onClick={onBack}
        disabled={Boolean(busy)}
      >
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

function Shell({
  brand,
  label,
  children,
}: {
  brand: Brand | null;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <a href={IGNITE_HOME} style={{ display: "inline-flex", alignItems: "center" }}>
            <img
              src="/legal/spark-logo.png"
              alt="Spark by Ignite"
              style={{ height: 26, width: "auto" }}
            />
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
const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#44403c",
};
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
