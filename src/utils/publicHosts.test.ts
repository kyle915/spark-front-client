import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_ORIGIN,
  CLIENT_ORIGIN,
  adminOrigin,
  checkinUrl,
  clientOrigin,
  isPublicFieldPath,
  recapPublicUrl,
  recapShareOrigin,
  sparkFormUrl,
} from "./publicHosts";

const originalWindow = globalThis.window;

function mockLocation(hostname: string, origin?: string) {
  const loc = {
    hostname,
    origin: origin ?? `https://${hostname}`,
  };
  vi.stubGlobal("window", { location: loc });
}

afterEach(() => {
  if (originalWindow) vi.stubGlobal("window", originalWindow);
  else vi.unstubAllGlobals();
});

describe("isPublicFieldPath", () => {
  it("matches check-in, public form, and recap share", () => {
    expect(isPublicFieldPath("/checkin/abc")).toBe(true);
    expect(isPublicFieldPath("/spark-form/liquid-death")).toBe(true);
    expect(isPublicFieldPath("/r/tok.en")).toBe(true);
  });
  it("does not match admin or login", () => {
    expect(isPublicFieldPath("/")).toBe(false);
    expect(isPublicFieldPath("/login")).toBe(false);
    expect(isPublicFieldPath("/recap/list")).toBe(false);
    expect(isPublicFieldPath("/request/view/x")).toBe(false);
  });
});

describe("client / admin origins", () => {
  it("keeps localhost for local testing", () => {
    mockLocation("localhost", "http://localhost:5173");
    expect(clientOrigin()).toBe("http://localhost:5173");
    expect(adminOrigin()).toBe("http://localhost:5173");
    expect(checkinUrl("WALK")).toBe("http://localhost:5173/checkin/WALK");
  });

  it("mints client. even when the tab is still on spark.", () => {
    mockLocation("spark.igniteproductions.co");
    expect(clientOrigin()).toBe(CLIENT_ORIGIN);
    expect(checkinUrl("WALK")).toBe(`${CLIENT_ORIGIN}/checkin/WALK`);
    expect(sparkFormUrl("ld")).toBe(`${CLIENT_ORIGIN}/spark-form/ld`);
  });

  it("mints client. from admin for BA-facing check-in / form links", () => {
    mockLocation("admin.igniteproductions.co");
    expect(checkinUrl("WALK")).toBe(`${CLIENT_ORIGIN}/checkin/WALK`);
    expect(sparkFormUrl("ld")).toBe(`${CLIENT_ORIGIN}/spark-form/ld`);
  });
});

describe("recap share origin", () => {
  it("uses admin when staff mint from admin", () => {
    mockLocation("admin.igniteproductions.co");
    expect(recapShareOrigin()).toBe(ADMIN_ORIGIN);
    expect(recapPublicUrl("tok")).toBe(`${ADMIN_ORIGIN}/r/tok`);
  });

  it("uses client when minted from the client portal", () => {
    mockLocation("client.igniteproductions.co");
    expect(recapPublicUrl("tok")).toBe(`${CLIENT_ORIGIN}/r/tok`);
  });

  it("never mints spark. for a leftover spark tab", () => {
    mockLocation("spark.igniteproductions.co");
    expect(recapShareOrigin()).toBe(CLIENT_ORIGIN);
    expect(recapPublicUrl("tok")).toBe(`${CLIENT_ORIGIN}/r/tok`);
  });
});
