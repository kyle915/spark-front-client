import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LostPunchAlert, QueuedPunchBanner } from "./PublicClock";
import {
  enqueuePublicClockIn,
  enqueuePublicClockOut,
  flushPendingPublicClockIn,
  flushPendingPublicClockOut,
  provisionalClosedSession,
  provisionalSessionFromQueuedIn,
  readPendingPublicClockIn,
  readPendingPublicClockOut,
  readPublicClockLostPunch,
  restoreSessionAfterRejectedClockOut,
  type StorageLike,
} from "@/shared/offlinePunchQueue";

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

const TOKEN = "CLK-WAREHOUSE9";
const PROFILE = {
  firstName: "Dana",
  lastName: "Reyes",
  email: "dana@example.com",
  market: "Phoenix",
  address: "123 Warehouse Way, Phoenix, AZ",
};

describe("public /clock/:token offline punch queue", () => {
  it("queues clock-in offline and flushes with exact clientClockedInAt & idempotencyKey", async () => {
    const storage = memStorage();
    const nowMs = Date.UTC(2026, 10, 22, 16, 0, 0);
    const inIso = new Date(nowMs).toISOString();

    const queued = enqueuePublicClockIn(
      {
        token: TOKEN,
        id: "idem-in-1",
        profile: PROFILE,
        gps: { lat: 33.4484, lng: -112.074, accuracy: 15 },
        gpsStatus: "ok",
        timezone: "America/Phoenix",
        clientClockedInAt: inIso,
        nowMs,
      },
      storage,
    );

    expect(queued.clientClockedInAt).toBe(inIso);
    expect(readPendingPublicClockIn(TOKEN, storage)?.id).toBe("idem-in-1");

    // First flush attempt hits a dead-zone network failure -> stays queued
    const retryRes = await flushPendingPublicClockIn(
      {
        token: TOKEN,
        postIn: async () => {
          throw new TypeError("Failed to fetch");
        },
      },
      storage,
    );
    expect(retryRes).toBe("retry");
    expect(readPendingPublicClockIn(TOKEN, storage)).not.toBeNull();

    // Reconnect flush succeeds -> delivers exact clientClockedInAt + idempotencyKey and clears queue
    let capturedBody: Record<string, unknown> | null = null;
    let savedSessionToken: string | null = null;

    const okRes = await flushPendingPublicClockIn(
      {
        token: TOKEN,
        postIn: async (body) => {
          capturedBody = body;
          return {
            ok: true,
            status: 201,
            sessionToken: "signed-session-tok",
            session: provisionalSessionFromQueuedIn(queued, "America/Phoenix"),
          };
        },
        onSession: ({ sessionToken }) => {
          savedSessionToken = sessionToken;
        },
      },
      storage,
    );

    expect(okRes).toBe("flushed");
    expect(savedSessionToken).toBe("signed-session-tok");
    expect(readPendingPublicClockIn(TOKEN, storage)).toBeNull();
    expect(capturedBody).toMatchObject({
      email: "dana@example.com",
      clientClockedInAt: inIso,
      idempotencyKey: "idem-in-1",
    });
  });

  it("holds clock-out behind an unsent clock-in and flushes both in order with exact duration", async () => {
    const storage = memStorage();
    const inMs = Date.UTC(2026, 10, 22, 14, 0, 0);
    const outMs = Date.UTC(2026, 10, 22, 16, 30, 0);
    const inIso = new Date(inMs).toISOString();
    const outIso = new Date(outMs).toISOString();

    const qIn = enqueuePublicClockIn(
      {
        token: TOKEN,
        id: "idem-in-seq",
        profile: PROFILE,
        gps: null,
        gpsStatus: "unavailable",
        timezone: "America/Phoenix",
        clientClockedInAt: inIso,
        nowMs: inMs,
      },
      storage,
    );
    const qOut = enqueuePublicClockOut(
      {
        token: TOKEN,
        id: "idem-out-seq",
        email: PROFILE.email,
        gps: null,
        gpsStatus: "unavailable",
        clientClockedOutAt: outIso,
        nowMs: outMs,
      },
      storage,
    );

    const openSnap = provisionalSessionFromQueuedIn(qIn, "America/Phoenix");
    const closedSnap = provisionalClosedSession(openSnap, qOut);
    expect(closedSnap.durationMinutes).toBe(150);

    // Attempting to flush clock-out BEFORE clock-in flushes refuses to race ahead
    const prematureOut = await flushPendingPublicClockOut(
      {
        token: TOKEN,
        postOut: async () => ({ ok: true, status: 200 }),
      },
      storage,
    );
    expect(prematureOut).toBe("retry");
    expect(readPendingPublicClockOut(TOKEN, storage)).not.toBeNull();

    // Flush clock-in first -> mints sessionToken
    let minted: string | null = null;
    await flushPendingPublicClockIn(
      {
        token: TOKEN,
        postIn: async () => ({
          ok: true,
          status: 201,
          sessionToken: "fresh-token-abc",
          session: openSnap,
        }),
        onSession: ({ sessionToken }) => {
          minted = sessionToken;
        },
      },
      storage,
    );

    // Flush clock-out -> uses freshly minted sessionToken + exact clientClockedOutAt
    let outBody: Record<string, unknown> | null = null;
    const outRes = await flushPendingPublicClockOut(
      {
        token: TOKEN,
        latestSessionToken: minted,
        postOut: async (body) => {
          outBody = body;
          return {
            ok: true,
            status: 200,
            session: closedSnap,
          };
        },
      },
      storage,
    );

    expect(outRes).toBe("flushed");
    expect(outBody).toMatchObject({
      sessionToken: "fresh-token-abc",
      email: "dana@example.com",
      clientClockedOutAt: outIso,
      idempotencyKey: "idem-out-seq",
    });
    expect(readPendingPublicClockOut(TOKEN, storage)).toBeNull();
  });

  it("records a LostPunch alert when server permanently rejects a queued punch", async () => {
    const storage = memStorage();
    const nowMs = Date.UTC(2026, 10, 22, 18, 0, 0);
    enqueuePublicClockIn(
      {
        token: TOKEN,
        profile: PROFILE,
        gps: null,
        gpsStatus: "denied",
        timezone: "America/Phoenix",
        clientClockedInAt: new Date(nowMs).toISOString(),
        nowMs,
      },
      storage,
    );

    const res = await flushPendingPublicClockIn(
      {
        token: TOKEN,
        postIn: async () => ({ ok: false, status: 410 }),
      },
      storage,
    );
    expect(res).toBe("rejected");
    expect(readPendingPublicClockIn(TOKEN, storage)).toBeNull();
    const lost = readPublicClockLostPunch(TOKEN, storage);
    expect(lost?.kind).toBe("in");

    const alertHtml = renderToStaticMarkup(
      <LostPunchAlert lostPunch={lost!} onDismiss={() => {}} />,
    );
    expect(alertHtml).toContain("couldn&#x27;t be recorded");
    expect(alertHtml).toContain("Got it");
  });

  it("renders clear queued status banner with Send now action", () => {
    const storage = memStorage();
    const nowMs = Date.UTC(2026, 10, 22, 18, 15, 0);
    const qIn = enqueuePublicClockIn(
      {
        token: TOKEN,
        profile: PROFILE,
        gps: null,
        gpsStatus: "ok",
        timezone: "America/Phoenix",
        clientClockedInAt: new Date(nowMs).toISOString(),
        nowMs,
      },
      storage,
    );
    const html = renderToStaticMarkup(
      <QueuedPunchBanner
        queuedIn={qIn}
        queuedOut={null}
        flushing={false}
        onSendNow={() => {}}
      />,
    );
    expect(html).toContain("Saved offline — syncs automatically when signal returns");
    expect(html).toContain("No service — we&#x27;ll clock you in when you&#x27;re back online");
    expect(html).toContain("Send now");
  });

  it("falls back to in-memory storage and warns user when localStorage.setItem throws", async () => {
    const quotaBrokenStorage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      },
      removeItem: () => {},
    };
    const nowMs = Date.UTC(2026, 10, 22, 18, 20, 0);
    const queued = enqueuePublicClockIn(
      {
        token: TOKEN,
        profile: PROFILE,
        gps: null,
        gpsStatus: "ok",
        timezone: "America/Phoenix",
        clientClockedInAt: new Date(nowMs).toISOString(),
        nowMs,
      },
      quotaBrokenStorage,
    );
    expect(queued.memoryOnly).toBe(true);
    expect(readPendingPublicClockIn(TOKEN, quotaBrokenStorage)?.id).toBe(queued.id);

    const bannerHtml = renderToStaticMarkup(
      <QueuedPunchBanner
        queuedIn={queued}
        queuedOut={null}
        flushing={false}
        onSendNow={() => {}}
      />,
    );
    expect(bannerHtml).toContain(
      "Saved in this tab — keep this page open until signal returns",
    );

    const flushed = await flushPendingPublicClockIn(
      {
        token: TOKEN,
        postIn: async () => ({
          ok: true,
          status: 201,
          sessionToken: "sess-mem",
        }),
      },
      quotaBrokenStorage,
    );
    expect(flushed).toBe("flushed");
    expect(readPendingPublicClockIn(TOKEN, quotaBrokenStorage)).toBeNull();
  });

  it("restores the open-shift view when a queued clock-out is rejected", () => {
    const openSession = {
      id: "sess-1",
      firstName: "Jordan",
      lastName: "Rivera",
      email: "jordan@gmail.com",
      market: "Phoenix",
      address: "123 Warehouse Way",
      timezone: "America/Phoenix",
      clockInAt: "2026-11-22T16:00:00Z",
      clockInGps: "ok" as const,
      clockOutAt: "2026-11-22T20:00:00Z",
      clockOutGps: "ok" as const,
      durationMinutes: 240,
    };

    const withDeviceToken = restoreSessionAfterRejectedClockOut(openSession, true);
    expect(withDeviceToken.kind).toBe("in");
    expect(withDeviceToken.session.clockOutAt).toBeNull();

    const withoutDeviceToken = restoreSessionAfterRejectedClockOut(openSession, false);
    expect(withoutDeviceToken.kind).toBe("conflict");
  });
});
