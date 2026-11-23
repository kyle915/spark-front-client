import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_ORIGIN,
  ADMIN_ORIGIN,
  adminOrigin,
  adminRequestUrl,
  campaignReportPublicUrl,
  checkinUrl,
  clientLivePublicUrl,
  clientOrigin,
  invoicePublicUrl,
  isPublicFieldPath,
  pitchPublicUrl,
  receiptCampaignPublicUrl,
  recapPublicUrl,
  recapShareOrigin,
  sparkFormUrl,
  resolvePublicFormLink,
  checkinRedirectTarget,
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
  it("matches public field and leave-behind routes", () => {
    expect(isPublicFieldPath("/checkin/abc")).toBe(true);
    expect(isPublicFieldPath("/spark-form/liquid-death")).toBe(true);
    expect(isPublicFieldPath("/r/tok.en")).toBe(true);
    expect(isPublicFieldPath("/report/tok.en")).toBe(true);
    expect(isPublicFieldPath("/training/LD-FZUWXT")).toBe(true);
    expect(isPublicFieldPath("/c/campaign-slug")).toBe(true);
    expect(isPublicFieldPath("/invoice/tok")).toBe(true);
    expect(isPublicFieldPath("/live/tok")).toBe(true);
    expect(isPublicFieldPath("/pitch/pd_tok")).toBe(true);
    expect(isPublicFieldPath("/jobs/AbC_123-x")).toBe(true);
    expect(isPublicFieldPath("/clock/AbC_123-x")).toBe(true);
  });
  it("does not match admin or login", () => {
    expect(isPublicFieldPath("/")).toBe(false);
    expect(isPublicFieldPath("/login")).toBe(false);
    expect(isPublicFieldPath("/recap/list")).toBe(false);
    expect(isPublicFieldPath("/request/view/x")).toBe(false);
    expect(isPublicFieldPath("/jobs")).toBe(false);
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

describe("campaign report share origin", () => {
  it("mints client. /report even from admin", () => {
    mockLocation("admin.igniteproductions.co");
    expect(campaignReportPublicUrl("abc.tok")).toBe(
      `${CLIENT_ORIGIN}/report/abc.tok`,
    );
  });

  it("never mints spark. for a leftover spark tab", () => {
    mockLocation("spark.igniteproductions.co");
    expect(campaignReportPublicUrl("abc.tok")).toBe(
      `${CLIENT_ORIGIN}/report/abc.tok`,
    );
  });
});

describe("receipt / invoice / live / admin request URLs", () => {
  it("mints client. for public leave-behinds from admin", () => {
    mockLocation("admin.igniteproductions.co");
    expect(receiptCampaignPublicUrl("acme")).toBe(`${CLIENT_ORIGIN}/c/acme`);
    expect(invoicePublicUrl("inv.tok")).toBe(
      `${CLIENT_ORIGIN}/invoice/inv.tok`,
    );
    expect(clientLivePublicUrl("live.tok")).toBe(
      `${CLIENT_ORIGIN}/live/live.tok`,
    );
    expect(pitchPublicUrl("pd_tok")).toBe(`${CLIENT_ORIGIN}/pitch/pd_tok`);
  });

  it("mints admin. for staff request mention links", () => {
    mockLocation("client.igniteproductions.co");
    expect(adminRequestUrl("req-uuid")).toBe(
      `${ADMIN_ORIGIN}/request/view/req-uuid`,
    );
  });

  it("never mints spark. for leftover spark tabs", () => {
    mockLocation("spark.igniteproductions.co");
    expect(receiptCampaignPublicUrl("acme")).toBe(`${CLIENT_ORIGIN}/c/acme`);
    expect(invoicePublicUrl("inv.tok")).toBe(
      `${CLIENT_ORIGIN}/invoice/inv.tok`,
    );
    expect(clientLivePublicUrl("live.tok")).toBe(
      `${CLIENT_ORIGIN}/live/live.tok`,
    );
    expect(pitchPublicUrl("pd_tok")).toBe(`${CLIENT_ORIGIN}/pitch/pd_tok`);
    expect(adminRequestUrl("req-uuid")).toBe(
      `${ADMIN_ORIGIN}/request/view/req-uuid`,
    );
  });
});

describe("checkinRedirectTarget", () => {
  const at = (hostname: string, pathname: string, search = "", hash = "") => ({
    hostname,
    pathname,
    search,
    hash,
  });

  it("moves a check-in link on the admin host to the client host, path intact", () => {
    expect(
      checkinRedirectTarget(
        at("admin.igniteproductions.co", "/checkin/BD-AQRACD", "?gig=7", "#recap"),
        [],
      ),
    ).toBe("https://client.igniteproductions.co/checkin/BD-AQRACD?gig=7#recap");
  });

  it("stays put when this phone already has a shift saved on the admin host", () => {
    expect(
      checkinRedirectTarget(at("admin.igniteproductions.co", "/checkin/BD-AQRACD"), [
        "@spark.appearance",
        "@spark.checkin.pendingClock/BD-AQRACD",
      ]),
    ).toBeNull();
    expect(
      checkinRedirectTarget(at("admin.igniteproductions.co", "/checkin/BD-AQRACD"), [
        "spark.checkin.BD-AQRACD",
      ]),
    ).toBeNull();
  });

  it("leaves staff pages, the client host and localhost alone", () => {
    expect(checkinRedirectTarget(at("admin.igniteproductions.co", "/today"), [])).toBeNull();
    expect(
      checkinRedirectTarget(at("admin.igniteproductions.co", "/checkins-report"), []),
    ).toBeNull();
    expect(
      checkinRedirectTarget(at("client.igniteproductions.co", "/checkin/BD-AQRACD"), []),
    ).toBeNull();
    expect(checkinRedirectTarget(at("localhost", "/checkin/BD-AQRACD"), [])).toBeNull();
  });
});

