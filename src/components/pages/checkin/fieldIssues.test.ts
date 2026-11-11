import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetFieldIssues, fieldIssueBody, reportFieldIssue } from "./fieldIssues";

describe("check-in field issue reporting", () => {
  let calls: { url: string; body: string }[];
  beforeEach(() => {
    calls = [];
    __resetFieldIssues();
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return Promise.resolve({ ok: true } as Response);
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("trims and caps the detail and never carries more than it was given", () => {
    const body = JSON.parse(fieldIssueBody("photo_upload_failed", "  PUT \n timed   out ", null));
    expect(body).toEqual({ kind: "photo_upload_failed", detail: "PUT timed out" });
    expect(JSON.parse(fieldIssueBody("gps_denied", "x".repeat(500))).detail).toHaveLength(200);
    expect(JSON.parse(fieldIssueBody("gps_denied", "", "tok")).session).toBe("tok");
  });

  it("posts to the link's client-event endpoint", () => {
    reportFieldIssue({ origin: "https://api.test", code: "FV-1 A", kind: "gps_denied" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.test/api/public/checkin/FV-1%20A/client-event");
  });

  it("reports the same problem once per page life", () => {
    const issue = { origin: "https://api.test", code: "FV-1", kind: "photo_upload_failed" as const, detail: "timeout" };
    reportFieldIssue(issue);
    reportFieldIssue(issue);
    reportFieldIssue({ ...issue, detail: "rate limited" });
    expect(calls).toHaveLength(2);
  });

  it("never throws, even when sending fails or there is nothing to send to", () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    expect(() =>
      reportFieldIssue({ origin: "https://api.test", code: "FV-1", kind: "request_timeout" }),
    ).not.toThrow();
    vi.stubGlobal("fetch", () => {
      throw new Error("boom");
    });
    expect(() =>
      reportFieldIssue({ origin: "https://api.test", code: "FV-2", kind: "request_timeout" }),
    ).not.toThrow();
    expect(() => reportFieldIssue({ origin: "", code: "", kind: "gps_denied" })).not.toThrow();
  });
});
