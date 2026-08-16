import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_ORIGIN,
  adminOrigin,
  checkinUrl,
  clientOrigin,
  isPublicFieldPath,
  recapPublicUrl,
  recapShareOrigin,
  sparkFormUrl,
  resolvePublicFormLink,
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
    expect(isPublicFieldPath("/training/LD-FZUWXT")).toBe(true);
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

describe("resolvePublicFormLink", () => {
  it("prefers the spark-form slug when the tenant has one", () => {
    mockLocation("admin.igniteproductions.co");
    expect(
      resolvePublicFormLink({
        requestUrlName: "keee-torch-thc",
        checkinCode: "FF-XXXX",
      }),
    ).toEqual({
      slug: "keee-torch-thc",
      url: `${CLIENT_ORIGIN}/spark-form/keee-torch-thc`,
      kind: "spark-form",
    });
  });

  it("falls back to the standing check-in for Feel Free-style tenants", () => {
    mockLocation("admin.igniteproductions.co");
    expect(
      resolvePublicFormLink({
        requestUrlName: null,
        checkinCode: "FF-YMMK3Q",
      }),
    ).toEqual({
      slug: "FF-YMMK3Q",
      url: `${CLIENT_ORIGIN}/checkin/FF-YMMK3Q`,
      kind: "checkin",
    });
  });

  it("hides when the tenant has neither a form slug nor a check-in code", () => {
    expect(
      resolvePublicFormLink({ requestUrlName: "  ", checkinCode: null }),
    ).toBeNull();
  });
});

describe("recap share origin", () => {
  it("mints client even when staff are on admin", () => {
    mockLocation("admin.igniteproductions.co");
    expect(recapShareOrigin()).toBe(CLIENT_ORIGIN);
    expect(recapPublicUrl("tok")).toBe(`${CLIENT_ORIGIN}/r/tok`);
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
