/**
 * Device-side state for the public clock page (`/clock/:token`).
 *
 * The phone keeps the signed session token from Clock in so Clock out needs
 * nothing re-typed, plus the worker's details so the next shift is one tap.
 * Both are per link. GPS is one fix per tap — never watched in between.
 */

export type ClockProfile = {
  firstName: string;
  lastName: string;
  email: string;
  market: string;
  address: string;
};

export type GpsStatus = "ok" | "denied" | "unavailable" | "timeout" | "unsupported";

export type GpsReading = {
  gps: { lat: number; lng: number; accuracy: number | null } | null;
  gpsStatus: GpsStatus;
};

type Stored = { sessionToken?: string | null; profile?: Partial<ClockProfile> };

export const EMPTY_PROFILE: ClockProfile = {
  firstName: "",
  lastName: "",
  email: "",
  market: "",
  address: "",
};

const key = (token: string) => `spark-clock:${token}`;

function read(token: string): Stored {
  try {
    const raw = window.localStorage.getItem(key(token));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

function write(token: string, next: Stored): void {
  try {
    window.localStorage.setItem(key(token), JSON.stringify(next));
  } catch {
    /* private mode / full storage: Clock out by email still works */
  }
}

export function loadDevice(token: string): { sessionToken: string | null; profile: ClockProfile } {
  const stored = read(token);
  const profile = { ...EMPTY_PROFILE };
  for (const field of Object.keys(EMPTY_PROFILE) as (keyof ClockProfile)[]) {
    const value = stored.profile?.[field];
    if (typeof value === "string") profile[field] = value;
  }
  return { sessionToken: stored.sessionToken || null, profile };
}

export function saveSessionToken(token: string, sessionToken: string | null): void {
  write(token, { ...read(token), sessionToken });
}

export function saveProfile(token: string, profile: ClockProfile): void {
  write(token, { ...read(token), profile });
}

export function gpsStatusForError(code: number | undefined): GpsStatus {
  switch (code) {
    case 1:
      return "denied";
    case 2:
      return "unavailable";
    case 3:
      return "timeout";
    default:
      return "unavailable";
  }
}

export function captureGps(
  geolocation: Geolocation | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.geolocation,
  timeoutMs = 15000,
): Promise<GpsReading> {
  if (!geolocation) return Promise.resolve({ gps: null, gpsStatus: "unsupported" });
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          gps: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          },
          gpsStatus: "ok",
        }),
      (err) => resolve({ gps: null, gpsStatus: gpsStatusForError(err?.code) }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}

export function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function minutesBetween(startIso: string, end: Date | string): number {
  const start = new Date(startIso).getTime();
  const stop = typeof end === "string" ? new Date(end).getTime() : end.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(stop)) return 0;
  return Math.max(0, Math.floor((stop - start) / 60000));
}

export function gpsNote(status: GpsStatus | null | undefined): string | null {
  switch (status) {
    case null:
    case undefined:
    case "ok":
      return null;
    case "denied":
      return "Location was blocked, so this punch is saved without GPS. To fix it next time, allow location for this site in your browser settings.";
    case "timeout":
      return "Your phone took too long to find your location, so this punch is saved without GPS.";
    case "unavailable":
      return "Your phone couldn't find your location, so this punch is saved without GPS.";
    case "unsupported":
      return "This browser can't share location, so this punch is saved without GPS.";
    default: {
      const never: never = status;
      return never;
    }
  }
}
