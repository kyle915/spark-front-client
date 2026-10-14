import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureGps,
  formatDuration,
  gpsNote,
  gpsStatusForError,
  loadDevice,
  minutesBetween,
  saveProfile,
  saveSessionToken,
} from "./clockDevice";

function fakeGeo(result: { lat?: number; lng?: number; accuracy?: number; errorCode?: number }): Geolocation {
  return {
    getCurrentPosition: (ok: PositionCallback, fail?: PositionErrorCallback | null) => {
      if (result.errorCode !== undefined) {
        fail?.({ code: result.errorCode } as GeolocationPositionError);
        return;
      }
      ok({
        coords: { latitude: result.lat, longitude: result.lng, accuracy: result.accuracy },
      } as GeolocationPosition);
    },
  } as unknown as Geolocation;
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
  };
}

describe("clockDevice", () => {
  beforeEach(() => vi.stubGlobal("window", { localStorage: memoryStorage() }));
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the session token and profile per link", () => {
    saveProfile("abc", {
      firstName: "Dana",
      lastName: "Reyes",
      email: "dana@example.com",
      market: "Phoenix",
      address: "123 Camelback",
    });
    saveSessionToken("abc", "signed-token");
    expect(loadDevice("abc")).toEqual({
      sessionToken: "signed-token",
      profile: {
        firstName: "Dana",
        lastName: "Reyes",
        email: "dana@example.com",
        market: "Phoenix",
        address: "123 Camelback",
      },
    });
    expect(loadDevice("other").sessionToken).toBeNull();
    saveSessionToken("abc", null);
    expect(loadDevice("abc").sessionToken).toBeNull();
    expect(loadDevice("abc").profile.firstName).toBe("Dana");
  });

  it("survives garbage in storage", () => {
    window.localStorage.setItem("spark-clock:bad", "{not json");
    expect(loadDevice("bad").sessionToken).toBeNull();
  });

  it("captures one GPS fix", async () => {
    await expect(captureGps(fakeGeo({ lat: 33.5, lng: -112, accuracy: 9 }))).resolves.toEqual({
      gps: { lat: 33.5, lng: -112, accuracy: 9 },
      gpsStatus: "ok",
    });
  });

  it("records denial instead of failing", async () => {
    await expect(captureGps(fakeGeo({ errorCode: 1 }))).resolves.toEqual({ gps: null, gpsStatus: "denied" });
    await expect(captureGps(undefined)).resolves.toEqual({ gps: null, gpsStatus: "unsupported" });
    expect(gpsStatusForError(3)).toBe("timeout");
    expect(gpsNote("denied")).toMatch(/without GPS/);
    expect(gpsNote("ok")).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDuration(125)).toBe("2h 05m");
    expect(formatDuration(7)).toBe("7m");
    expect(minutesBetween("2026-10-14T10:00:00Z", "2026-10-14T12:05:30Z")).toBe(125);
  });
});
